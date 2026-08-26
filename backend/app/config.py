from pydantic_settings import BaseSettings, SettingsConfigDict


def async_database_url(value: str) -> str:
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+asyncpg://", 1)
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+asyncpg://", 1)
    return value


class Settings(BaseSettings):
    app_env: str = "development"
    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str | None = None
    mqtt_password: str | None = None
    mqtt_topic_prefix: str = "animal-canteen/device"
    jwt_secret: str = "change-me"
    frontend_origin: str = "http://localhost:3000"
    frontend_origins: str = ""
    database_url: str = "postgresql+asyncpg://animal:animal_dev@localhost:5432/animal_canteen"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def async_database_url(self) -> str:
        return async_database_url(self.database_url)


settings = Settings()
