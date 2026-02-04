# NosElus - Makefile
# ==================
# Commandes utiles pour le développement et la gestion des données

.PHONY: help install dev build preview clean \
        db-up db-down db-migrate db-push db-studio db-reset \
        etl-download etl-all etl-incremental etl-actors etl-scrutins etl-laws etl-senat-laws etl-senat-senators etl-senat-mandates-history etl-nossenateurs-stats etl-senat-activity-stats etl-europarl-meps etl-europarl-historical etl-europarl-votes etl-europarl-activity-stats etl-external-colors etl-nosdeputes etl-colors etl-classify-scrutins etl-analyze-laws etl-law-texts etl-political-positions \
        docker-build docker-up docker-down docker-logs docker-restart \
        test test-watch test-ui test-e2e test-all \
        check lint format

# Variables
ETL_DATA_DIR ?= ./data/assemblee
ETL_LEGISLATURE ?= 17

# Couleurs pour l'affichage
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

# =============================================================================
# AIDE
# =============================================================================

help: ## Affiche cette aide
	@echo ""
	@echo "$(CYAN)NosElus - Commandes disponibles$(RESET)"
	@echo "================================"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Variables d'environnement:$(RESET)"
	@echo "  ETL_DATA_DIR      Répertoire des données Assemblée (défaut: ./data/assemblee)"
	@echo "  ETL_LEGISLATURE   Législature à importer (défaut: 17)"
	@echo ""

# =============================================================================
# INSTALLATION & DÉVELOPPEMENT
# =============================================================================

install: ## Installe les dépendances
	npm install

dev: ## Lance le serveur de développement
	npm run dev

build: ## Build l'application pour la production
	npm run build

preview: ## Preview du build de production
	npm run preview

clean: ## Nettoie les fichiers générés
	rm -rf .svelte-kit node_modules/.vite build

# =============================================================================
# BASE DE DONNÉES
# =============================================================================

db-up: ## Démarre PostgreSQL via Docker
	docker compose up -d db

db-down: ## Arrête PostgreSQL
	docker compose down

db-migrate: ## Applique les migrations
	npm run db:migrate

db-push: ## Push le schéma vers la DB (dev only)
	npm run db:push

db-studio: ## Lance Drizzle Studio (interface DB)
	npm run db:studio

db-generate: ## Génère les migrations depuis le schéma
	npm run db:generate

db-reset: ## Reset complet de la DB (ATTENTION: destructif!)
	@echo "$(YELLOW)⚠️  Cette commande va supprimer toutes les données!$(RESET)"
	@read -p "Êtes-vous sûr? [y/N] " confirm && [ "$$confirm" = "y" ]
	docker compose down -v
	docker compose up -d db
	sleep 3
	npm run db:push

# =============================================================================
# ETL - Import des données
# =============================================================================

etl-download: ## Télécharge les données de l'Assemblée Nationale
	@echo "$(CYAN)Téléchargement des données...$(RESET)"
	@mkdir -p $(ETL_DATA_DIR)
	npm run etl:download

etl-all: ## Import complet (organs, actors, mandates, scrutins, votes)
	@echo "$(CYAN)Import complet - Legislature $(ETL_LEGISLATURE)$(RESET)"
	ETL_DATA_DIR=$(ETL_DATA_DIR) ETL_ASSEMBLEE_LEGISLATURE=$(ETL_LEGISLATURE) npm run etl:all

etl-incremental: ## Import incrémental (seulement les nouveaux/modifiés)
	@echo "$(CYAN)Import incrémental - Legislature $(ETL_LEGISLATURE)$(RESET)"
	ETL_DATA_DIR=$(ETL_DATA_DIR) ETL_ASSEMBLEE_LEGISLATURE=$(ETL_LEGISLATURE) npm run etl:all -- --incremental

etl-actors: ## Import des acteurs uniquement
	ETL_DATA_DIR=$(ETL_DATA_DIR) ETL_ASSEMBLEE_LEGISLATURE=$(ETL_LEGISLATURE) npm run etl:actors

etl-scrutins: ## Import des scrutins et votes
	ETL_DATA_DIR=$(ETL_DATA_DIR) ETL_ASSEMBLEE_LEGISLATURE=$(ETL_LEGISLATURE) npm run etl:scrutins

etl-laws: ## Import des dossiers législatifs AN
	ETL_DATA_DIR=$(ETL_DATA_DIR) ETL_ASSEMBLEE_LEGISLATURE=$(ETL_LEGISLATURE) npm run etl:laws

etl-link-laws: ## Lie les scrutins aux textes via parsing des titres (MVP)
	ETL_LEGISLATURE=$(ETL_LEGISLATURE) npm run etl:link-laws

