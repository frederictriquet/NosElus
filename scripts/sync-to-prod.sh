#!/usr/bin/env bash
# Synchronise les données ETL locales vers le serveur de production via tunnel SSH.
# Usage : source .env.prod && ./scripts/sync-to-prod.sh [OPTIONS]
# Voir docs/spec-sync-prod-preprod.md pour la documentation complète.

set -euo pipefail

# --- Répertoire racine du projet ---
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# --- Valeurs par défaut ---
SCOPE="all"
DRY_RUN=false
SINCE_DATE=""
TUNNEL_PID=""
SCRIPT_START=$(date +%s)
ETL_EXECUTED=0
ETL_FAILED=0
LOCK_FILE=/tmp/sync-to-prod.lock
LOG_FILE="${LOG_FILE:-/tmp/sync-to-prod.log}"
LOCAL_TUNNEL_PORT="${LOCAL_TUNNEL_PORT:-5433}"
PROD_DB_PORT="${PROD_DB_PORT:-5432}"
PROD_SSH_KEY="${PROD_SSH_KEY:-${HOME}/.ssh/id_rsa}"
PROD_DB_USER="${PROD_DB_USER:-noselus}"
PROD_DB_NAME="${PROD_DB_NAME:-noselus}"

# --- Aide ---
usage() {
  cat <<EOF
Usage: ./scripts/sync-to-prod.sh [OPTIONS]

Options:
  --dry-run        Affiche les ETL qui seraient lancés sans les exécuter
  --scope SCOPE    Scope : weekly | enrichment | monthly | all (défaut: all)
  --since DATE     Optimisation : passe --since DATE aux ETL qui le supportent (YYYY-MM-DD)
  -h, --help       Affiche cette aide

Variables d'environnement requises :
  PROD_SSH_HOST      Hôte SSH du serveur prod
  PROD_SSH_USER      Utilisateur SSH
  PROD_DB_PASSWORD   Mot de passe PostgreSQL prod

Variables optionnelles :
  PROD_SSH_KEY       Clé SSH (défaut: ~/.ssh/id_rsa)
  PROD_DB_PORT       Port PostgreSQL prod (défaut: 5432)
  LOCAL_TUNNEL_PORT  Port local tunnel (défaut: 5433)
  TELEGRAM_BOT_TOKEN Token bot Telegram pour notifications
  TELEGRAM_CHAT_ID   ID chat Telegram
  LOG_FILE           Fichier de log (défaut: /tmp/sync-to-prod.log)
EOF
}

# --- Parsing des arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --scope)   SCOPE="$2"; shift 2 ;;
    --since)   SINCE_DATE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[ERROR] Argument inconnu : $1" >&2; exit 1 ;;
  esac
done

# --- Logging ---
log() {
  local level="$1"; shift
  local msg="$*"
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  printf '[%s] %-5s %s\n' "${ts}" "${level}" "${msg}" | tee -a "${LOG_FILE}"
}

# --- Notifications Telegram ---
notify_telegram() {
  local msg="$1"
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] || return 0
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d chat_id="${TELEGRAM_CHAT_ID}" \
    -d text="${msg}" \
    >/dev/null 2>&1 || true
}

# --- Fermeture propre du tunnel ---
cleanup() {
  if [ -n "${TUNNEL_PID}" ] && kill -0 "${TUNNEL_PID}" 2>/dev/null; then
    kill "${TUNNEL_PID}"
    wait "${TUNNEL_PID}" 2>/dev/null || true
    log "INFO" "Tunnel SSH fermé"
  fi
}
trap cleanup EXIT

# --- Étape 0 : Lock exclusif ---
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "[ERROR] sync-to-prod.sh est déjà en cours d'exécution (lock: ${LOCK_FILE})" >&2
  exit 2
fi

# --- Étape 1 : Validation des variables d'environnement ---
for var in PROD_SSH_HOST PROD_SSH_USER PROD_DB_PASSWORD; do
  if [ -z "${!var:-}" ]; then
    echo "[ERROR] Variable d'environnement obligatoire manquante : ${var}" >&2
    exit 1
  fi
