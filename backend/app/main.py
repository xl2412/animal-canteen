from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .config import settings
from .mqtt import MQTTService

mqtt = MQTTService(settings.mqtt_topic_prefix)

class FeedCommand(BaseModel):
    grams: int = Field(default=20, ge=1, le=500)


class Device(BaseModel):
    deviceId: str
    name: str
    online: bool = False
    state: dict = {}


devices: dict[str, Device] = {
    "feeder-demo": Device(deviceId="feeder-demo", name="小橘 · 智能喂食器", online=True, state={"foodPercent": 68, "todayFeedCount": 3, "lastFedAt": "10:30"})
}
records: list[dict] = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="动物食堂 API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_credentials=True, allow_methods=["GET", "POST"], allow_headers=["*"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "animal-canteen-api"}

@app.get("/api/devices")
async def list_devices():
    return {"items": list(devices.values())}

@app.post("/api/devices/{device_id}/commands")
async def send_command(device_id: str, command: FeedCommand):
    if device_id not in devices:
        raise HTTPException(status_code=404, detail="设备不存在")
    if not devices[device_id].online:
        raise HTTPException(status_code=409, detail="设备当前离线")
    request_id = f"req_{uuid4().hex}"
    payload = {"requestId": request_id, "action": "feed", "grams": command.grams}
    await mqtt.publish_command(device_id, payload)
    records.append({"requestId": request_id, "deviceId": device_id, "grams": command.grams, "status": "accepted"})
    return {"requestId": request_id, "status": "accepted", "message": "命令已发送，等待设备结果"}

@app.get("/api/devices/{device_id}")
async def get_device(device_id: str):
    if device_id not in devices:
        raise HTTPException(status_code=404, detail="设备不存在")
    return devices[device_id]


@app.get("/api/devices/{device_id}/records")
async def get_records(device_id: str):
    if device_id not in devices:
        raise HTTPException(status_code=404, detail="设备不存在")
    return {"items": [record for record in records if record["deviceId"] == device_id]}
