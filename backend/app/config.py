from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str | None = None
    mqtt_password: str | None = None
    mqtt_topic_prefix: str = "animal-canteen/device"
    jwt_secret: str = "change-me"
    frontend_origin: str = "http://localhost:3000"
    database_url: str = "postgresql+asyncpg://animal:animal_dev@localhost:5432/animal_canteen"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
