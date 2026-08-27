# ESP8266 固件骨架

计划使用 Arduino / PlatformIO，核心 Topic：

```text
animal-canteen/device/{device_id}/command
animal-canteen/device/{device_id}/state
animal-canteen/device/{device_id}/result
animal-canteen/device/{device_id}/availability
```

## Wi-Fi 配网协议

设备进入配网模式后启动 SoftAP，默认地址为 `192.168.4.1`，热点名称建议为
`AnimalCanteen-{MAC 后四位}`。手机浏览器不能自动扫描或切换 Wi-Fi，因此前端会引导用户手动连接该热点。

本地 HTTP 接口：

```text
GET  /api/info                 # 读取 deviceId、型号、MAC、固件版本、能力
POST /api/pair                 # {"code":"一次性配对码"}
POST /api/wifi                 # {"ssid":"...","password":"...","provisioningToken":"..."}
GET  /api/provisioning-status  # 查询联网结果
```

配对码应短时有效且只能使用一次；设备连接家庭 Wi-Fi 后关闭 SoftAP，并通过 MQTT 上报硬件身份和在线状态。

下一步实现以上配网接口、MQTT 重连、出粮驱动、余粮传感器、LWT、requestId 去重和 OTA。