done

case "${SCOPE}" in
  weekly|enrichment|monthly|all) ;;
  *) echo "[ERROR] Scope invalide : '${SCOPE}'. Valeurs valides : weekly, enrichment, monthly, all" >&2; exit 1 ;;
esac

log "INFO" "Démarrage sync scope=${SCOPE} dry_run=${DRY_RUN} since=${SINCE_DATE:-aucun}"

# --- Étape 2 : Ouverture du tunnel SSH ---
log "INFO" "Ouverture du tunnel SSH ${PROD_SSH_USER}@${PROD_SSH_HOST} (${LOCAL_TUNNEL_PORT} -> ${PROD_DB_PORT})..."
ssh -N \
  -L "${LOCAL_TUNNEL_PORT}:localhost:${PROD_DB_PORT}" \
  -i "${PROD_SSH_KEY}" \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o StrictHostKeyChecking=accept-new \
  "${PROD_SSH_USER}@${PROD_SSH_HOST}" &
TUNNEL_PID=$!
log "INFO" "Tunnel SSH ouvert (PID ${TUNNEL_PID})"

# --- Étape 3 : Vérification de la connexion (retry 5x, délai 2s) ---
log "INFO" "Vérification de la connexion prod..."
CONNECTED=false
for i in $(seq 1 5); do
  if PGPASSWORD="${PROD_DB_PASSWORD}" psql \
      -h localhost -p "${LOCAL_TUNNEL_PORT}" \
      -U "${PROD_DB_USER}" -d "${PROD_DB_NAME}" \
      -c "SELECT 1;" >/dev/null 2>&1; then
    CONNECTED=true
    break
  fi
  log "INFO" "Tentative ${i}/5 échouée, nouvelle tentative dans 2s..."
  sleep 2
done

if [ "${CONNECTED}" = false ]; then
  log "ERROR" "Impossible de se connecter à la base prod après 5 tentatives"
  exit 1
fi
log "INFO" "Connexion prod vérifiée"

# --- Étape 4 : Validation de compatibilité de schéma ---
log "INFO" "Validation de compatibilité de schéma..."
LOCAL_COUNT=$(
  "${PROJECT_DIR}/scripts/db-query.sh" \
    "SELECT COUNT(*)::text FROM __drizzle_migrations;" 2>/dev/null \
  | grep -E '^ +[0-9]+$' | tr -d ' '
)
PROD_COUNT=$(
  LOCAL_TUNNEL_PORT="${LOCAL_TUNNEL_PORT}" \
  PROD_DB_PASSWORD="${PROD_DB_PASSWORD}" \
  PROD_DB_USER="${PROD_DB_USER}" \
  PROD_DB_NAME="${PROD_DB_NAME}" \
  "${PROJECT_DIR}/scripts/db-query-prod.sh" \
    "SELECT COUNT(*)::text FROM __drizzle_migrations;" 2>/dev/null \
  | grep -E '^ +[0-9]+$' | tr -d ' '
)

if [ "${LOCAL_COUNT}" != "${PROD_COUNT}" ]; then
  log "ERROR" "Schéma local (${LOCAL_COUNT} migrations) != prod (${PROD_COUNT} migrations)"
  log "ERROR" "Appliquer 'npm run db:migrate' en prod avant de syncer"
  exit 3
fi
log "INFO" "Schéma compatible (${LOCAL_COUNT} migrations)"

