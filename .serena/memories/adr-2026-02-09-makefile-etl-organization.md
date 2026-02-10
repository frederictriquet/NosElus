# ADR-009 : Organisation des targets ETL du Makefile

## Métadonnées

- **Date** : 2026-02-09
- **Statut** : ✅ Accepté
- **Décideurs** : Équipe développement
- **ID** : ADR-009
- **Catégorie** : Developer Experience / Infrastructure

## Contexte

### Problème

Le Makefile contient 29+ targets ETL, mais leur organisation manque de clarté :

1. **Aide non structurée** : `make help` affiche une longue liste alphabétique de 29 targets sans regroupement logique
2. **Incohérence d'appel** : 3 targets appellent directement des scripts TS (`etl-colors`, `etl-political-positions`, `etl-seed-pe-positions`) au lieu de passer par `package.json`
3. **Script manquant** : `import-amendements.ts` existe mais n'a ni script npm ni target Makefile
4. **Maintenabilité** : Ligne `.PHONY` de 400+ caractères sur une seule ligne, difficile à lire

### Drivers

- **Developer Experience** : Faciliter la découverte des commandes ETL disponibles
- **Cohérence** : Tous les ETL doivent suivre le même pattern (package.json → Makefile)
- **Maintenabilité** : Structure claire et extensible pour les futurs ETL
- **Documentation** : Le Makefile doit être auto-documenté

### Contraintes

- ✅ Rétrocompatibilité : Ne pas casser les scripts existants qui appellent `make etl-xxx`
- ✅ Convention établie : Script npm = `etl:nom`, target Make = `etl-nom`
- ✅ Standard Make : Utiliser des patterns standards et bien documentés

## Décision

Nous choisissons **l'Option 1 : Groupement par catégories avec `##@`** parce que :

1. **Standard bien établi** : Pattern documenté et utilisé largement dans la communauté (sources : Suvash Thapaliya, Xebia, GitHub Gist)
2. **Amélioration immédiate** : `make help` devient structuré et lisible sans changer les commandes
3. **Effort minimal** : 30 minutes d'implémentation, risque très faible
4. **Rétrocompatible** : Aucun breaking change, toutes les commandes existantes restent valides
5. **Maintenabilité excellente** : Facile d'ajouter de nouvelles catégories et targets

### Implémentation

#### 1. Modifier la target `help` (Makefile ligne 26-36)

**Avant** :
```makefile
help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'
```

**Après** :
```makefile
help: ## Affiche cette aide
	@echo ""
	@echo "$(CYAN)NosElus - Commandes disponibles$(RESET)"
	@echo "================================"
	@awk 'BEGIN {FS = ":.*##"; printf "\n"} \
		/^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-30s$(RESET) %s\n", $$1, $$2 } \
		/^##@/ { printf "\n$(YELLOW)%s$(RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Variables d'environnement:$(RESET)"
	@echo "  ETL_DATA_DIR      Répertoire des données (défaut: ./data/assemblee)"
	@echo "  ETL_LEGISLATURE   Législature à importer (défaut: 17)"
	@echo ""
```

#### 2. Ajouter les catégories `##@` dans la section ETL

```makefile
# =============================================================================
# ETL - Import des données
# =============================================================================

##@ ETL - Orchestration

etl-download: ## Télécharge les données de l'Assemblée
etl-all: ## Import complet (organs, actors, mandates, scrutins, votes)
etl-incremental: ## Import incrémental (nouveaux/modifiés uniquement)

##@ ETL - Assemblée Nationale

etl-actors: ## Import des acteurs (députés)
etl-scrutins: ## Import des scrutins et votes
etl-laws: ## Import des dossiers législatifs AN
etl-link-laws: ## Lie les scrutins aux textes (parsing titres)
etl-dossiers-an: ## Import complet dossiers AN avec cosignataires
etl-amendements: ## Import des amendements AN
etl-nosdeputes: ## Import depuis NosDéputés.fr (API)

##@ ETL - Sénat

etl-senat-laws: ## Import des dossiers législatifs Sénat (DOSLEG)
etl-senat-senators: ## Import des sénateurs (API Sénat)
etl-senat-mandates-history: ## Import historique des mandats sénatoriaux

##@ ETL - Parlement Européen

etl-europarl-meps: ## Import des eurodéputés français (ParlTrack)
etl-europarl-historical: ## Import historique eurodéputés (depuis 2004)
etl-europarl-votes: ## Import des votes PE (HowTheyVote.eu)
etl-europarl-laws: ## Import des lois/procédures PE (HowTheyVote.eu)
etl-europarl-law-texts: ## Enrichit les textes des lois PE
etl-pe-enrich-groups: ## Enrichit les noms des groupes PE

##@ ETL - Enrichissement & Analyse

etl-an-classify-scrutins: ## Classifier les scrutins AN par catégorie sémantique
etl-analyze-laws: ## Analyser les lois avec LLM (Ollama)
etl-an-law-texts: ## Import textes complets AN via Légifrance PISTE

##@ ETL - Statistiques d'activité

etl-nosdeputes-stats: ## Statistiques députés (NosDéputés.fr)
etl-senat-nossenateurs-stats: ## Statistiques sénateurs (NosSénateurs.fr)
etl-senat-activity-stats: ## Statistiques sénateurs (senat.fr officiel)
etl-europarl-activity-stats: ## Statistiques eurodéputés (HowTheyVote.eu)

##@ ETL - Configuration & Métadonnées

etl-colors: ## Synchronise les couleurs des groupes
etl-external-colors: ## Import couleurs PE/Sénat (sources externes)
etl-political-positions: ## Import positions politiques (ParlGov)
etl-seed-pe-positions: ## Seed positions PE (Chapel Hill Expert Survey)

##@ ETL - Législatures historiques

etl-leg14: ## Import législature 14 (2012-2017)
etl-leg15: ## Import législature 15 (2017-2022)
etl-leg16: ## Import législature 16 (2022-2024)
etl-leg17: ## Import législature 17 (2024-)
etl-all-legislatures: ## Import toutes les législatures (14→17)
```

