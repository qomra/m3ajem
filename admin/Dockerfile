FROM python:3.11-slim

WORKDIR /app

# Copy requirements first for caching
COPY admin/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy admin app
COPY admin/ ./admin/

# Copy server models (needed for database)
COPY server/models.py ./server/models.py
COPY server/database.py ./server/database.py

EXPOSE 8001

CMD ["uvicorn", "admin.main:app", "--host", "0.0.0.0", "--port", "8001"]
