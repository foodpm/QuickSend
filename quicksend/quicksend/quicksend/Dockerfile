# Stage 1: Build Frontend
FROM node:18-alpine as frontend-builder

WORKDIR /app-frontend

# Copy package files first to leverage cache
COPY static/package.json static/package-lock.json ./
RUN npm install

# Copy source code and build
COPY static/ ./
RUN npm run build

# Stage 2: Runtime
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    QUICKSEND_NO_BROWSER=1 \
    HEADLESS=1 \
    PORT=8000

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

# Overwrite static/dist with the freshly built frontend
COPY --from=frontend-builder /app-frontend/dist /app/static/dist

EXPOSE 8000

RUN mkdir -p /app/uploads

CMD ["python", "app.py"]
