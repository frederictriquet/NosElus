# Sources de données - Positionnement idéologique des partis

## Contexte

L'ordre des groupes politiques sur l'échiquier gauche-droite est actuellement codé en dur dans `/an/carte/+page.svelte`. Ces sources externes permettraient d'automatiser et d'enrichir ce positionnement.

## Sources disponibles

### 1. ParlGov (recommandé)

Base académique internationale avec grande couverture des partis européens, y compris français.

- **URL** : https://www.parlgov.org/
- **Format** : CSV/DB téléchargeable
- **Contenu** : Partis politiques, élections, gouvernements, sièges
- **Positionnement** : Variables de positionnement idéologique via projets intégrés
- **Couverture** : Multi-pays européens

### 2. Dataset of Ideological Polarization in Western Europe

Projet académique avec positions quantifiées (échelle 0-10) sur l'axe gauche-droite.

- **URL** : https://datafinder.qog.gu.se/dataset/ipwe
- **Format** : Accessible via catalogue QoG / CISE avec codebook
- **Contenu** : Enquêtes d'experts sur positions idéologiques
- **Couverture** : Pays européens dont France

### 3. Manifesto Project / ELFF datasets

Positions des partis dans plusieurs dimensions idéologiques.

- **URL** : https://www.elff.eu/data/
- **Contenu** : Axe économique gauche-droite (variable `econlr`)
- **Usage** : Scores idéologiques exploitables par parti

## Implémentation suggérée

1. **ETL** : Télécharger et importer les données ParlGov
2. **Matching** : Associer les partis ParlGov aux groupes AN via nom/acronyme
3. **Schema** : Ajouter `politicalPosition: number` dans table `organs`
4. **Utilitaire** : Créer `src/lib/utils/political-spectrum.ts` avec fonction de tri

## Code actuel (à remplacer)

```typescript
// src/routes/an/carte/+page.svelte - lignes 18-32
const spectrumOrder = [
	'LFI-NFP',
	'GDR',
	'EcoS',
	'SOC',
	'LIOT', // Gauche
	'Dem',
	'EPR',
	'HOR', // Centre
	'DR',
	'AD',
	'UDR',
	'RN', // Droite
	'NI' // Non-inscrits
];
```

## Priorité

Basse - L'ordre codé en dur fonctionne. À implémenter si besoin de :

- Support multi-législatures (groupes qui changent)
- Cohérence automatique entre pages
- Enrichissement avec données supplémentaires (score précis)

## Date

2026-02-04
