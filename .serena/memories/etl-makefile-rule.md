# Règle ETL - Mise à jour du Makefile

**IMPORTANT** : À chaque ajout d'un script d'import ETL dans `package.json`, il faut **toujours** mettre à jour le `Makefile` :

1. Ajouter la nouvelle cible à la liste `.PHONY` (ligne ~7)
2. Créer la cible avec description `## ...` dans la section ETL (après ligne ~89)

## Exemple

Si on ajoute dans package.json :

```json
"etl:nouvelle-source": "node --import tsx scripts/etl/import-nouvelle-source.ts"
```

Il faut ajouter dans Makefile :

```makefile
# Dans .PHONY (ajouter à la ligne des etl-*)
etl-nouvelle-source

# Dans la section ETL
etl-nouvelle-source: ## Import depuis nouvelle source
	@echo "$(CYAN)Import depuis nouvelle source...$(RESET)"
	npm run etl:nouvelle-source
```

## Convention de nommage

- Script npm : `etl:nom-source` (avec deux-points)
- Cible Make : `etl-nom-source` (avec tiret)
- **IMPORTANT** : Le nom après `npm run` dans le Makefile doit correspondre EXACTEMENT au nom dans package.json

## Checklist complète (ajout d'un ETL)

1. ✅ Script dans `scripts/etl/`
2. ✅ Entrée dans `package.json` (`etl:nom-source`)
3. ✅ Target dans `Makefile` (`etl-nom-source`) — nom npm EXACT
4. ✅ Target dans `.PHONY`
5. ✅ Check dans `src/lib/server/etl/checks.ts` — métrique SQL + construction check
6. ✅ Vérifier que le `command` du check pointe vers la target et que la métrique SQL mesure ce que la target modifie

## Bug connu corrigé (2026-02-11)

`etl-europarl-enrich-groups` appelait `npm run etl:pe-enrich-groups` (inexistant). Corrigé en `npm run etl:europarl-enrich-groups`. Les noms incohérents entre Makefile et package.json sont des bugs silencieux.
