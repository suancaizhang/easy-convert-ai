import os
from pathlib import Path

from dotenv import load_dotenv
from celery import Celery

# 本地开发时加载项目根目录 .env
env_path = Path(__file__).resolve().parents[2] / ".env"
if env_path.exists():
    load_dotenv(env_path)

app = Celery("worker")
app.config_from_object("worker.config")
app.autodiscover_tasks(["worker.tasks"])
