#!/usr/bin/env bash
# Lance l'analyse LLM des lois depuis n'importe quel répertoire.
# Usage:
#   run-analyze-laws.sh                    # 100 lois par défaut
#   run-analyze-laws.sh --limit 5          # 5 lois
#   run-analyze-laws.sh --legislature PE-10 --limit 5
#   run-analyze-laws.sh --dry-run

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Charger les variables d'environnement
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
else
  echo "Erreur: $PROJECT_DIR/.env introuvable" >&2
  exit 1
fi

exec make -C "$PROJECT_DIR" etl-an-law-texts ARGS="--limit 10"
