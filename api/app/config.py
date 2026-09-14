from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://easyconvert:easyconvert_dev@postgres:5432/easyconvert"
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"
    debug: bool = False
    result_dir: str = "/tmp/results"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    wechat_appid: str = ""
    wechat_secret: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
