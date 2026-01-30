# Règle fondamentale - Interdiction du hardcoding

**RÈGLE ABSOLUE** : Aucune donnée métier ne doit être hardcodée dans le code. Le code doit pouvoir accepter de nouvelles données sans aucune modification.

## Ce qui est INTERDIT de hardcoder

### Données temporelles / Périodes
- ❌ Listes de législatures (12, 13, 14, 15, 16, 17)
- ❌ Listes de termes PE (6, 7, 8, 9, 10)
- ❌ Années de renouvellement du Sénat (2023, 2020, 2017...)
- ❌ Dates de début/fin de mandats ou périodes
- ❌ Année courante ou "actuelle" en dur

### Entités politiques
- ❌ Noms de groupes politiques
- ❌ Codes/abréviations de partis
- ❌ Couleurs de groupes
- ❌ Mappings entre identifiants

### Données de référence
- ❌ Listes de chambres (AN, Sénat, PE)
- ❌ Types de mandats
- ❌ Régions, départements, circonscriptions
- ❌ Seuils ou constantes métier spécifiques à une période

## Ce qui est OBLIGATOIRE

### Sources de données
- ✅ Récupérer les données depuis la base de données
- ✅ Détecter dynamiquement via des requêtes SQL (ex: `EXTRACT(YEAR FROM startDate)`)
- ✅ Utiliser des seuils configurables ou logiques (ex: "au moins 70 mandats = renouvellement")
- ✅ Importer depuis les sources officielles (APIs, dumps)

### Gestion des valeurs "courantes"
- ✅ Le "courant" = le plus récent en base (tri DESC, LIMIT 1)
- ✅ Utiliser `endDate IS NULL` pour identifier les mandats en cours
- ✅ Calculer dynamiquement plutôt que stocker un flag "isCurrent"

### Architecture
- ✅ Fonctions async qui requêtent la DB
- ✅ Cache avec expiration (ex: 1 heure) pour éviter les requêtes répétitives
- ✅ Scripts ETL pour ajouter de nouvelles données sans toucher au code applicatif

## Exemple concret - Renouvellements du Sénat

```typescript
// ❌ INTERDIT
const RENOUVELLEMENTS = [
  { value: '2023', label: '2023 (en cours)' },
  { value: '2020', label: '2020' },
  // ...
];

// ✅ CORRECT
const result = await db
  .select({
    year: sql`EXTRACT(YEAR FROM ${mandates.startDate})::int`,
    minDate: sql`MIN(${mandates.startDate})`,
    maxEndDate: sql`MAX(${mandates.endDate})`
  })
  .from(mandates)
  .where(and(eq(actors.chamber, 'SENAT'), eq(mandates.type, 'senateur')))
  .groupBy(sql`EXTRACT(YEAR FROM ${mandates.startDate})`)
  .having(sql`COUNT(*) >= 70`) // Seuil logique, pas une liste hardcodée
  .orderBy(desc(...));
```

## Test de validation

Avant de valider du code, se poser la question :
> "Si on importe des données de 2030 demain, est-ce que ce code fonctionnera sans modification ?"

Si la réponse est non, le code doit être refactoré.

## Voir aussi
- `group-colors-rule` : Règle spécifique pour les couleurs de groupes politiques
