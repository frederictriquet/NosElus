# Standard : Cache Hygiene Après Refactoring

## Catégorie
Development Workflow | Build System | Best Practices

## Règle

**Après tout refactoring qui déplace, renomme ou restructure des fichiers Svelte/TS, il est OBLIGATOIRE de nettoyer le cache Vite avant de continuer le développement.**

### Commande

```bash
make clean-cache
# ou directement:
rm -rf .svelte-kit node_modules/.vite
```

Puis **redémarrer le dev server**.

## Justification

### Problème

Vite et SvelteKit maintiennent des caches de compilation pour améliorer les performances :
- `node_modules/.vite/` : Pre-bundling des dépendances
- `.svelte-kit/` : Fichiers générés par SvelteKit (routes, types, etc.)

Lors d'un refactoring (renommage, déplacement, extraction de composant), ces caches peuvent devenir **incohérents** :
- Anciens imports toujours en cache
- Références à des fichiers qui n'existent plus
- CSS scope IDs désynchronisés
- Modules dupliqués

**Symptômes typiques** :
- CSS affiché comme texte dans le DOM
- Composants qui ne se rendent pas
- Erreurs de module non trouvé intermittentes
- Comportement différent entre builds dev/prod

### Impact

Un cache corrompu peut causer :
- ❌ **Perte de temps** : Plusieurs heures de debug pour un problème inexistant
- ❌ **Faux positifs** : Croire qu'il y a un bug dans le code alors que c'est le cache
- ❌ **Régression masquée** : Le cache cache une vraie régression jusqu'au build prod

## Refactorings à Risque

| Type de refactoring | Risque | Action |
|---------------------|--------|--------|
| **Renommage de fichier .svelte** | 🔴 Très élevé | Clean cache **obligatoire** |
| **Déplacement de composant** | 🔴 Très élevé | Clean cache **obligatoire** |
| **Extraction de composant** | ⚠️ Élevé | Clean cache **recommandé** |
| **Modification des imports** | ⚠️ Moyen | Restart dev server |
| **Changement de config Vite/SvelteKit** | 🔴 Critique | Clean cache **obligatoire** |
| **Ajout de nouvelle route** | ✅ Faible | Optionnel |
| **Modification de CSS inline** | ✅ Faible | Optionnel |

## Workflow Recommandé

### 1. Avant le refactoring

```bash
# S'assurer que tout est commité
git status

# (Optionnel) Créer une branche
git checkout -b refactor/extract-component
```

### 2. Pendant le refactoring

- Faire les modifications de code
- **NE PAS** tester immédiatement dans le dev server

### 3. Après le refactoring

```bash
# 1. Nettoyer le cache
make clean-cache

# 2. Redémarrer le dev server
npm run dev

# 3. Vérifier que l'app fonctionne
# 4. Commit
git add .
git commit -m "refactor: extract LawDossierCard component"
```

## Exemples

### ✅ Workflow Correct

```bash
# Refactoring: Extraire LawDossierCard de +page.svelte
vim src/lib/components/LawDossierCard.svelte  # Créer nouveau composant
vim src/routes/an/scrutins/[id]/+page.svelte  # Utiliser le composant

# Nettoyer avant de tester
make clean-cache

# Tester
npm run dev
# → Ouvrir http://localhost:5173/an/scrutins/VTANR5L17V4545
# → ✅ Tout fonctionne

git add .
git commit -m "refactor: extract LawDossierCard component"
```

### ❌ Workflow Incorrect

```bash
# Refactoring
vim src/lib/components/LawDossierCard.svelte
vim src/routes/an/scrutins/[id]/+page.svelte

# Tester directement (ERREUR!)
# → Cache corrompu → CSS affiché comme texte
# → 2h de debug pour comprendre que c'est le cache

# Finalement nettoyer
make clean-cache  # Aurait dû être fait AVANT de tester
```

## Checklist de Review

Lors d'une code review, vérifier :

- [ ] Le refactoring implique-t-il des déplacements de fichiers ?
- [ ] L'auteur a-t-il nettoyé le cache avant de tester ?
- [ ] Les tests passent-ils en CI (qui part d'un cache vide) ?
- [ ] Y a-t-il eu des symptômes de cache corrompu signalés ?

Si **oui** à la question 1 et **non** à la question 2 → demander à l'auteur de nettoyer le cache et re-tester.

## Automatisation

### Option 1 : Hook Git post-checkout

```bash
#!/bin/bash
# .git/hooks/post-checkout

# Si on change de branche et que des .svelte ont changé
if git diff --name-status $1..$2 | grep -q '\.svelte$'; then
  echo ""
  echo "⚠️  Fichiers Svelte modifiés détectés."
  echo "   Pensez à nettoyer le cache si problèmes : make clean-cache"
  echo ""
fi
```

### Option 2 : Alias Git

```bash
# .gitconfig ou .git/config
[alias]
  refactor-start = "!f() { git checkout -b refactor/$1 && make clean-cache; }; f"
```

Usage :
```bash
git refactor-start extract-component
# → Crée la branche + nettoie le cache
```

### Option 3 : Script pré-commit (CI)

```yaml
# .github/workflows/ci.yml
- name: Build
  run: |
    rm -rf .svelte-kit node_modules/.vite  # Toujours partir d'un cache vide en CI
    npm run build
```

## Fréquence de Nettoyage

| Situation | Fréquence |
|-----------|-----------|
| Refactoring structurel | **Chaque fois** |
| Changement de branche git | Si problèmes |
| Après `git pull` | Si problèmes |
| Comportement bizarre inexpliqué | **Première action** |
| Démarrage d'une session de dev | Optionnel |
| Quotidiennement | ❌ Non nécessaire |

## Exceptions

**Quand peut-on SKIP le nettoyage ?**

- ✅ Modification de contenu (texte, logique) sans déplacement de fichier
- ✅ Ajout de nouvelles fonctions dans un fichier existant
- ✅ Changement de styles CSS dans le même composant
- ✅ Modification de données (fixtures, seed)

**Quand est-ce OBLIGATOIRE ?**

- 🔴 Renommage ou déplacement de fichiers
- 🔴 Extraction ou fusion de composants
- 🔴 Changement de structure de routes
- 🔴 Modification de `vite.config.ts` ou `svelte.config.js`

## Diagnostic Rapide

**Si vous voyez des symptômes bizarres, suivez ce flowchart** :

```
Problème de rendu bizarre ?
  ↓
Tester en navigation privée
  ↓
Toujours cassé ?
  ↓
make clean-cache && npm run dev
  ↓
Résolu ? → C'était le cache Vite
Toujours cassé ? → Vrai bug de code
```

## Coût du Nettoyage

| Opération | Temps | Impact |
|-----------|-------|--------|
| `make clean-cache` | ~1s | Suppression fichiers |
| Restart dev server | ~5-10s | Recompilation initiale |
| **Total** | **~10s** | vs. 2h de debug d'un cache corrompu |

**ROI** : 10 secondes peuvent sauver des heures.

## Voir aussi

- `bug-2026-02-07-vite-cache-corrupted-css-rendering.md` : Cas concret de cache corrompu
- `std-code-review-systematic.md` : Checklist incluant vérification du cache
- [Vite Dependency Pre-Bundling](https://vitejs.dev/guide/dep-pre-bundling.html#caching)

## Date d'adoption

2026-02-07

## Historique

| Date | Modification |
|------|--------------|
| 2026-02-07 | Création suite au bug de cache corrompu sur scrutin page |
