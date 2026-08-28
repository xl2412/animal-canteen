#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <DNSServer.h>
#include <PubSubClient.h>

// ESP-12F / ESP8266 local provisioning API.
// The device remains intentionally independent from the cloud API while in SoftAP mode.
const char* AP_SSID = "ESP8266-Config";
const char* AP_PASS = "12345678";
const uint16_t HTTP_PORT = 80;
const int EEPROM_SIZE = 512;
const int SSID_ADDR = 0;
const int PASS_ADDR = 32;
const unsigned long PAIRING_WINDOW_MS = 10UL * 60UL * 1000UL;

ESP8266WebServer server(HTTP_PORT);
DNSServer dnsServer;
IPAddress apIP(192, 168, 4, 1);
IPAddress netmask(255, 255, 255, 0);
String deviceId;
String savedSSID;
String savedPassword;
String pairingCode;
bool paired = false;
bool configMode = false;
unsigned long pairingStartedAt = 0;
const char* MQTT_HOST = "broker.emqx.io";
const uint16_t MQTT_PORT = 1883;
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
String topicCommand, topicState, topicAvailability, topicResult;
unsigned long lastMqttAttempt = 0;

String readString(int address) {
  String value;
  char ch;
  while ((ch = EEPROM.read(address++)) != 0 && value.length() < 31) value += ch;
  return value;
}

void saveString(int address, const String& value) {
  for (unsigned int i = 0; i < value.length() && i < 31; i++) EEPROM.write(address + i, value[i]);
  EEPROM.write(address + min((unsigned int)value.length(), 31U), 0);
  EEPROM.commit();
}

String jsonEscape(const String& value) {
  String output;
  for (unsigned int i = 0; i < value.length(); i++) {
    char ch = value[i];
    if (ch == '\\' || ch == '"') output += '\\';
    output += ch;
  }
  return output;
}

String jsonStringValue(const String& json, const String& key) {
  String marker = "\"" + key + "\":\"";
  int start = json.indexOf(marker);
  if (start < 0) return "";
  start += marker.length();
  int end = json.indexOf('"', start);
  return end < 0 ? "" : json.substring(start, end);
}

void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleOptions() { cors(); server.send(204); }

void handleInfo() {
  cors();
  String body = "{\"deviceId\":\"" + jsonEscape(deviceId) + "\",\"model\":\"ESP-12F\",\"mac\":\"" + WiFi.macAddress() + "\",\"firmwareVersion\":\"0.2.0\",\"capabilities\":[\"io\",\"wifi_provisioning\"],\"pairingRequired\":true}";
  server.send(200, "application/json", body);
}

void handlePair() {
  cors();
  if (!server.hasArg("code") || server.arg("code") != pairingCode || millis() - pairingStartedAt > PAIRING_WINDOW_MS) {
    server.send(401, "application/json", "{\"error\":\"invalid_pairing_code\"}");
    return;
  }
  paired = true;
  server.send(200, "application/json", "{\"paired\":true}");
}

void handleWifi() {
  cors();
  if (!paired) {
    server.send(403, "application/json", "{\"error\":\"pairing_required\"}");
    return;
  }
  if (!server.hasArg("ssid") || !server.hasArg("password")) {
    server.send(400, "application/json", "{\"error\":\"missing_fields\"}");
    return;
  }
  saveString(SSID_ADDR, server.arg("ssid"));
  saveString(PASS_ADDR, server.arg("password"));
  server.send(200, "application/json", "{\"status\":\"saved\",\"restarting\":true}");
  delay(1000);
  ESP.restart();
}

void publishAvailability(const char* status) {
  String payload = "{\"deviceId\":\"" + deviceId + "\",\"status\":\"" + status + "\",\"model\":\"ESP-12F\",\"mac\":\"" + WiFi.macAddress() + "\",\"firmwareVersion\":\"0.2.0\",\"capabilities\":[\"io\",\"wifi_provisioning\"]}";
  mqtt.publish(topicAvailability.c_str(), payload.c_str(), true);
  Serial.println("MQTT availability: " + payload);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  if (message.indexOf("\"action\":\"feed\"") >= 0) {
    String requestId = jsonStringValue(message, "requestId");
    String result = "{\"deviceId\":\"" + deviceId + "\",\"requestId\":\"" + jsonEscape(requestId) + "\",\"status\":\"success\",\"message\":\"feed received\"}";
    mqtt.publish(topicResult.c_str(), result.c_str());
  }
}

void ensureMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected() || millis() - lastMqttAttempt < 5000) return;
  lastMqttAttempt = millis();
  String clientId = "esp8266_" + deviceId;
  String offline = "{\"deviceId\":\"" + deviceId + "\",\"status\":\"offline\"}";
  if (mqtt.connect(clientId.c_str(), nullptr, nullptr, topicAvailability.c_str(), 1, true, offline.c_str())) {
    mqtt.subscribe(topicCommand.c_str());
    publishAvailability("online");
  } else Serial.println("MQTT connect failed: " + String(mqtt.state()));
}

void handleStatus() {
  cors();
  String status = configMode ? "provisioning" : (WiFi.status() == WL_CONNECTED ? "connected" : "connecting");
  server.send(200, "application/json", "{\"deviceId\":\"" + jsonEscape(deviceId) + "\",\"status\":\"" + status + "\",\"online\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false") + "}");
}

void startConfigMode() {
  configMode = true;
  pairingStartedAt = millis();
  pairingCode = String(random(100000, 999999));
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(apIP, apIP, netmask);
  WiFi.softAP(AP_SSID, AP_PASS);
  dnsServer.start(53, "*", apIP);
  server.on("/api/info", HTTP_GET, handleInfo);
  server.on("/api/info", HTTP_OPTIONS, handleOptions);
  server.on("/api/pair", HTTP_POST, handlePair);
  server.on("/api/pair", HTTP_OPTIONS, handleOptions);
  server.on("/api/wifi", HTTP_POST, handleWifi);
  server.on("/api/wifi", HTTP_OPTIONS, handleOptions);
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/api/status", HTTP_OPTIONS, handleOptions);
  server.begin();
  Serial.println("Provisioning API: http://192.168.4.1/api/info");
  Serial.println("Pairing code: " + pairingCode);
}

void setup() {
  Serial.begin(115200);
  EEPROM.begin(EEPROM_SIZE);
  randomSeed(ESP.getChipId());
  deviceId = String(ESP.getChipId(), HEX);
  deviceId.toUpperCase();
  topicCommand = "animal-canteen/device/" + deviceId + "/command";
  topicState = "animal-canteen/device/" + deviceId + "/state";
  topicAvailability = "animal-canteen/device/" + deviceId + "/availability";
  topicResult = "animal-canteen/device/" + deviceId + "/result";
  savedSSID = readString(SSID_ADDR);
  savedPassword = readString(PASS_ADDR);
  if (savedSSID.length() == 0) startConfigMode();
  else {
    WiFi.mode(WIFI_STA);
    WiFi.begin(savedSSID.c_str(), savedPassword.c_str());
    mqtt.setServer(MQTT_HOST, MQTT_PORT);
    mqtt.setCallback(mqttCallback);
  }
}

void loop() {
  if (configMode) {
    dnsServer.processNextRequest();
    server.handleClient();
  } else {
    ensureMqtt();
    mqtt.loop();
  }
}
