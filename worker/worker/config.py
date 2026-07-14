import os

broker_url = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/1")
task_serializer = "json"
result_serializer = "json"
accept_content = ["json"]
timezone = "Asia/Shanghai"
task_acks_late = True
task_reject_on_worker_lost = True

task_routes = {
    "worker.tasks.convert_document_office": {"queue": "office"},
    "worker.tasks.convert_document": {"queue": "default"},
}

task_queues = {
    "default": {"exchange": "default", "routing_key": "default"},
    "office": {"exchange": "office", "routing_key": "office"},
}