etl-dossiers-an: ## Import complet des dossiers législatifs AN avec cosignataires
	ETL_DATA_DIR=$(ETL_DATA_DIR)/dossiers_legislatifs ETL_LEGISLATURE=$(ETL_LEGISLATURE) npm run etl:dossiers-an

etl-senat-laws: ## Import des dossiers législatifs Sénat (DOSLEG)
	@echo "$(CYAN)Import des dossiers législatifs du Sénat...$(RESET)"
	npm run etl:senat-laws

etl-senat-senators: ## Import des sénateurs (API Sénat)
	@echo "$(CYAN)Import des sénateurs...$(RESET)"
	npm run etl:senat-senators

etl-senat-mandates-history: ## Import historique des mandats sénatoriaux (data.senat.fr)
	@echo "$(CYAN)Import historique des mandats sénatoriaux...$(RESET)"
	npm run etl:senat-mandates-history

etl-nossenateurs-stats: ## Import statistiques d'assiduité sénateurs (NosSénateurs.fr)
	@echo "$(CYAN)Import statistiques d'assiduité des sénateurs...$(RESET)"
	npm run etl:nossenateurs-stats

etl-senat-activity-stats: ## Import statistiques d'activité sénateurs (senat.fr officiel)
	@echo "$(CYAN)Import statistiques d'activité des sénateurs (source officielle)...$(RESET)"
	npm run etl:senat-activity-stats

etl-classify-scrutins: ## Classifier les scrutins existants par catégorie sémantique
	@echo "$(CYAN)Classification des scrutins...$(RESET)"
	npm run etl:classify-scrutins

etl-analyze-laws: ## Analyser les lois avec LLM local (Ollama) - résumé et tags
	@echo "$(CYAN)Analyse des lois avec LLM (Ollama)...$(RESET)"
	@echo "$(YELLOW)Prérequis: ollama serve + ollama pull mistral-nemo$(RESET)"
	npm run etl:analyze-laws -- $(ARGS)

etl-law-texts: ## Import des textes complets de lois via Légifrance PISTE
	@echo "$(CYAN)Import des textes de loi (Légifrance PISTE)...$(RESET)"
	@echo "$(YELLOW)Prérequis: PISTE_CLIENT_ID et PISTE_CLIENT_SECRET dans .env$(RESET)"
	npm run etl:law-texts -- $(ARGS)

etl-europarl-meps: ## Import des eurodéputés français (ParlTrack)
	@echo "$(CYAN)Import des eurodéputés français...$(RESET)"
	npm run etl:europarl-meps

etl-europarl-historical: ## Import historique des eurodéputés (depuis 2004)
	@echo "$(CYAN)Import historique des eurodéputés français (2004-présent)...$(RESET)"
	npm run etl:europarl-historical

etl-europarl-votes: ## Import des votes PE (HowTheyVote.eu)
	@echo "$(CYAN)Import des votes du Parlement Européen...$(RESET)"
	npm run etl:europarl-votes

etl-europarl-activity-stats: ## Import statistiques d'activité MEPs (HowTheyVote.eu)
	@echo "$(CYAN)Import statistiques d'activité des eurodéputés...$(RESET)"
	npm run etl:europarl-activity-stats

etl-pe-enrich-groups: ## Enrichit les noms des groupes PE (HowTheyVote.eu)
	@echo "$(CYAN)Enrichissement des noms de groupes PE...$(RESET)"
	npm run etl:pe-enrich-groups

etl-external-colors: ## Import des couleurs PE/Sénat depuis sources externes
	@echo "$(CYAN)Import des couleurs depuis sources externes...$(RESET)"
	npm run etl:external-colors

etl-nosdeputes: ## Import depuis NosDéputés.fr (API)
	npm run etl:nosdeputes

etl-nosdeputes-stats: ## Import statistiques d'activité députés (NosDéputés.fr)
	@echo "$(CYAN)Import statistiques d'activité des députés...$(RESET)"
	npm run etl:nosdeputes-stats

etl-colors: ## Synchronise les couleurs des groupes
	@echo "$(CYAN)Synchronisation des couleurs...$(RESET)"
	node --import tsx scripts/etl/sync-group-colors.ts

etl-political-positions: ## Import positions politiques depuis ParlGov
	@echo "$(CYAN)Import des positions politiques (ParlGov)...$(RESET)"
	node --import tsx scripts/etl/import-political-positions.ts $(ARGS)

etl-leg14: ## Import législature 14 (2012-2017)
	@$(MAKE) etl-all ETL_LEGISLATURE=14

etl-leg15: ## Import législature 15 (2017-2022)
	@$(MAKE) etl-all ETL_LEGISLATURE=15

etl-leg16: ## Import législature 16 (2022-2024)
	@$(MAKE) etl-all ETL_LEGISLATURE=16

etl-leg17: ## Import législature 17 (2024-)
	@$(MAKE) etl-all ETL_LEGISLATURE=17

