from contextlib import asynccontextmanager
from datetime import datetime, time, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .config import settings
from .mqtt import MQTTService


class Base(DeclarativeBase):
    pass


class DeviceModel(Base):
    __tablename__ = "devices"
    device_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    nickname: Mapped[str] = mapped_column(String(120), default="未命名设备")
    online: Mapped[bool] = mapped_column(Boolean, default=False)
    food_percent: Mapped[int] = mapped_column(Integer, default=0)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    pet: Mapped["PetModel | None"] = relationship(back_populates="device", cascade="all, delete-orphan", uselist=False, lazy="selectin")
    schedules: Mapped[list["ScheduleModel"]] = relationship(back_populates="device", cascade="all, delete-orphan", lazy="selectin")
    records: Mapped[list["RecordModel"]] = relationship(back_populates="device", cascade="all, delete-orphan", lazy="selectin")


class PetModel(Base):
    __tablename__ = "pets"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.device_id", ondelete="CASCADE"), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    avatar: Mapped[str] = mapped_column(String(20), default="🐱")
    device: Mapped[DeviceModel] = relationship(back_populates="pet")


class ScheduleModel(Base):
    __tablename__ = "feeding_schedules"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.device_id", ondelete="CASCADE"))
    schedule_time: Mapped[time] = mapped_column("time")
    grams: Mapped[int] = mapped_column(Integer)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    device: Mapped[DeviceModel] = relationship(back_populates="schedules")


