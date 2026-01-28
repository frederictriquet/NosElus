# 🚀 Configuration Post-Template

Bienvenue ! Vous venez de créer un nouveau projet depuis le template NosElus. Suivez ce guide pour le configurer correctement.

---

## ⏱️ Temps estimé : 15 minutes

---

## 📋 Étape 1 : Initialisation locale (5 min)

### 1.1 Installer les dépendances

```bash
npm install
```

Cela va automatiquement :

- ✅ Installer toutes les dépendances
- ✅ Configurer Husky (hooks Git)
- ✅ Préparer SvelteKit

### 1.2 Personnaliser le projet

Exécutez le script d'initialisation :

```bash
./init-project.sh mon-projet "Description de mon projet"
```

Ou manuellement, modifiez les fichiers suivants :

#### **package.json**

```json
{
	"name": "mon-projet", // ← Changez ici
	"description": "Description", // ← Ajoutez une description
	"version": "0.0.1"
}
```

#### **release-please-config.json**

```json
{
	"packages": {
		".": {
			"package-name": "mon-projet" // ← Changez ici
		}
	}
}
```

#### **README.md**

- Remplacez le titre par le nom de votre projet
- Adaptez la description
- Mettez à jour les badges avec votre username/repo

#### **docker-compose.yml** (optionnel)

```yaml
services:
  app:
    container_name: mon-projet  // ← Changez ici
```

### 1.3 Variables d'environnement

```bash
cp .env.example .env
# Éditez .env avec vos valeurs
```

### 1.4 Tester le setup

```bash
# Tests unitaires
npm run test

# Build
npm run build

# Démarrer le serveur
npm run dev
```

---

## 🔧 Étape 2 : Configuration GitHub (10 min)

### 2.1 Créer le repository GitHub

```bash
# Via GitHub CLI
gh repo create mon-projet --private --source=. --remote=origin --push

# Ou manuellement sur github.com, puis :
git remote add origin https://github.com/<username>/mon-projet.git
git push -u origin master
```

### 2.2 ⚠️ Configuration OBLIGATOIRE : Permissions GitHub Actions

**Sans cette configuration, Release Please ne fonctionnera pas !**

1. Allez sur votre repository GitHub
2. **Settings** → **Actions** → **General**
3. Section **"Workflow permissions"** :
   - ✅ Sélectionnez **"Read and write permissions"**
   - ✅ Cochez **"Allow GitHub Actions to create and approve pull requests"**
4. Cliquez sur **Save**

