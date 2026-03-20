from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AeroGuard Backend"
    app_env: str = Field(default="development", alias="APP_ENV")
    debug: bool = Field(default=True, alias="DEBUG")
    api_prefix: str = "/api/v1"

    postgres_user: str = Field(default="aeroguard", alias="POSTGRES_USER")
    postgres_password: str = Field(default="aeroguard", alias="POSTGRES_PASSWORD")
    postgres_db: str = Field(default="aeroguard", alias="POSTGRES_DB")
    postgres_host: str = Field(default="postgres", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")

    redis_host: str = Field(default="redis", alias="REDIS_HOST")
    redis_port: int = Field(default=6379, alias="REDIS_PORT")

    mqtt_broker_host: str = Field(default="mosquitto", alias="MQTT_BROKER_HOST")
    mqtt_broker_port: int = Field(default=1883, alias="MQTT_BROKER_PORT")

    openrouteservice_api_key: str | None = Field(default=None, alias="OPENROUTESERVICE_API_KEY")
    openrouteservice_base_url: str = Field(default="https://api.openrouteservice.org", alias="OPENROUTESERVICE_BASE_URL")
    osrm_base_url: str = Field(default="http://localhost:5000", alias="OSRM_BASE_URL")

    route_weight_pollution: float = Field(default=0.6, alias="ROUTE_WEIGHT_POLLUTION")
    route_weight_duration: float = Field(default=0.3, alias="ROUTE_WEIGHT_DURATION")
    route_weight_distance: float = Field(default=0.1, alias="ROUTE_WEIGHT_DISTANCE")

    # Multi-source pollution data APIs
    openaq_api_key: str | None = Field(default=None, alias="OPENAQ_API_KEY")
    openaq_base_url: str = Field(default="https://api.openaq.org/v3", alias="OPENAQ_BASE_URL")
    openaq_radius_m: int = Field(default=12000, alias="OPENAQ_RADIUS_M")
    openaq_location_limit: int = Field(default=100, alias="OPENAQ_LOCATION_LIMIT")

    aqicn_api_key: str | None = Field(default=None, alias="AQICN_API_KEY")
    aqicn_base_url: str = Field(default="https://api.waqi.info", alias="AQICN_BASE_URL")

    city_min_lat: float = Field(default=18.88, alias="CITY_MIN_LAT")
    city_min_lon: float = Field(default=72.73, alias="CITY_MIN_LON")
    city_max_lat: float = Field(default=19.30, alias="CITY_MAX_LAT")
    city_max_lon: float = Field(default=73.05, alias="CITY_MAX_LON")

    pollution_grid_refresh_seconds: int = Field(default=300, alias="POLLUTION_GRID_REFRESH_SECONDS")
    pollution_grid_cell_size_m: int = Field(default=100, alias="POLLUTION_GRID_CELL_SIZE_M")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/0"


@lru_cache
def get_settings() -> Settings:
    return Settings()
