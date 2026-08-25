# ESP8266 固件骨架

计划使用 Arduino / PlatformIO，核心 Topic：

```text
animal-canteen/device/{device_id}/command
animal-canteen/device/{device_id}/state
animal-canteen/device/{device_id}/result
animal-canteen/device/{device_id}/availability
```

下一步实现 Wi-Fi 配网、MQTT 重连、出粮驱动、余粮传感器、LWT、requestId 去重和 OTA。
