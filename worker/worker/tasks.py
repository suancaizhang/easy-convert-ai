from worker.celery_app import app


@app.task(name="worker.tasks.ping")
def ping():
    return "pong"


@app.task(name="worker.tasks.convert_document")
def convert_document(document_id: str):
    """Placeholder task for document conversion."""
    return {"document_id": document_id, "status": "completed"}
