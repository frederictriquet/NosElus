# Checklist : Transformer ce projet en template

## ✅ Fichiers à nettoyer/préparer

### 1. **package.json**

- [ ] Mettre `name` à une valeur générique : `"{{PROJECT_NAME}}"`
- [ ] Réinitialiser `version` à `"0.0.1"`
- [ ] Mettre `description` vide ou générique
- [ ] Vérifier que toutes les dépendances sont nécessaires

### 2. **README.md**

- [ ] Créer un README template avec sections :
  - Nom du projet (à remplacer)
  - Description du stack technique
  - Instructions d'installation
  - Structure du projet
  - Commandes disponibles
- [ ] Documenter les fonctionnalités incluses

### 3. **Configuration GitHub**

- [ ] Créer `.github/TEMPLATE_SETUP.md` avec instructions post-création
- [ ] Documenter les secrets/variables à configurer
- [ ] Expliquer les workflows inclus

### 4. **Fichiers sensibles**

- [ ] Vérifier que `.env.example` existe (pas de vraies valeurs)
- [ ] Pas de données sensibles dans les configs
- [ ] Pas de tokens/API keys

### 5. **Git**

- [ ] Nettoyer `.release-please-manifest.json` (version 0.0.1)
- [ ] Supprimer `CHANGELOG.md` s'il existe
- [ ] `.gitignore` bien configuré

### 6. **Docker**

- [ ] `docker-compose.yml` avec valeurs génériques
- [ ] Variables d'environnement bien documentées
- [ ] Image Docker générique

### 7. **Tests**

- [ ] Exemples de tests unitaires
- [ ] Exemples de tests e2e
- [ ] Configuration Stryker fonctionnelle

### 8. **Documentation**

- [ ] Guide de démarrage rapide
- [ ] Architecture du projet
- [ ] Standards de code (Husky, conventions)
- [ ] Guide CI/CD

## 🎯 Choix de la méthode

### Option A : GitHub Template Repository (Simple)

**Avantages :**

- ✅ Aucune modification nécessaire
- ✅ Bouton "Use this template" sur GitHub
- ✅ Intégration native

**Inconvénients :**

- ❌ Pas de personnalisation automatique
- ❌ Il faut modifier manuellement après génération

**Idéal pour :** Templates simples, petites équipes

---

### Option B : CLI avec prompts (Avancé)

**Avantages :**

- ✅ Personnalisation interactive
- ✅ Remplace automatiquement les valeurs
- ✅ Expérience développeur optimale

**Inconvénients :**

- ❌ Nécessite maintenance du CLI
- ❌ Plus complexe à mettre en place

**Idéal pour :** Usage fréquent, grandes équipes

---

## 📝 Fichiers à créer pour un bon template

### 1. README_TEMPLATE.md

Template de README pour les nouveaux projets

### 2. .github/TEMPLATE_SETUP.md

Instructions de configuration post-génération :

- Configuration GitHub (permissions, secrets)
- Configuration locale (npm install, etc.)
- Premier commit
- Premier déploiement

### 3. docs/ARCHITECTURE.md

- Structure des dossiers
- Choix techniques
- Patterns utilisés

### 4. docs/DEVELOPMENT.md

- Workflow de développement
- Conventions de code
- Tests
- CI/CD

### 5. CONTRIBUTING.md (optionnel)

Si le template sera partagé/open-source

---

## 🚀 Plan d'action recommandé

### Phase 1 : Nettoyage (15 min)

1. Nettoyer package.json (nom générique, version 0.0.1)
2. Créer README template complet
3. Vérifier qu'aucune donnée sensible n'est committée

### Phase 2 : Documentation (30 min)

1. Créer TEMPLATE_SETUP.md
2. Documenter les workflows CI/CD
3. Créer documentation architecture

### Phase 3 : Configuration GitHub (5 min)

1. Activer "Template repository" dans Settings
2. Ajouter topics/tags pour discoverability
3. Tester la création d'un nouveau projet

### Phase 4 : Amélioration continue

1. Créer des issues pour les améliorations futures
2. Versionner le template (tags Git)
3. Tenir un CHANGELOG des features du template

---

## 📊 Fonctionnalités déjà incluses dans ce template

✅ **Frontend**

- SvelteKit 5 avec TypeScript
- Vite pour le build
- Adapter Node pour production

✅ **Tests**

- Vitest (tests unitaires)
- Playwright (tests e2e)
- Stryker (tests de mutation)
- Coverage configuré

✅ **Qualité de code**

- Husky (hooks Git)
- Commitlint (messages conventionnels)
- Prettier (formatage)
- lint-staged (checks pré-commit)
- svelte-check (TypeScript)

✅ **CI/CD GitHub Actions**

- Workflow CI complet
- Build & push Docker automatique
- Release Please (versioning sémantique)
- Caching optimisé

✅ **Docker**

- Dockerfile multi-stage optimisé
- docker-compose.yml
- .dockerignore configuré
- Build multi-plateforme

✅ **Documentation**

- Guide setup GitHub Actions
- Convention des commits
- README des workflows
- README Husky

---

## 🎨 Personnalisations post-génération

Après avoir créé un projet depuis ce template, l'utilisateur devra :

1. **Renommer le projet**
   - `package.json` → `name`
   - `release-please-config.json` → `package-name`
   - README.md → titre et description

2. **Configurer GitHub**
   - Permissions GitHub Actions
   - Secrets si nécessaire
   - Protection de branche

3. **Adapter aux besoins**
   - Ajouter/retirer des dépendances
   - Configurer les variables d'environnement
   - Personnaliser les workflows

---

## ✅ Checklist finale avant publication

- [ ] Toutes les dépendances sont à jour
- [ ] Tous les tests passent
- [ ] Le build fonctionne
- [ ] Docker build fonctionne
- [ ] Documentation complète et claire
- [ ] Aucune donnée sensible
- [ ] README attractif avec badges
- [ ] Topics GitHub ajoutés
- [ ] License choisie (MIT recommandé)
- [ ] Template repository activé

---

## 💡 Améliorations futures possibles

### Court terme

- [ ] Script d'initialisation post-génération
- [ ] Choix d'options (CSS framework, state management, etc.)
- [ ] Exemples de composants réutilisables

### Long terme

- [ ] CLI interactif (`npx create-sveltebase`)
- [ ] Plusieurs variantes du template (minimal, full, etc.)
- [ ] Documentation interactive
- [ ] Exemples d'intégrations (Supabase, Auth, etc.)
