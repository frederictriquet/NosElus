# Pattern : Dashboard comme Validateur de Qualité de Données

## Catégorie

Data Quality / Monitoring / Dashboard

## Date d'adoption

2026-02-09

## Problème

Les **incohérences de définition** entre composants sont difficiles à détecter :

- Code fonctionne sans erreur
- Tests unitaires passent (chaque composant est correct isolément)
- Bug visible uniquement avec données réelles en production

**Exemple concret (2026-02-09)** :

- Dashboard affichait "100% résumés IA" vs "0% textes complets" pour PE
- Révélait que l'ETL LLM utilisait `isNotNull(description)` alors que le dashboard utilisait `length(description) > 100`

## Contexte

Ce pattern s'applique quand :

- Plusieurs composants utilisent les **mêmes concepts métier** (ex: "texte complet", "actif", "valide")
- Les définitions peuvent diverger silencieusement
- Les incohérences ne causent pas d'erreurs immédiates mais corrompent les données

## Solution

### 1. Dashboard avec Métriques Croisées

Créer des vues dashboard qui **comparent** des métriques qui devraient être cohérentes :

```typescript
// Exemple : Dashboard data-quality
const stats = {
	totalLaws: 1000,
	lawsWithDescription: 800, // count(description IS NOT NULL)
	lawsWithFullText: 600, // count(length(description) > 100)
	lawsWithAISummary: 900, // count(law_summaries)
	lawsWithTags: 850 // count(law_tags)
};
```

**Indicateurs d'incohérence** :

- ✅ `lawsWithAISummary ≤ lawsWithFullText` → Cohérent (pas de résumés sans texte)
- ❌ `lawsWithAISummary > lawsWithFullText` → **INCOHÉRENCE** (résumés générés sans texte complet)

### 2. Colonnes de Pourcentage Comparables

Afficher des pourcentages côte à côte pour faciliter la détection visuelle :

| Legislature | Textes Complets | Résumés IA  | Tags | Votes |
| ----------- | --------------- | ----------- | ---- | ----- |
| AN-17       | 85%             | 80%         | 75%  | 90%   |
| PE-10       | **0%**          | **100%** ❌ | 100% | 50%   |

L'incohérence PE-10 saute aux yeux : impossible d'avoir 100% résumés avec 0% textes.

### 3. Requêtes SQL Alignées

Le dashboard doit utiliser les **mêmes critères** que les composants qu'il surveille :

```sql
-- Dashboard (référence)
SELECT
  COUNT(*) FILTER (WHERE length(description) > 100) as with_full_text,
  COUNT(*) FILTER (WHERE summary IS NOT NULL) as with_ai_summary
FROM laws l
LEFT JOIN law_summaries ls ON l.id = ls.law_id;
```

Si l'ETL utilise un critère différent, l'incohérence sera visible immédiatement dans le dashboard.

## Implémentation

### Étape 1 : Identifier les Concepts Métier Critiques

| Concept             | Où utilisé               | Définition possible                    |
| ------------------- | ------------------------ | -------------------------------------- |
| "Texte complet"     | ETL LLM, Dashboard, Quiz | `length(description) > 100`            |
| "Actif"             | Mandates, Organs         | `end_date IS NULL OR end_date > NOW()` |
| "Vote significatif" | Scrutins, Stats          | `total_votes > 50`                     |

### Étape 2 : Créer des Vues de Cohérence

```typescript
// src/routes/stats/data-quality/+page.server.ts
export const load: PageServerLoad = async () => {
	const cohesionChecks = await db.execute(sql`
    SELECT 
      legislature,
      -- Métrique A
      COUNT(*) FILTER (WHERE condition_a) as metric_a,
      -- Métrique B (devrait être cohérente avec A)
      COUNT(*) FILTER (WHERE condition_b) as metric_b,
      -- Ratio de cohérence
      CASE 
        WHEN metric_a = 0 THEN 100
        ELSE (metric_b::float / metric_a * 100)
      END as cohesion_ratio
    FROM table
    GROUP BY legislature
  `);

	// Alerter si ratio incohérent
	const incoherent = cohesionChecks.filter((c) => c.cohesion_ratio > 100);

	return { cohesionChecks, incoherent };
};
```

### Étape 3 : Affichage avec Alertes Visuelles

```svelte
{#each stats as row}
	<tr class:incoherent={row.ai_summary_pct > row.full_text_pct}>
		<td>{row.legislature}</td>
		<td>{row.full_text_pct}%</td>
		<td>{row.ai_summary_pct}%</td>
		{#if row.ai_summary_pct > row.full_text_pct}
			<td class="alert">⚠️ Incohérence détectée</td>
		{/if}
	</tr>
{/each}

<style>
	.incoherent {
		background: var(--color-error-bg);
	}
	.alert {
		color: var(--color-error);
		font-weight: bold;
	}
</style>
```

## Avantages

