# ADR-2026-02-01 : Classification sémantique des scrutins

## Métadonnées
- **Date** : 2026-02-01
- **Statut** : Proposé
- **Contexte** : Phase 1.1 de la roadmap - Typologie des scrutins

## Problème

Les scrutins ont un champ `type` technique (SPO, SPS, MOC, PLN) qui ne permet pas de filtrer/analyser par nature métier (vote final, amendement, procédure, budget, constitutionnel, article).

## Décision

Ajouter une colonne `category` (varchar 30) classifiée automatiquement par analyse regex du champ `title` lors de l'import ETL.

**Taxonomie (6 catégories)** :
1. `vote-final` - Vote sur l'ensemble d'un texte
2. `article` - Vote sur un article spécifique
3. `amendement` - Vote sur un amendement
4. `procédure` - Motion, question de confiance, etc.
5. `budget` - Loi de finances, crédits budgétaires
6. `constitutionnel` - Texte constitutionnel ou organique
7. `autre` - Fallback pour cas non classifiables

**Ordre de priorité** : procédure > constitutionnel > budget > vote-final > amendement > article > autre

**Fonction de classification** :
```typescript
export function classifyScrutin(title: string): string {
  if (/motion de|question de confiance|exception d'irrecevabilité/i.test(title)) return 'procédure';
  if (/constitution|projet de loi constitutionnel|projet de loi organique/i.test(title)) return 'constitutionnel';
  if (/loi de finances|budget|crédits/i.test(title)) return 'budget';
  if (/l'ensemble (du|de la) (projet|proposition)/i.test(title)) return 'vote-final';
  if (/l'amendement n°|les amendements?/i.test(title)) return 'amendement';
  if (/l'article (premier|\d+|unique)|les articles/i.test(title)) return 'article';
  return 'autre';
}
```

## Options considérées

1. **VARCHAR + Regex** (choisie) - Simple, performant, conforme no-hardcoding
2. VARCHAR + Contextuelle (amendmentRef + lawId) - Rejetée : amendmentRef/lawId non renseignés actuellement
3. ENUM PostgreSQL - **Rejetée** : viole règle no-hardcoding
4. JSONB multi-catégories - Rejetée : complexité excessive
5. Vue SQL calculée - Rejetée : performance dégradée
6. Validation manuelle - Gardée pour validation d'échantillon uniquement

## Conséquences

### Positives
- Filtres UI par type de scrutin
- Stats nuancées et défendables
- API enrichie (`?category=vote-final`)
- Performance (colonne indexée)
- Conformité no-hardcoding (SELECT DISTINCT category)

### Négatives
- Dépendance aux formats de titres (mitigé par tests de régression)
- Précision ~95% (mitigé par validation échantillon + monitoring)
- Maintenance des regex (acceptable, logique centralisée)

## Actions

1. Migration Drizzle : colonne `category` varchar(30) + index
2. ETL : fonction `classifyScrutin()` dans mappers
3. Reclassification : script pour 17 881 scrutins existants
4. API : helper `getScrutinCategories()` (dynamique via SELECT DISTINCT)
5. UI : filtres sur /an/scrutins, /pe/scrutins, stats sur /an/stats
6. Validation : échantillon de 200 scrutins (≥95% précision requis)

## Distribution estimée (17 881 scrutins)

- amendement: ~13 941 (78%)
- article: ~2 539 (14%)
- vote-final: ~926 (5%)
- procédure: ~326 (2%)
- constitutionnel: ~78 (<1%)
- budget: ~9 (<1%)
- autre: ~62 (<1%)

## Références

- Roadmap phase 1.1 : `docs/ROADMAP2.md`
- Règle no-hardcoding : `no-hardcoding-rule`
- Règle factorisation DB : `database-queries-factorization`
