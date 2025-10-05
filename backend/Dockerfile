# ---------- Base Image ----------
FROM python:3.13-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Create app directory
WORKDIR /app

# ---------- Install dependencies ----------
COPY requirements.txt .

# Install dependencies (using no-cache for smaller image)
RUN pip install --no-cache-dir -r requirements.txt

# ---------- Copy application code ----------
COPY . .

# ---------- Expose & Run ----------
EXPOSE 8000

# Use Uvicorn as the ASGI server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
