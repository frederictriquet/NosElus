# Règle - Chemins git avec crochets

## Problème

Les chemins SvelteKit contiennent souvent des crochets `[param]` (routes dynamiques).
Le shell zsh interprète `[...]` comme un pattern glob, ce qui cause des erreurs :

```
(eval):1: no matches found: src/routes/an/scrutins/[id]/+page.server.ts
```

## Solution

**TOUJOURS** mettre les chemins contenant des crochets entre guillemets doubles :

```bash
# ❌ INTERDIT
git add src/routes/an/scrutins/[id]/+page.server.ts

# ✅ CORRECT
git add "src/routes/an/scrutins/[id]/+page.server.ts"
```

## Patterns à surveiller

- `[id]`, `[slug]`, `[...rest]` - routes dynamiques SvelteKit
- `[[optional]]` - routes optionnelles
- Tout chemin sous `src/routes/` avec des crochets

## Alternative

Utiliser `git add` avec un pattern glob qui fonctionne :

```bash
# Ajouter tous les fichiers d'un dossier
git add "src/routes/an/scrutins/[id]/"
```