etl-all-legislatures: ## Import toutes les législatures (14, 15, 16, 17)
	@echo "$(CYAN)Import législature 14 (XIVe - 2012-2017)...$(RESET)"
	@$(MAKE) etl-all ETL_LEGISLATURE=14
	@echo "$(CYAN)Import législature 15 (XVe - 2017-2022)...$(RESET)"
	@$(MAKE) etl-all ETL_LEGISLATURE=15
	@echo "$(CYAN)Import législature 16 (XVIe - 2022-2024)...$(RESET)"
	@$(MAKE) etl-all ETL_LEGISLATURE=16
	@echo "$(CYAN)Import législature 17 (XVIIe - 2024-)...$(RESET)"
	@$(MAKE) etl-all ETL_LEGISLATURE=17
	@echo "$(GREEN)✓ Toutes les législatures importées$(RESET)"

# =============================================================================
# INIT COMPLÈTE
# =============================================================================

init: ## Initialisation complète du projet (install, db, data)
	@echo "$(CYAN)=== Initialisation de NosElus ===$(RESET)"
	@echo ""
	@echo "$(CYAN)1/4 - Installation des dépendances...$(RESET)"
	@$(MAKE) install
	@echo ""
	@echo "$(CYAN)2/4 - Démarrage de la base de données...$(RESET)"
	@$(MAKE) db-up
	@sleep 3
	@echo ""
	@echo "$(CYAN)3/4 - Application des migrations...$(RESET)"
	@$(MAKE) db-migrate
	@echo ""
	@echo "$(CYAN)4/4 - Import des données (legislature $(ETL_LEGISLATURE))...$(RESET)"
	@$(MAKE) etl-all
	@echo ""
	@echo "$(GREEN)✓ Initialisation terminée!$(RESET)"
	@echo "  Lancez 'make dev' pour démarrer le serveur de développement"

init-quick: ## Init rapide sans données (pour dev frontend)
	@echo "$(CYAN)=== Initialisation rapide ===$(RESET)"
	@$(MAKE) install
	@$(MAKE) db-up
	@sleep 3
	@$(MAKE) db-migrate
	@echo "$(GREEN)✓ Prêt! Lancez 'make dev'$(RESET)"

# =============================================================================
# DOCKER
# =============================================================================

docker-build: ## Build les images Docker
	npm run docker:build

docker-up: ## Démarre tous les services Docker
	npm run docker:up

docker-down: ## Arrête tous les services Docker
	npm run docker:down

docker-logs: ## Affiche les logs Docker
	npm run docker:logs

docker-restart: ## Redémarre les services Docker
	npm run docker:restart

# =============================================================================
# TESTS
# =============================================================================

test: ## Lance les tests unitaires
	npm run test

test-watch: ## Lance les tests en mode watch
	npm run test:watch

test-ui: ## Lance les tests avec interface UI
	npm run test:ui

test-e2e: ## Lance les tests end-to-end
	npm run test:e2e

test-all: ## Lance tous les tests
	npm run test:all

# =============================================================================
# QUALITÉ DE CODE
# =============================================================================

check: ## Vérifie les types TypeScript
	npm run check

lint: check ## Alias pour check

format: ## Formate le code avec Prettier
	npx prettier --write .

# =============================================================================
# UTILITAIRES
# =============================================================================

status: ## Affiche le statut du projet
	@echo "$(CYAN)=== Statut NosElus ===$(RESET)"
	@echo ""
	@echo "$(YELLOW)Git:$(RESET)"
	@git status -s || echo "  Pas un repo git"
	@echo ""
	@echo "$(YELLOW)Docker:$(RESET)"
	@docker compose ps 2>/dev/null || echo "  Docker non disponible"
	@echo ""
	@echo "$(YELLOW)Base de données:$(RESET)"
	@docker compose exec -T db psql -U postgres -d noselus -c "SELECT COUNT(*) as actors FROM actors;" 2>/dev/null || echo "  DB non accessible"
	@docker compose exec -T db psql -U postgres -d noselus -c "SELECT COUNT(*) as scrutins FROM scrutins;" 2>/dev/null || true
	@echo ""

stats: ## Affiche les statistiques de la base de données
	@echo "$(CYAN)=== Statistiques DB ===$(RESET)"
	@docker compose exec -T db psql -U postgres -d noselus -c "\
		SELECT 'actors' as table_name, COUNT(*) as count FROM actors \
		UNION ALL SELECT 'organs', COUNT(*) FROM organs \
		UNION ALL SELECT 'mandates', COUNT(*) FROM mandates \
		UNION ALL SELECT 'scrutins', COUNT(*) FROM scrutins \
		UNION ALL SELECT 'votes', COUNT(*) FROM votes \
		UNION ALL SELECT 'amendments', COUNT(*) FROM amendments \
		ORDER BY table_name;" 2>/dev/null || echo "DB non accessible"
