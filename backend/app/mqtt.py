import asyncio
import json
from typing import Any, Awaitable, Callable

import aiomqtt


MessageHandler = Callable[[str, dict[str, Any]], Awaitable[None]]


class MQTTService:
    def __init__(self, prefix: str, host: str = "localhost", port: int = 1883, username: str | None = None, password: str | None = None):
        self.prefix = prefix
        self.host, self.port = host, port
        self.username, self.password = username, password
        self.client = None
        self.consumer_task: asyncio.Task | None = None

    def command_topic(self, device_id: str) -> str:
        return f"{self.prefix}/{device_id}/command"

    def topic(self, device_id: str, suffix: str) -> str:
        return f"{self.prefix}/{device_id}/{suffix}"

    def state_topic(self, device_id: str) -> str:
        return self.topic(device_id, "state")

    def result_topic(self, device_id: str) -> str:
        return self.topic(device_id, "result")

    def availability_topic(self, device_id: str) -> str:
        return self.topic(device_id, "availability")

    async def publish_command(self, device_id: str, payload: dict[str, Any]) -> None:
        if self.client is None:
            return
        await self.client.publish(self.command_topic(device_id), json.dumps(payload), qos=1)

    async def start_consumer(self, handler: MessageHandler) -> None:
        self.consumer_task = asyncio.create_task(self._consume(handler))

    async def stop_consumer(self) -> None:
        if self.consumer_task:
            self.consumer_task.cancel()
            await asyncio.gather(self.consumer_task, return_exceptions=True)
            self.consumer_task = None

    async def _consume(self, handler: MessageHandler) -> None:
        while True:
            try:
                kwargs: dict[str, Any] = {"hostname": self.host, "port": self.port}
                if self.username:
                    kwargs.update(username=self.username, password=self.password)
                async with aiomqtt.Client(**kwargs) as client:
                    self.client = client
                    await client.subscribe(f"{self.prefix}/+/availability", qos=1)
                    await client.subscribe(f"{self.prefix}/+/state", qos=1)
                    await client.subscribe(f"{self.prefix}/+/result", qos=1)
                    async for message in client.messages:
                        try:
                            payload = json.loads(message.payload.decode())
                            await handler(str(message.topic), payload)
                        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
                            continue
            except asyncio.CancelledError:
                raise
            except Exception:
                self.client = None
                await asyncio.sleep(5)