✅ **Détection précoce** : Les incohérences sont visibles immédiatement dans le dashboard
✅ **Visuel** : Pas besoin d'analyser des logs, l'œil humain repère l'anomalie
✅ **Référence vivante** : Le dashboard documente les définitions en usage
✅ **Pas de code supplémentaire** : Réutilise les vues existantes
✅ **Monitoring continu** : Chaque consultation du dashboard = validation

## Inconvénients

⚠️ **Nécessite discipline** : Dashboard doit être consulté régulièrement
⚠️ **Réactif, pas préventif** : Détecte après corruption, pas avant
⚠️ **Peut être ignoré** : Si personne ne regarde le dashboard, l'incohérence passe inaperçue

## Cas d'Usage Réels

### Exemple 1 : PE Laws Summaries (2026-02-09)

**Dashboard révèle** :

- PE-10 : 0% textes complets, 100% résumés IA ❌

**Investigation** :

- ETL : `isNotNull(description)` → accepte "Proposition de résolution" (25 chars)
- Dashboard : `length(description) > 100` → rejette les descriptions courtes

**Fix** : Aligner ETL sur la définition du dashboard (référence).

### Exemple 2 : Votes Without Scrutins (hypothétique)

**Dashboard pourrait révéler** :

- AN-17 : 1000 votes individuels, 800 scrutins
- Ratio attendu : ~120 votes/scrutin
- Ratio observé : 1.25 → **Possible data loss** (scrutins manquants)

## Comparaison avec Alternatives

| Approche                             | Détection | Prévention | Coût                      |
| ------------------------------------ | --------- | ---------- | ------------------------- |
| **Dashboard QA** (ce pattern)        | ✅ Rapide | ❌ Non     | Faible                    |
| Tests d'intégration cross-composants | ⚠️ Lent   | ✅ Oui     | Moyen                     |
| Constantes partagées                 | N/A       | ✅ Oui     | Faible                    |
| Type-level constraints               | N/A       | ✅ Oui     | Élevé (TypeScript avancé) |

**Recommandation** : Combiner dashboard QA + constantes partagées pour détection ET prévention.

## Checklist d'Implémentation

Pour créer un dashboard de cohérence :

- [ ] Identifier les concepts métier avec risque d'incohérence
- [ ] Lister tous les composants utilisant ces concepts
- [ ] Extraire les définitions SQL de chaque composant
- [ ] Créer une vue dashboard comparant ces définitions
- [ ] Ajouter des alertes visuelles pour incohérences (> 100%, ratio anormal)
- [ ] Documenter les définitions de référence
- [ ] Ajouter à la routine de review (consulter dashboard avant chaque release)

## Patterns Complémentaires

### Pattern : Constantes Partagées

Pour **prévenir** les incohérences, créer des constantes :

```typescript
// src/lib/server/db/constants.ts
/**
 * Seuil minimal pour considérer une description comme "texte complet".
 */
export const MIN_DESCRIPTION_LENGTH = 100;

// Utiliser partout
if (description && description.length > MIN_DESCRIPTION_LENGTH) {
	// ETL, Dashboard, Quiz utilisent la même constante
}
```

### Pattern : Helper Functions

Encapsuler les critères dans des helpers :

```typescript
// src/lib/server/db/helpers.ts
export function hasFullText(law: Law): boolean {
	return law.description !== null && law.description.length > MIN_DESCRIPTION_LENGTH;
}

// SQL equivalent
export const fullTextFilter = gt(sql`length(${laws.description})`, MIN_DESCRIPTION_LENGTH);
```

## Métriques de Succès

| Indicateur                     | Avant                  | Après (avec dashboard QA) |
| ------------------------------ | ---------------------- | ------------------------- |
| Temps de détection incohérence | Semaines/mois          | Heures/jours              |
| Données corrompues             | 1190 résumés invalides | 0 (détection précoce)     |
| Confiance dans les stats       | Faible                 | Élevée                    |

## Tests de Régression

Après implémentation, tester que le dashboard détecte les incohérences :

```typescript
// test-dashboard-coherence.test.ts
it('should flag incoherence when AI summaries > full texts', () => {
	const stats = {
		fullTextPct: 0,
		aiSummaryPct: 100
	};

	expect(isCoherent(stats)).toBe(false);
});
```

## Exemples d'Utilisation

### Dashboard Data Quality (NosElus)

**Fichier** : `src/routes/stats/data-quality/+page.server.ts`

**Métriques comparées** :

- Textes complets (`length(description) > 100`)
- Résumés IA (`law_summaries` count)
- Tags (`law_tags` count)
- Votes (`scrutins` count)

**Détection visuelle** :

- Tableau avec colonnes % côte à côte
- CSS highlights pour anomalies

## Voir Aussi

- `lessons-learned-2026-02-09-text-complete-definition.md` - Exemple concret
- `database-queries-factorization.md` - Factorisation des requêtes
- `pattern-integration-tests-real-db.md` - Tests pour validation complémentaire

## Références

- Dashboard data-quality : `src/routes/stats/data-quality/`
- Incident PE summaries : Commit `3d6e997`

## Changelog

| Date       | Modification                                        |
| ---------- | --------------------------------------------------- |
| 2026-02-09 | Création suite à détection incohérence PE summaries |
