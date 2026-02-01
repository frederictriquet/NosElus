# Exploration : Métriques de Dissidence Intra-Groupe

## Date : 2026-02-01

## Problème
Calculer et afficher la dissidence des députés par rapport à leur groupe parlementaire sur ~2M votes et 17k scrutins.

## Options évaluées

### 1. Calcul à la volée + cache in-memory - ✅ RETENUE
**Verdict** : Retenue
**Raison** : Pattern déjà établi dans le projet (legislatures, terms), simple, flexible, maintainable

**Architecture** :
```typescript
let cachedDissidence: Map<string, DissidenceStats> = new Map();
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 heure

export async function calculateDissidenceRate(actorId, groupId, filters) {
  const cacheKey = `${actorId}_${groupId}_${JSON.stringify(filters)}`;
  if (cachedDissidence.has(cacheKey) && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedDissidence.get(cacheKey)!;
  }
  // Calcul SQL optimisé
  const result = await db.select(...)...;
  cachedDissidence.set(cacheKey, result);
  return result;
}
```

**Avantages** :
- Simplicité maximale (pattern existant)
- Fraîcheur des données (TTL 1h)
- Flexibilité filtres dynamiques
- Maintenance nulle (pas de jobs)

**Index DB utilisés** : ✅ `votes_group_id_idx`, `votes_scrutin_actor_idx` (déjà présents)

### 2. Table matérialisée (actor_group_stats) - ❌ REJETÉE
**Verdict** : Rejetée
**Raison** : Sur-ingénierie, complexité de maintenance (jobs ETL), staleness des données

### 3. Vue matérialisée PostgreSQL - ❌ REJETÉE
**Verdict** : Rejetée
**Raison** : Complexité migration SQL brute, refresh manuel, difficile à déboguer

### 4. Hybride (cache + précalcul) - ⚠️ ENVISAGEABLE
**Verdict** : Envisageable si Option 1 insuffisante
**Raison** : Plus complexe mais meilleures perfs pour listes globales

---

## Métrique de Clivage retenue : % de minorité

**Calcul** : `(minorityCount / totalVotes) * 100`

**Exemple** : "35% des députés du groupe ont voté contre la majorité"

**Justification** :
- Intuitif pour l'utilisateur
- Simple à calculer en SQL
- Facile à expliquer en page méthodologie

**Alternatives rejetées** :
- Écart-type : trop abstrait (valeur 0-0.816)
- Indice de Gini : trop complexe, peu intuitif

---

## Wording UI retenu : "Autonomie" + "Divergence"

**Labels** :
- Panel : "Autonomie de vote"
- Métrique : "Taux de divergence avec le groupe : 12%"
- Badge : "Vote autonome" (au lieu de "Frondeur")
- Tooltip : "Pourcentage de votes où le député diffère de la majorité de son groupe"

**Justification** :
- Neutre et factuel (pas de jugement)
- Cohérent avec objectif crédibilité intellectuelle
- Évite connotation négative de "dissidence"

**Alternatives rejetées** :
- "Dissidence" : connotation négative
- "Indépendance" : confusion avec "sans étiquette"

---

## Dimensionnement du problème

**Volumétrie DB** :
- Scrutins : 17,881
- Votes : 1,994,302
- Votes avec group_id : 1,990,719 (99.8% ✅)

**Performance estimée** :
- Requête dissidence 1 député : ~200-500ms (première fois)
- Avec cache : ~1-5ms
- Requête top 20 frondeurs groupe : ~500-1000ms

**Optimisations prévues** :
- AsyncCard pour panels > 500ms
- Index DB existants ✅
- Cache in-memory TTL 1h
- Requêtes SQL avec `EXPLAIN ANALYZE`

---

## Leçons apprises

1. **Pattern cache in-memory** efficace pour calculs coûteux sur données stables
2. **Réutiliser patterns existants** > inventer nouvelles solutions
3. **Wording neutre** critique pour métriques politiques sensibles
4. **Métriques intuitives** > métriques statistiquement "parfaites"
5. **KISS** : Éviter sur-ingénierie (jobs ETL, vues matérialisées) si solution simple existe

---

## Références dans le projet

**Pattern cache existant** :
- `src/lib/server/periods/an-legislatures.ts:17-27`
- `src/lib/server/periods/pe-terms.ts:20-31`
- `src/lib/server/periods/senat-renouvellements.ts:20-31`

**Helper réutilisable** :
- `getGroupMajorityPosition()` - `src/lib/server/api/helpers.ts:151-171`

**UI AsyncCard** :
- `src/lib/components/AsyncCard.svelte`
- Utilisé sur `/an/stats`, `/an/deputes/[id]`, `/an/groupes/[id]`
