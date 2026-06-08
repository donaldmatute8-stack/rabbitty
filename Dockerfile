# Rabbitty Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY src/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY src/backend/ .

# Expose port
EXPOSE 3000

# Run server
CMD ["python", "server.py"]
