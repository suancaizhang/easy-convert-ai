from celery import Celery

app = Celery("worker")
app.config_from_object("worker.config")
app.autodiscover_tasks(["worker.tasks"])
