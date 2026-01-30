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