#### 3. Réorganiser `.PHONY` en multi-lignes (ligne 7)

**Avant** :
```makefile
.PHONY: help install dev build preview clean clean-cache db-up db-down db-migrate db-push db-studio db-reset etl-download etl-all etl-incremental etl-actors etl-scrutins etl-laws etl-senat-laws [...]
```

**Après** :
```makefile
.PHONY: help install dev build preview clean clean-cache \
        db-up db-down db-migrate db-push db-studio db-generate db-reset \
        etl-download etl-all etl-incremental \
        etl-actors etl-scrutins etl-laws etl-link-laws etl-dossiers-an etl-amendements etl-nosdeputes \
        etl-senat-laws etl-senat-senators etl-senat-mandates-history \
        etl-europarl-meps etl-europarl-historical etl-europarl-votes etl-europarl-laws etl-europarl-activity-stats etl-europarl-law-texts etl-pe-enrich-groups \
        etl-an-classify-scrutins etl-analyze-laws etl-an-analyze-laws etl-europarl-analyze-laws etl-an-law-texts \
        etl-nosdeputes-stats etl-senat-nossenateurs-stats etl-senat-activity-stats \
        etl-colors etl-external-colors etl-political-positions etl-seed-pe-positions \
        etl-leg14 etl-leg15 etl-leg16 etl-leg17 etl-all-legislatures \
        docker-build docker-up docker-down docker-logs docker-restart \
        test test-watch test-ui test-e2e test-all \
        check lint format init init-quick status stats
```

#### 4. Standardiser les appels ETL (package.json)

**Ajouter les scripts npm manquants** :
```json
{
  "scripts": {
    "etl:amendements": "node --import tsx scripts/etl/import-amendements.ts",
    "etl:colors": "node --import tsx scripts/etl/sync-group-colors.ts",
    "etl:political-positions": "node --import tsx scripts/etl/import-political-positions.ts",
    "etl:seed-pe-positions": "node --import tsx scripts/etl/seed-pe-positions.ts"
  }
}
```

**Mettre à jour les targets Makefile** :
```makefile
etl-amendements: ## Import des amendements AN
	@echo "$(CYAN)Import des amendements...$(RESET)"
	npm run etl:amendements

etl-colors: ## Synchronise les couleurs des groupes
	@echo "$(CYAN)Synchronisation des couleurs...$(RESET)"
	npm run etl:colors

etl-political-positions: ## Import positions politiques depuis ParlGov
	@echo "$(CYAN)Import des positions politiques...$(RESET)"
	npm run etl:political-positions -- $(ARGS)

etl-seed-pe-positions: ## Seed positions politiques pour les groupes PE
	@echo "$(CYAN)Seed des positions PE...$(RESET)"
	npm run etl:seed-pe-positions
```

### Trade-offs acceptés

En choisissant cette option, nous acceptons :

1. **Format `##@` spécifique** : Si un jour on change de système de build (ex: Justfile, Task), il faudra migrer
   - Mitigation : Convention largement adoptée, peu de risque d'obsolescence
   
2. **Modification du script `help`** : La regex awk devient légèrement plus complexe
   - Mitigation : Pattern bien documenté, facile à maintenir

3. **Ajout de 4 scripts npm** : Plus d'entrées dans package.json
   - Mitigation : Cohérence et standardisation valent le léger overhead

### Options rejetées

- **Option 2 (Fichiers séparés)** : Rejetée car trop complexe (3-4h effort, maintenance multi-fichiers)
- **Option 3 (Namespace `/`)** : Rejetée car breaking change majeur (toutes les commandes `make etl-xxx` cassées)
- **Option 4 (Commentaires visuels)** : Rejetée car n'améliore pas `make help` (problème principal non résolu)

