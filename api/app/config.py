from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://easyconvert:easyconvert_dev@postgres:5432/easyconvert"
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"
    debug: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
