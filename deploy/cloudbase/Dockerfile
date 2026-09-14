# CloudBase 云托管合并镜像：api + dispatcher + worker（12 转换含 LibreOffice）

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-wqy-zenhei \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --upgrade pip

COPY api/requirements.txt /tmp/api_req.txt
COPY worker/requirements.txt /tmp/worker_req.txt
RUN pip install --no-cache-dir -r /tmp/api_req.txt -r /tmp/worker_req.txt

# api（app 包/alembic）与 worker（worker 包）落在同一 /app，PYTHONPATH=/app
COPY api/ /app/
COPY worker/ /app/
COPY deploy/cloudbase/entrypoint.sh /app/entrypoint.sh
COPY deploy/cloudbase/health_server.py /app/health_server.py

ENV PYTHONPATH=/app
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]