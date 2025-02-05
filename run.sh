#!/bin/bash

# Start docker and wait for containers to be ready
docker compose up -d
echo "Waiting for postgres to be ready..."
until docker exec postgres_db pg_isready -U postgres 2>/dev/null; do
  echo "Postgres is starting..."
  sleep 2
done
echo "Postgres is ready!"

# Wait for minio to be ready
echo "Waiting for minio to be ready..."
until docker exec minio sh -c "mc alias set local http://localhost:9000 minioadmin minioadmin123" 2>/dev/null; do
  echo "Minio is starting..."
  sleep 2
done
echo "Minio is ready!"

# Create MinIO bucket using mc command
echo "Creating MinIO buckets..."
docker exec minio mc alias set local http://minio:9000 minioadmin minioadmin123
docker exec minio mc mb local/my-new-bucket --ignore-existing
docker exec minio mc anonymous set public local/my-new-bucket
docker exec minio mc mb local/gitea-lfs --ignore-existing
docker exec minio mc anonymous set download local/gitea-lfs
echo "MinIO buckets created!"

trap "echo 'Stopping all processes'; kill $SERVER_PID $NEXTJS_APP_PID 2>/dev/null; docker compose down" EXIT INT TERM

# Run the Express API
cd api/
bun install
bun run dev &
SERVER_PID=$!
echo "Express api started with PID $SERVER_PID"

# Run the Next.js app
cd ../frontend/
bun install
bun run dev &
NEXTJS_APP_PID=$!
echo "Next.js app started with PID $NEXTJS_APP_PID"

# Wait for both processes to complete
wait $SERVER_PID $NEXTJS_APP_PID