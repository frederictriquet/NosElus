# Git Hooks avec Husky

Ce projet utilise [Husky](https://typicode.github.io/husky/) pour gérer les hooks Git automatiquement.

## Hooks configurés

### 1. `pre-commit` - Vérifications avant commit

Exécute automatiquement **lint-staged** avant chaque commit pour :

✅ **Vérifier les types TypeScript** sur les fichiers modifiés (`.ts`, `.js`, `.svelte`)
✅ **Formater automatiquement** les fichiers avec Prettier

**Fichiers concernés :**

- `*.{js,ts,svelte}` → Type checking avec `svelte-check`
- `*.{js,ts,svelte,css,md,json}` → Formatage avec Prettier

**Configuration :** Voir `lint-staged` dans [package.json](../package.json)

---

### 2. `commit-msg` - Validation du message de commit

Valide que vos messages de commit suivent le format [Conventional Commits](https://www.conventionalcommits.org/) pour :

✅ Permettre le **versioning sémantique automatique**
✅ Générer automatiquement les **changelogs**
✅ Maintenir un **historique Git clair**

**Format requis :**

```
<type>(<scope>): <subject>

[body optionnel]

[footer optionnel]
```

**Types autorisés :**

- `feat` : Nouvelle fonctionnalité (bump version mineure)
- `fix` : Correction de bug (bump version patch)
- `docs` : Documentation uniquement
- `style` : Formatage, point-virgules manquants, etc.
- `refactor` : Refactoring de code
- `perf` : Amélioration de performance
- `test` : Ajout ou correction de tests
- `build` : Changements du système de build
- `ci` : Changements de la CI
- `chore` : Tâches de maintenance
- `revert` : Revert d'un commit précédent

**Exemples valides :**

```bash
git commit -m "feat: add user authentication"
git commit -m "fix: resolve navigation bug on mobile"
git commit -m "docs: update API documentation"
git commit -m "feat(auth): implement OAuth login"
git commit -m "feat!: breaking change in API"
```

**Exemples invalides :**

```bash
git commit -m "Add feature"           # ❌ Pas de type
git commit -m "feat:add feature"      # ❌ Pas d'espace après ':'
git commit -m "Feat: add feature"     # ❌ Type en majuscule
git commit -m "feature: add feature"  # ❌ Type invalide
```

**Configuration :** Voir [commitlint.config.js](../commitlint.config.js)

---

## Comment ça fonctionne ?

### Installation automatique

Quand quelqu'un clone le projet et exécute `npm install`, les hooks sont automatiquement installés via le script `prepare: "husky"` dans package.json.

### Désactivation temporaire (non recommandé)

Si vous devez absolument bypasser les hooks (⚠️ déconseillé) :

```bash
# Bypasser tous les hooks
git commit --no-verify -m "message"

# Ou désactiver temporairement
git config core.hooksPath /dev/null
# ... faire vos commits ...
# Puis réactiver
git config core.hooksPath .husky/_
```

### Vérification manuelle

Vous pouvez tester les hooks manuellement :

```bash
# Tester lint-staged
npx lint-staged

# Tester commitlint sur le dernier commit
npx commitlint --from HEAD~1 --to HEAD --verbose

# Tester commitlint sur un message
echo "feat: test message" | npx commitlint
```

---

## Dépannage

### Hook pre-commit échoue

**Cause :** Erreurs de type checking ou formatage

**Solution :**

1. Vérifier les erreurs TypeScript : `npm run check`
2. Formater manuellement : `npx prettier --write .`
3. Corriger les erreurs et recommitter

### Hook commit-msg échoue

**Cause :** Message de commit non conforme

**Solution :**

1. Vérifier le format du message (voir exemples ci-dessus)
2. Utiliser le bon type parmi la liste autorisée
3. Ne pas capitaliser le type ni le sujet
4. Ajouter un espace après les deux-points

### Les hooks ne s'exécutent pas

**Cause :** Husky non initialisé

**Solution :**

```bash
npm run prepare  # Réinstalle les hooks
git config core.hooksPath .husky/_  # Force le chemin des hooks
```

---

## Ressources

- [Husky Documentation](https://typicode.github.io/husky/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Commitlint](https://commitlint.js.org/)
- [lint-staged](https://github.com/okonet/lint-staged)
- [Guide des commits](../.github/COMMIT_CONVENTION.md)
