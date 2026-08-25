import json
from typing import Any

class MQTTService:
    def __init__(self, prefix: str):
        self.prefix = prefix
        self.client = None

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
