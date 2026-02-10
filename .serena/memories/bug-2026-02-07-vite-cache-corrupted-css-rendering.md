# Bug : Cache Vite Corrompu Affichant du CSS dans le DOM

## Date

2026-02-07

## Symptômes

- **Observation** : "le DOM semble cassé car la page affiche du css"
- **URL affectée** : `http://localhost:5173/an/scrutins/VTANR5L17V4545`
- **Contexte** : Après un refactoring important (commit 463ec85) qui a extrait du code inline dans un composant réutilisable `LawDossierCard.svelte`
- **Environnement** : Dev server Vite local

## Symptômes observés

1. Page scrutin affiche du CSS comme texte (au lieu de l'appliquer)
2. Le DOM paraît cassé visuellement
3. Le problème apparaît après un refactoring qui déplace du code entre fichiers

## Cause Racine

**Cache Vite corrompu** (`node_modules/.vite/` et `.svelte-kit/`) contenant des artefacts de compilation obsolètes après le refactoring.

Quand on déplace du code entre fichiers (extraction de composant, renommage, etc.), Vite peut garder en cache des versions incompatibles qui causent des rendus incorrects.

## Chemin de Diagnostic

1. **Vérification HTML** : Fetch de la page → CSS présent en `<head>`, structure HTML valide
2. **Vérification DB** : Description de la loi = 50 000 chars de texte clean (pas de HTML, pas de special chars)
3. **Hypothèses explorées** :
   - ❌ HTML injection dans `law.description` → éliminé (pas de tags HTML)
   - ❌ Problème de CSS scope Svelte → structure correcte
   - ✅ **Cache build corrompu** → confirmé
4. **Test du fix** : Nettoyage du cache + restart du serveur → résolu

## Solution

```bash
# 1. Arrêter le dev server (Ctrl+C)

# 2. Nettoyer les caches Vite et SvelteKit
rm -rf .svelte-kit node_modules/.vite

# 3. Redémarrer le dev server
npm run dev
```

**Résultat** : Page s'affiche correctement, CSS appliqué normalement.

## Indicateurs du Problème

### Quand suspecter un cache Vite corrompu ?

- ✅ Bug apparaît après refactoring (déplacement de code)
- ✅ Structures HTML/CSS correctes en inspection
- ✅ Données en DB correctes (pas de pollution)
- ✅ Rendu visuel incohérent avec le code source
- ✅ Erreur difficile à reproduire ou intermittente
- ✅ Build production OK mais dev server cassé (ou inverse)

### Refactorings à risque

| Type de refactoring           | Risque        | Prévention         |
| ----------------------------- | ------------- | ------------------ |
| **Extraction de composant**   | ⚠️ Élevé      | Clear cache après  |
| **Renommage de fichier**      | ⚠️ Élevé      | Clear cache après  |
| **Déplacement de CSS**        | ⚠️ Moyen      | Clear cache après  |
| **Modification imports**      | ⚠️ Moyen      | Restart dev server |
| **Changement de config Vite** | 🔴 Très élevé | **Obligatoire**    |

## Prévention

### 1. Workflow post-refactoring recommandé

```bash
# Après tout refactoring significatif :
make clean      # ou rm -rf .svelte-kit node_modules/.vite
npm run dev     # restart
```

### 2. Ajouter un alias Makefile

```makefile
clean-cache: ## Nettoie les caches Vite et SvelteKit
	@echo "$(YELLOW)Nettoyage des caches de build...$(RESET)"
	rm -rf .svelte-kit node_modules/.vite
	@echo "$(GREEN)✓ Cache nettoyé$(RESET)"
```

### 3. Intégrer au workflow Git

Ajouter un hook post-merge pour détecter les refactorings :

```bash
#!/bin/bash
# .git/hooks/post-merge

# Si des fichiers .svelte ont été renommés/déplacés
if git diff-tree -r --name-status --diff-filter=R HEAD@{1} HEAD | grep -q '\.svelte$'; then
  echo "⚠️  Fichiers Svelte déplacés détectés. Pensez à nettoyer le cache :"
  echo "   make clean-cache"
fi
```

### 4. Checklist de debug

Avant d'investiguer un bug de rendu :

- [ ] Tester en navigation privée (exclure cache navigateur)
- [ ] `rm -rf .svelte-kit node_modules/.vite && npm run dev`
- [ ] Vérifier que le problème persiste

Si le problème disparaît après le nettoyage → c'était le cache.

## Cas Concret : Scrutin VTANR5L17V4545

### Contexte du refactoring

- **Commit** : 463ec85
- **Changement** : Extraction de 412 lignes de code inline dans `LawDossierCard.svelte`
- **Fichiers affectés** :
  - `src/routes/an/scrutins/[id]/+page.svelte` (ancien code supprimé)
  - `src/lib/components/LawDossierCard.svelte` (nouveau composant)

### Manifestation

- Composant `LawDossierCard` ne se rendait pas correctement
- CSS affiché comme texte dans le DOM
- Page de 123 KB (contient une description de loi de 50 000 chars)

### Résolution

1. `rm -rf .svelte-kit node_modules/.vite`
2. Restart dev server
3. ✅ Problème résolu immédiatement

## Comparaison : Cache Vite vs Cache Navigateur

| Symptôme                | Cache Vite      | Cache Navigateur |
| ----------------------- | --------------- | ---------------- |
| CSS manquant            | ✅ Possible     | ✅ Possible      |
| HTML cassé              | ✅ Fréquent     | ❌ Rare          |
| Après refactoring       | ✅ Très courant | ❌ Peu probable  |
| Fix : navigation privée | ❌ N'aide pas   | ✅ Résout        |
| Fix : clean cache Vite  | ✅ Résout       | ❌ N'aide pas    |

## Tags

- **type** : build-cache | rendering | refactoring
- **module** : vite | sveltekit
- **environnement** : development
- **sévérité** : bloquant (dev uniquement)

## Références

- **Commit du refactoring** : 463ec85 (extraction LawDossierCard)
- **Page affectée** : `/an/scrutins/VTANR5L17V4545`
- **Vite cache docs** : https://vitejs.dev/guide/dep-pre-bundling.html#caching
- **SvelteKit generated files** : https://kit.svelte.dev/docs/project-structure#project-files-svelte-kit

## Voir aussi

- `std-code-review-systematic.md` : Checklist de review incluant test après refactoring
- `pattern-component-documentation.md` : Best practices pour extraction de composants

## Note Importante

Ce bug **n'affecte que le dev server**, pas la production build. Cependant, il peut faire perdre beaucoup de temps en debug si on ne connaît pas la cause.

**Règle d'or** : Après tout refactoring qui déplace du code entre fichiers Svelte, **toujours nettoyer le cache Vite**.
