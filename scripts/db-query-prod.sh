#!/usr/bin/env bash
# Interface unique pour les requêtes SQL vers la base prod via tunnel SSH.
# Usage : ./scripts/db-query-prod.sh "SELECT ..."
# Prérequis : tunnel SSH ouvert sur LOCAL_TUNNEL_PORT (défaut: 5433)
#             et PROD_DB_PASSWORD défini dans l'environnement.

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: ./scripts/db-query-prod.sh \"SQL_QUERY\"" >&2
  exit 1
fi

SQL="$1"
HOST="${PROD_TUNNEL_HOST:-localhost}"
PORT="${LOCAL_TUNNEL_PORT:-5433}"
USER="${PROD_DB_USER:-noselus}"
DB="${PROD_DB_NAME:-noselus}"

if [ -z "${PROD_DB_PASSWORD:-}" ]; then
  echo "Erreur: PROD_DB_PASSWORD non défini" >&2
  exit 1
fi

PGPASSWORD="${PROD_DB_PASSWORD}" psql \
  -h "${HOST}" -p "${PORT}" \
  -U "${USER}" -d "${DB}" \
  -c "${SQL}"
