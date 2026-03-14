from collections.abc import Callable

import paho.mqtt.client as mqtt

from backend.core.config import get_settings
from backend.core.logging import get_logger


class MQTTConsumer:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.logger = get_logger(__name__)
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

    def connect_and_subscribe(self, topic: str, on_message: Callable[..., None]) -> None:
        self.client.on_message = on_message
        self.client.connect(self.settings.mqtt_broker_host, self.settings.mqtt_broker_port, 60)
        self.client.subscribe(topic)
        self.logger.info("Subscribed to topic %s", topic)
        self.client.loop_start()
