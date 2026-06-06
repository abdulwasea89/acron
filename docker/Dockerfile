# Gym Platform backend — API + worker share this image
FROM python:3.12-slim AS base

WORKDIR /app

# System deps (asyncpg needs no build tools on slim; add curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir uv && uv pip install --system -r pyproject.toml

COPY app ./app
COPY tests ./tests

EXPOSE 8000

# Default: API server. Worker overrides command in compose.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
