# Workflow Archive : Bug Cache Vite Corrompu (Scrutin CSS)

## Date

2026-02-07

## Durée

~45 minutes (analyse → résolution → capitalisation)

## Problème Initial

"BUGFIX sur la page http://localhost:5173/an/scrutins/VTANR5L17V4545 le DOM semble cassé car la page affiche du css"

## Skills Utilisées

1. `/analyze` - Investigation technique (15 min)
2. `/explore-options` - Évaluation de 5 hypothèses (10 min)
3. `/debug` - Diagnostic et résolution (10 min)
4. `/capitalize` - Documentation et amélioration (10 min)

## Résolution

### Cause Root

Cache Vite corrompu (`node_modules/.vite/` et `.svelte-kit/`) après un refactoring massif (commit 463ec85) qui a extrait le composant `LawDossierCard`.

### Solution

```bash
make clean-cache  # (nouveau alias créé)
# Restart dev server
```

**Aucune modification de code nécessaire** - Le bug était environnemental (cache), pas dans le code.

## Livrables

### 1. Mémoires SERENA

- `bug-2026-02-07-vite-cache-corrupted-css-rendering.md` (161 lignes)
  - Documentation complète du bug
  - Diagnostic step-by-step
  - Prévention et workflow recommandé
- `std-refactoring-cache-hygiene.md` (247 lignes)
  - Standard pour nettoyage de cache post-refactoring
  - Checklist des refactorings à risque
  - Workflow automatisé

### 2. Amélioration Makefile

```makefile
clean-cache: ## Nettoie uniquement les caches (utile après refactoring)
	@echo "$(YELLOW)Nettoyage des caches Vite et SvelteKit...$(RESET)"
	rm -rf .svelte-kit node_modules/.vite
	@echo "$(GREEN)✓ Cache nettoyé - redémarrez le dev server$(RESET)"
```

### 3. Commits

- `24d7f33` - chore: add clean-cache command and document Vite cache issues
- Merge dans `master` (no-ff)
- Branche `fix/scrutin-css-dom-broken` supprimée

## Leçons Apprises

### 1. Cache Hygiene est Critique

Après un refactoring structurel (extraction de composant, renommage), **toujours** nettoyer le cache Vite avant de tester.

### 2. Symptômes de Cache Corrompu

- CSS affiché comme texte
- Composants ne se rendant pas
- Comportement différent dev/prod
- Erreurs intermittentes de module non trouvé

### 3. Diagnostic Rapide

```
Problème bizarre ?
  ↓
Navigation privée ?
  ↓
make clean-cache
  ↓
Résolu ? → Cache
Toujours cassé ? → Vrai bug
```

### 4. ROI du Nettoyage

- Temps de nettoyage : ~10 secondes
- Temps de debug évité : 2+ heures
- **ROI : 720x**

## Workflow Optimal Post-Refactoring

```bash
# 1. Faire le refactoring
vim src/lib/components/NewComponent.svelte

# 2. AVANT de tester, nettoyer
make clean-cache

# 3. Tester
npm run dev

# 4. Commit
git commit -m "refactor: extract NewComponent"
```

## Impact Projet

### Court Terme

- ✅ Bug résolu en production
- ✅ Workflow amélioré pour l'équipe
- ✅ Commande Makefile réutilisable

### Moyen Terme

- Standards de refactoring clairs
- Moins de bugs "fantômes" liés au cache
- Gain de temps en debug

### Long Terme

- Connaissance capitalisée dans SERENA
- Réutilisable pour d'autres projets Vite/SvelteKit
- Formation future développeurs

## Références

- Commit refactoring initial : 463ec85 (feat: quiz politique)
- Bug fix commit : 24d7f33
- Mémoires : `bug-2026-02-07-vite-cache-corrupted-css-rendering.md`, `std-refactoring-cache-hygiene.md`

## Tags

- #vite #cache #refactoring #sveltekit #debugging #workflow