![Configuration](https://docs.github.com/assets/cb-52221/mw-1440/images/help/repository/actions-workflow-permissions-repository.webp)

### 2.3 Protection de branche (Recommandé)

1. **Settings** → **Branches**
2. **Add branch protection rule**
3. Branch name pattern : `master`
4. Activez :
   - ✅ **Require a pull request before merging**
   - ✅ **Require status checks to pass before merging**
     - Ajoutez : `CI / quality-checks`
     - Ajoutez : `CI / build`
   - ✅ **Require branches to be up to date before merging**
5. **Create**

### 2.4 Topics GitHub (Optionnel mais recommandé)

Ajoutez des topics pour rendre votre projet découvrable :

- **Settings** → **About** → **Topics**
- Suggestions : `sveltekit`, `typescript`, `docker`, `ci-cd`, `template`

---

## ✅ Étape 3 : Vérification (1 commit)

### 3.1 Premier commit

```bash
git add .
git commit -m "chore: initial setup from template"
git push origin master
```

### 3.2 Vérifier les workflows

1. Allez sur **Actions** dans votre repo GitHub
2. Vous devriez voir 3 workflows en cours :
   - ✅ **CI** - Tests et qualité
   - ✅ **Docker Build & Publish** - Build de l'image
   - ✅ **Release Please** - Création de la PR de release

### 3.3 Si tout fonctionne

- ✅ Les workflows CI et Docker passent au vert
- ✅ Release Please crée automatiquement une PR nommée "chore(master): release 0.0.1"

---

## 🎯 Étape 4 : Workflow de développement

### 4.1 Créer une branche de feature

```bash
git checkout -b feat/ma-nouvelle-feature
```

### 4.2 Développer

```bash
npm run dev  # Démarrer le serveur de développement
```

### 4.3 Committer

Les hooks Husky vont automatiquement :

1. **pre-commit** : Vérifier les types et formater le code
2. **commit-msg** : Valider le format du message

```bash
git add .
git commit -m "feat: add my new feature"
```

Si le commit échoue, vérifiez :

- Format du message (type valide, espace après `:`)
- Pas d'erreurs TypeScript
- Code bien formaté

### 4.4 Pusher et créer une PR

```bash
git push origin feat/ma-nouvelle-feature
```

Puis créez une Pull Request vers `master` sur GitHub.

### 4.5 Merger et release

1. Mergez la PR
2. Release Please met automatiquement à jour sa PR de release
3. Quand vous êtes prêt, mergez la PR de release
4. → Une release GitHub est créée automatiquement !
5. → Une image Docker est publiée avec le tag de version !

---

## 🐳 Étape 5 : Docker (Optionnel)

### 5.1 Pull l'image publiée

```bash
docker pull ghcr.io/<username>/mon-projet:latest
```

### 5.2 Rendre l'image publique (optionnel)

Par défaut, l'image est privée. Pour la rendre publique :

1. Allez sur votre profil GitHub
2. **Packages**
3. Sélectionnez votre package
4. **Package settings** → **Change visibility** → **Public**

---

## 📊 Checklist complète

### Configuration initiale

- [ ] `npm install` exécuté
- [ ] `package.json` personnalisé (name, description)
- [ ] `release-please-config.json` mis à jour
- [ ] `README.md` adapté au projet
- [ ] `.env` créé depuis `.env.example`
- [ ] Tests passent (`npm test`)
- [ ] Build fonctionne (`npm run build`)

### Configuration GitHub

- [ ] Repository créé sur GitHub
- [ ] Code pushé sur `master`
- [ ] Permissions Actions configurées (Read/Write + PR)
- [ ] Protection de branche activée
- [ ] Topics ajoutés

### Vérification

- [ ] Workflow CI passe
- [ ] Workflow Docker passe
- [ ] Release Please crée une PR
- [ ] Hooks Husky fonctionnent

---

## 🆘 Problèmes fréquents

### "GitHub Actions is not permitted to create or approve pull requests"

**Solution :** Activez les permissions dans Settings → Actions → General

### Hooks Husky ne fonctionnent pas

```bash
npm run prepare  # Réinstalle les hooks
git config core.hooksPath .husky/_
```

### Docker build échoue

1. Vérifiez que le build local fonctionne : `npm run build`
2. Testez le Dockerfile localement : `docker build .`
3. Consultez les logs dans GitHub Actions

### Tests e2e échouent

1. Les tests e2e nécessitent les navigateurs Playwright
2. Localement : `npx playwright install --with-deps`
3. En CI, c'est automatique

---

## 📚 Ressources

- [Guide de configuration GitHub](./SETUP_GITHUB.md)
- [Convention des commits](./COMMIT_CONVENTION.md)
- [Documentation des workflows](../workflows/README.md)
- [Hooks Git](../.husky/README.md)
- [Architecture du projet](../docs/ARCHITECTURE.md)

---

## 🎉 C'est terminé !

Votre projet est maintenant configuré et prêt à être développé avec :

- ✅ Tests automatiques
- ✅ CI/CD complet
- ✅ Versioning sémantique
- ✅ Publication Docker automatique
- ✅ Qualité de code garantie

**Bon développement ! 🚀**

---

## 💡 Prochaines étapes suggérées

1. **Ajouter des composants Svelte** dans `src/lib/components/`
2. **Créer vos routes** dans `src/routes/`
3. **Écrire des tests** pour votre code
4. **Configurer des variables d'environnement** selon vos besoins
5. **Ajouter des dépendances** selon votre stack (DB, auth, etc.)

Consultez la [documentation SvelteKit](https://kit.svelte.dev/docs) pour plus d'informations.
