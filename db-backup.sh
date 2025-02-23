#!/usr/bin/env bash
#
# A script to export a Dokku Postgres database from a remote DigitalOcean droplet
# using a specific SSH key, and then save it locally.
#

# Configuration variables
DROPLET_IP="165.22.46.191"           # Your droplet IP
SSH_USER="root"                     # Or your preferred user
SSH_KEY="./digital_ocean_key"  # Path to your SSH private key
SERVICE_NAME="yo-postgres"       # The name of your Dokku Postgres service

# Create a timestamped filename for the local dump
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
LOCAL_DUMP_FILE="./pg-backups/${SERVICE_NAME}_${TIMESTAMP}.dump"

echo "Exporting Postgres database from service '${SERVICE_NAME}' on ${DROPLET_IP}..."

# Note the -i option to specify the key file
ssh -i "${SSH_KEY}" "${SSH_USER}@${DROPLET_IP}" \
  "dokku postgres:export ${SERVICE_NAME}" > "${LOCAL_DUMP_FILE}"

if [[ $? -eq 0 ]]; then
  echo "Database export complete!"
  echo "Local backup file: ${LOCAL_DUMP_FILE}"
else
  echo "Error: Database export or download failed."
  exit 1
fi
