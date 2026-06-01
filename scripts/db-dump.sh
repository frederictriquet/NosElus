#!/usr/bin/env bash
# Encapsule pg_dump sur le conteneur PostgreSQL local.
# Usage : ./scripts/db-dump.sh > fichier.sql
# Analogue de db-query.sh pour les dumps complets.

set -euo pipefail

CONTAINER="${POSTGRES_CONTAINER:-noselus-postgres}"
USER="${POSTGRES_USER:-noselus}"
DB="${POSTGRES_DB:-noselus}"

docker exec "${CONTAINER}" pg_dump -U "${USER}" --format=plain "${DB}"