class RecordModel(Base):
    __tablename__ = "feeding_records"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.device_id", ondelete="CASCADE"))
    grams: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30), default="accepted")
    request_id: Mapped[str] = mapped_column(String(80), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    device: Mapped[DeviceModel] = relationship(back_populates="records")


engine = create_async_engine(settings.async_database_url, pool_pre_ping=True)
Session = async_sessionmaker(engine, expire_on_commit=False)
mqtt = MQTTService(settings.mqtt_topic_prefix)


class PetInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    avatar: str = Field(default="🐱", max_length=20)


class BindInput(BaseModel):
    deviceId: str = Field(min_length=1, max_length=100)
    nickname: str = Field(min_length=1, max_length=120)
    pet: PetInput


class DeviceUpdate(BaseModel):
    nickname: str = Field(min_length=1, max_length=120)
    pet: PetInput


class ScheduleInput(BaseModel):
    time: str
    grams: int = Field(ge=1, le=500)
    enabled: bool = True

    @field_validator("time")
    @classmethod
    def valid_time(cls, value: str) -> str:
        try:
            time.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("时间必须使用 HH:MM 格式") from exc
        return value[:5]


class FeedCommand(BaseModel):
    grams: int = Field(default=20, ge=1, le=500)


def serialize_device(device: DeviceModel) -> dict:
    return {
        "deviceId": device.device_id,
        "nickname": device.nickname,
        "online": device.online,
        "foodPercent": device.food_percent,
        "lastSeenAt": device.last_seen_at,
        "pet": {"name": device.pet.name, "avatar": device.pet.avatar} if device.pet else None,
    }


async def get_device(session: AsyncSession, device_id: str) -> DeviceModel:
    result = await session.execute(select(DeviceModel).where(DeviceModel.device_id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在或未注册")
    return device


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with Session.begin() as session:
        demo = await session.get(DeviceModel, "feeder-demo")
        if not demo:
            demo = DeviceModel(device_id="feeder-demo", nickname="小橘 · 智能喂食器", online=True, food_percent=68)
            session.add(demo)
            session.add(PetModel(device_id="feeder-demo", name="小橘", avatar="🐱"))
    yield
    await engine.dispose()


app = FastAPI(title="动物食堂 API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://animal-canteen-frontend-production.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "animal-canteen-api"}


@app.get("/api/devices")
async def list_devices():
    async with Session() as session:
        result = await session.execute(select(DeviceModel).order_by(DeviceModel.created_at.desc()))
        return {"items": [serialize_device(device) for device in result.scalars().unique().all()]}


@app.post("/api/devices/bind")
async def bind_device(payload: BindInput):
    async with Session.begin() as session:
        device = await get_device(session, payload.deviceId)
        device.nickname = payload.nickname
        if device.pet:
            device.pet.name, device.pet.avatar = payload.pet.name, payload.pet.avatar
        else:
            device.pet = PetModel(name=payload.pet.name, avatar=payload.pet.avatar)
        await session.flush()
        return serialize_device(device)


@app.get("/api/devices/{device_id}")
async def device_detail(device_id: str):
    async with Session() as session:
        device = await get_device(session, device_id)
        schedules = (await session.execute(select(ScheduleModel).where(ScheduleModel.device_id == device_id).order_by(ScheduleModel.schedule_time))).scalars().all()
        data = serialize_device(device)
        data["schedules"] = [{"id": item.id, "time": item.schedule_time.strftime("%H:%M"), "grams": item.grams, "enabled": item.enabled} for item in schedules]
        return data


@app.put("/api/devices/{device_id}")
async def update_device(device_id: str, payload: DeviceUpdate):
    async with Session.begin() as session:
        device = await get_device(session, device_id)
        device.nickname = payload.nickname
        if device.pet:
            device.pet.name, device.pet.avatar = payload.pet.name, payload.pet.avatar
        else:
            device.pet = PetModel(name=payload.pet.name, avatar=payload.pet.avatar)
        return serialize_device(device)


@app.get("/api/devices/{device_id}/schedules")
async def list_schedules(device_id: str):
    async with Session() as session:
        await get_device(session, device_id)
        items = (await session.execute(select(ScheduleModel).where(ScheduleModel.device_id == device_id).order_by(ScheduleModel.schedule_time))).scalars().all()
        return {"items": [{"id": item.id, "time": item.schedule_time.strftime("%H:%M"), "grams": item.grams, "enabled": item.enabled} for item in items]}


@app.post("/api/devices/{device_id}/schedules")
async def create_schedule(device_id: str, payload: ScheduleInput):
    async with Session.begin() as session:
        await get_device(session, device_id)
        schedule = ScheduleModel(device_id=device_id, schedule_time=time.fromisoformat(payload.time), grams=payload.grams, enabled=payload.enabled)
        session.add(schedule)
        await session.flush()
        return {"id": schedule.id, "time": payload.time, "grams": schedule.grams, "enabled": schedule.enabled}


@app.delete("/api/devices/{device_id}/schedules/{schedule_id}", status_code=204)
async def delete_schedule(device_id: str, schedule_id: int):
    async with Session.begin() as session:
        await get_device(session, device_id)
        schedule = await session.get(ScheduleModel, schedule_id)
        if not schedule or schedule.device_id != device_id:
            raise HTTPException(status_code=404, detail="放粮时间不存在")
        await session.delete(schedule)


@app.post("/api/devices/{device_id}/commands")
async def send_command(device_id: str, command: FeedCommand):
    async with Session.begin() as session:
        device = await get_device(session, device_id)
        if not device.online:
            raise HTTPException(status_code=409, detail="设备当前离线")
        request_id = f"req_{uuid4().hex}"
        await mqtt.publish_command(device_id, {"requestId": request_id, "action": "feed", "grams": command.grams})
        session.add(RecordModel(device_id=device_id, grams=command.grams, request_id=request_id, status="accepted"))
        return {"requestId": request_id, "status": "accepted", "message": "命令已发送，等待设备结果"}


@app.get("/api/devices/{device_id}/records")
async def get_records(device_id: str):
    async with Session() as session:
        await get_device(session, device_id)
        items = (await session.execute(select(RecordModel).where(RecordModel.device_id == device_id).order_by(RecordModel.created_at.desc()))).scalars().all()
        return {"items": [{"id": item.id, "requestId": item.request_id, "grams": item.grams, "status": item.status, "createdAt": item.created_at} for item in items]}