## Conséquences

### Impacts positifs

1. ✅ **Developer Experience** : `make help` devient lisible et structuré par catégorie
2. ✅ **Découvrabilité** : Les développeurs trouvent facilement les commandes par domaine (AN/Sénat/PE)
3. ✅ **Maintenabilité** : Ajouter un nouvel ETL est trivial (ligne package.json + ligne Makefile + `##@` existant)
4. ✅ **Cohérence** : Tous les ETL suivent le même pattern (`npm run etl:xxx`)
5. ✅ **Documentation** : Le Makefile est auto-documenté, pas besoin de README externe
6. ✅ **Complétude** : `import-amendements.ts` est enfin intégré

### Impacts négatifs (à monitorer)

1. ⚠️ **Ordre d'affichage** : Si un développeur s'attend à un ordre alphabétique strict
   - Action : Mentionner le regroupement par catégorie dans la documentation
   
2. ⚠️ **Maintenance de la catégorisation** : Si de nombreux ETL sont ajoutés, il faudra peut-être subdiviser
   - Action : Monitorer le nombre de targets par catégorie (max ~8 par catégorie recommandé)

### Actions requises

- [x] Modifier la target `help` dans le Makefile
- [x] Ajouter les lignes `##@` de catégorisation
- [x] Réorganiser `.PHONY` en multi-lignes
- [x] Ajouter 4 scripts npm manquants dans package.json
- [x] Ajouter la target `etl-amendements` dans le Makefile
- [x] Mettre à jour les 3 targets avec appels directs TS
- [ ] Tester `make help` et valider le rendu visuel
- [ ] Tester quelques targets ETL pour valider le non-régression
- [ ] Mettre à jour l'index ADR

## Validation

### Checklist de validation

- [x] Les stakeholders ont été consultés (via workflow `/analyze` → `/explore-options`)
- [x] Les contraintes sont respectées (rétrocompatibilité ✅, convention ✅, standard ✅)
- [x] La décision est cohérente avec l'architecture existante (suit `etl-makefile-rule`)
- [x] Les risques sont acceptables et mitigés (risque faible, mitigations identifiées)
- [x] Les alternatives ont été correctement évaluées (5 options scorées)
- [x] La décision est réversible (oui, facile de revenir en arrière si besoin)

### Approbation

**Décision approuvée** : ✅ Oui
**Par** : Équipe développement
**Date** : 2026-02-09
**Commentaires** : Décision unanime, pattern standard et bien documenté, amélioration immédiate de la DX.

## Résultat attendu (`make help`)

```
NosElus - Commandes disponibles
================================

  help                          Affiche cette aide
  install                       Installe les dépendances
  dev                           Lance le serveur de développement
  [...]

ETL - Orchestration
  etl-download                  Télécharge les données de l'Assemblée
  etl-all                       Import complet (organs, actors, mandates, scrutins, votes)
  etl-incremental               Import incrémental (nouveaux/modifiés uniquement)

ETL - Assemblée Nationale
  etl-actors                    Import des acteurs (députés)
  etl-scrutins                  Import des scrutins et votes
  etl-laws                      Import des dossiers législatifs AN
  [...]

ETL - Sénat
  etl-senat-laws                Import des dossiers législatifs Sénat (DOSLEG)
  etl-senat-senators            Import des sénateurs (API Sénat)
  [...]

ETL - Parlement Européen
  etl-europarl-meps             Import des eurodéputés français (ParlTrack)
  etl-europarl-votes            Import des votes PE (HowTheyVote.eu)
  [...]

[autres catégories...]

Variables d'environnement:
  ETL_DATA_DIR      Répertoire des données (défaut: ./data/assemblee)
  ETL_LEGISLATURE   Législature à importer (défaut: 17)
```

## Références

- [Well documented Makefiles - Suvash Thapaliya](https://www.thapaliya.com/en/writings/well-documented-makefiles/)
- [Add a help target to a Makefile (GitHub Gist)](https://gist.github.com/prwhite/8168133)
- [Make your Makefile user-friendly (Medium)](https://medium.com/@vildmedpap/make-your-makefile-user-friendly-create-a-custom-make-help-target-88c9ef130879)
- [Use A Help Target In Your Makefile (Xebia)](https://xebia.com/blog/implement-a-help-target-in-your-makefile/)
- [Makefile Best Practices (Cloud Posse)](https://docs.cloudposse.com/best-practices/developer/makefile/)
- Mémoire SERENA : `etl-makefile-rule.md`
- Mémoire SERENA : `std-etl-cli-scripts.md`

## Voir aussi

- **ADR-008** : Notifications Telegram des ETL (infrastructure complémentaire)
- Pattern : `etl-makefile-rule.md` (convention à respecter lors d'ajout d'ETL)
- Standard : `std-etl-cli-scripts.md` (options CLI obligatoires pour les scripts ETL)
