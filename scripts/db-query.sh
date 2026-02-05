#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: ./scripts/db-query.sh \"SQL_QUERY\""
  exit 1
fi

SQL="$1"

# Configuration explicite
CONTAINER="noselus-postgres"
USER="noselus"
DB="noselus"

docker exec "$CONTAINER" \
  psql -U "$USER" -d "$DB" -c "$SQL"
