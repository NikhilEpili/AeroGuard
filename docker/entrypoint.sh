#!/bin/sh
# AeroGuard API entrypoint
# Runs Alembic migrations (with retry) then execs the CMD passed by Docker.
# The sensor-simulator service overrides ENTRYPOINT in docker-compose, so this
# script is never executed for that container.
set -e

MAX_RETRIES=12
RETRY_INTERVAL=5

echo "[entrypoint] Running Alembic migrations..."

i=0
until alembic upgrade head; do
    i=$((i + 1))
    if [ "$i" -ge "$MAX_RETRIES" ]; then
        echo "[entrypoint] ERROR: migrations failed after ${MAX_RETRIES} attempts. Aborting."
        exit 1
    fi
    echo "[entrypoint] Migration attempt ${i} failed — retrying in ${RETRY_INTERVAL}s..."
    sleep "$RETRY_INTERVAL"
done

echo "[entrypoint] Migrations complete. Starting application..."

exec "$@"