# --- Étape 5 : Mode dry-run ---
print_etl_list() {
  local scope="$1"
  case "${scope}" in
    weekly)
      echo "  etl-an-download"
      echo "  etl-an-incremental"
      echo "  etl-an-dossiers"
      echo "  etl-an-link-laws"
      echo "  etl-europarl-votes"
      echo "  etl-europarl-laws"
      ;;
    enrichment)
      echo "  etl-an-law-texts"
      echo "  etl-europarl-law-texts"
      echo "  etl-an-analyze-laws"
      echo "  etl-europarl-analyze-laws"
      echo "  etl-an-classify-scrutins"
      ;;
    monthly)
      echo "  etl-an-nosdeputes-stats"
      echo "  etl-senat-activity-stats"
      echo "  etl-europarl-activity-stats"
      echo "  etl-senat-senators"
      ;;
    all)
      print_etl_list weekly
      print_etl_list enrichment
      print_etl_list monthly
      ;;
  esac
}

if [ "${DRY_RUN}" = true ]; then
  log "INFO" "Mode dry-run — ETLs qui seraient exécutés pour scope=${SCOPE} :"
  print_etl_list "${SCOPE}"
  [ -n "${SINCE_DATE}" ] && log "INFO" "Option --since ${SINCE_DATE} serait passée aux ETLs compatibles"
  exit 0
fi

# --- Étape 6 : Exécution des ETLs ---
export DATABASE_URL="postgresql://${PROD_DB_USER}:${PROD_DB_PASSWORD}@localhost:${LOCAL_TUNNEL_PORT}/${PROD_DB_NAME}"
notify_telegram "Début sync NosElus scope=${SCOPE} depuis $(hostname)"

ARGS_SINCE=""
[ -n "${SINCE_DATE}" ] && ARGS_SINCE="--since ${SINCE_DATE}"

run_etl() {
  local target="$1"
  local extra_args="${2:-}"
  log "START" "scope=${SCOPE} etl=${target}"
  local t_start
  t_start=$(date +%s)

  set +e
  if [ -n "${extra_args}" ]; then
    make -C "${PROJECT_DIR}" "${target}" ARGS="${extra_args}" >> "${LOG_FILE}" 2>&1
  else
    make -C "${PROJECT_DIR}" "${target}" >> "${LOG_FILE}" 2>&1
  fi
  local exit_code=$?
  set -e

  local duration=$(( $(date +%s) - t_start ))

  if [ "${exit_code}" -ne 0 ]; then
    log "ERROR" "scope=${SCOPE} etl=${target} exit_code=${exit_code} duration=${duration}s"
    ETL_FAILED=$(( ETL_FAILED + 1 ))
    notify_telegram "ERREUR sync NosElus : ETL ${target} a échoué (exit=${exit_code})"
    exit 1
  fi

  log "DONE" "scope=${SCOPE} etl=${target} duration=${duration}s"
  ETL_EXECUTED=$(( ETL_EXECUTED + 1 ))
}

run_weekly() {
  run_etl etl-an-download
  run_etl etl-an-incremental "${ARGS_SINCE}"
  run_etl etl-an-dossiers
  run_etl etl-an-link-laws
  run_etl etl-europarl-votes "${ARGS_SINCE}"
  run_etl etl-europarl-laws "${ARGS_SINCE}"
}

run_enrichment() {
  run_etl etl-an-law-texts
  run_etl etl-europarl-law-texts
  run_etl etl-an-analyze-laws
  run_etl etl-europarl-analyze-laws
  run_etl etl-an-classify-scrutins
}

run_monthly() {
  run_etl etl-an-nosdeputes-stats
  run_etl etl-senat-activity-stats
  run_etl etl-europarl-activity-stats
  run_etl etl-senat-senators
}

case "${SCOPE}" in
  weekly)     run_weekly ;;
  enrichment) run_enrichment ;;
  monthly)    run_monthly ;;
  all)        run_weekly; run_enrichment; run_monthly ;;
esac

# --- Étapes 7-8 : Fermeture tunnel + rapport final ---
DURATION=$(( $(date +%s) - SCRIPT_START ))
log "INFO" "Sync terminée : ${ETL_EXECUTED} ETLs exécutés, ${ETL_FAILED} échecs, durée=${DURATION}s"
notify_telegram "Fin sync NosElus scope=${SCOPE} : ${ETL_EXECUTED} ETLs OK, ${ETL_FAILED} échecs, ${DURATION}s"
