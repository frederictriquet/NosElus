# Feature : Recherche de lois par auteur et mots-clés

**Date** : 2026-02-26
**Contexte** : L'utilisateur veut retrouver des lois par le nom du parlementaire qui l'a proposée (ex: "loi Duplomb") ou par mots-clés thématiques (ex: "néonicotinoïdes").

## État des lieux actuel

### Base de données

- **16 723 lois** dans la table `laws` (AN + Sénat)
- **4 683 cosignatories** dans `law_cosignatories` (2 699 authors, 1 984 cosignatories)
  - ⚠️ **Uniquement des acteurs AN** (IDs PA\*), aucun sénateur
- **1 443 law_summaries** (résumés IA)
- **2 902 law_tags** assignments (20 tags, 1 416 lois)
- **4 640 lois** avec description, **8 147** avec thème

### Recherche existante

- `/recherche` : Recherche globale — acteurs, groupes, scrutins. **PAS les lois.**
- `/an/laws?q=...` : Recherche locale via `ILIKE` sur `laws.title` uniquement
- `/api/v1/search` : API REST — acteurs, organs, scrutins. **PAS les lois.**
- Aucun index full-text (`tsvector`) n'existe sur les lois

### Lien parlementaire → loi

- **Député AN** (`/an/deputes/[id]`) : ✅ `loadLawsImplication()` via `getActorLawsImplication()` — fonctionne, affiche les lois author/cosignatory
- **Sénateur** (`/senat/senateurs/[id]`) : ❌ Pas de `loadLawsImplication()` dans la page sénateur
- **Eurodéputé** (`/pe/eurodeputes/[id]`) : Non applicable (pas de lois françaises)

### Données auteurs Sénat

- Le CSV Sénat (DOSLEG) ne contient **PAS** les noms d'auteurs — seulement 10 colonnes : titre, type, date, URL, état, CC, date CC, date promulgation, numéro, thèmes
- Les pages HTML du Sénat contiennent l'auteur (ex: "de M. Daniel SALMON et plusieurs de ses collègues") mais pas structuré
- Le Sénat publie un dump PostgreSQL complet de DOSLEG qui pourrait contenir des tables d'auteurs
- Le champ `initiator` sur les lois Sénat = "parlement" ou "gouvernement" (pas le nom)

---

## Piste 1 : Ajouter les lois à la recherche globale

### Complexité : FAIBLE

### Fichiers à modifier

1. `src/routes/recherche/+page.server.ts` — ajouter requête sur `laws`
2. `src/routes/recherche/+page.svelte` — ajouter section "Lois" dans le template
3. `src/routes/api/v1/search/+server.ts` — ajouter `type='laws'`

### Détail

- Ajouter une requête `ILIKE` sur `laws.title` (et potentiellement `laws.description`, `laws.theme`)
- Limiter à 20 résultats comme les autres sections
- Afficher titre, type, status, date de dépôt
- Ajouter "loi" dans le placeholder de recherche
- Très peu de risque, s'intègre naturellement

### Modèle de résultat

```typescript
laws?: Array<{ id: string; title: string; shortTitle: string | null; type: string; status: string | null; depositDate: string | null; legislature: string }>
```

---

## Piste 2 : Enrichir les cosignatories avec données Sénat

### Complexité : HAUTE

### Problème fondamental

Le CSV open data du Sénat ne contient PAS les auteurs des textes.

### Options identifiées

#### Option A : Dump PostgreSQL DOSLEG du Sénat

- Le Sénat publie un dump PostgreSQL complet
- Potentiellement des tables d'association auteur↔dossier
- **Inconnu** : faut télécharger le dump (~?) et inspecter son schéma
- **Risque** : le schéma peut ne pas avoir cette info non plus

#### Option B : Scraping des pages HTML dossier

- Chaque page dossier contient le nom d'auteur en texte libre (ex: "de M. Daniel SALMON et plusieurs de ses collègues")
- Parsing fragile du HTML
- ~8 000 dossiers Sénat à scraper → lent et coûteux
- Matching nom ↔ actor_id par fuzzy/ILIKE sur `actors.last_name`
- **Risque** : format HTML peut changer, pas de cosignataires détaillés sur la page principale

#### Option C : API Sénat (si elle existe)

- L'API publique `senat.fr/api-senat/` est limitée aux sénateurs en exercice
- Pas d'endpoint connu pour les dossiers législatifs détaillés
- À investiguer plus en profondeur

#### Recommandation

Commencer par **Option A** (inspecter le dump DOSLEG). Si pas d'auteurs dedans, considérer le scraping ciblé sur les lois promulguées uniquement (sous-ensemble plus petit et plus utile).

---

## Piste 3 : Full-text search PostgreSQL (tsvector/tsquery)

### Complexité : MOYENNE

### Pourquoi c'est mieux que ILIKE

- **ILIKE** : pas de stemming, pas de ranking, scan séquentiel, mono-mot à la fois
- **tsvector** : stemming français (néonicotinoïde → néonicotinoïd), ranking par pertinence, index GIN ultra-rapide, multi-mots avec AND/OR

### Test réel effectué (2026-02-26)

```sql
-- Fonctionne parfaitement :
SELECT l.id, l.title, ts_rank(
  to_tsvector('french', coalesce(l.title, '') || ' ' || coalesce(l.description, '') || ' ' || coalesce(l.theme, '')),
  plainto_tsquery('french', 'néonicotinoïde pesticide')
) as rank
FROM laws l
WHERE to_tsvector('french', ...) @@ plainto_tsquery('french', 'néonicotinoïde pesticide')
ORDER BY rank DESC
-- → 5 résultats pertinents, classés par pertinence
```

### Plan d'implémentation

1. **Migration Drizzle** : Ajouter colonne `search_vector tsvector` sur `laws`
   ```sql
   ALTER TABLE laws ADD COLUMN search_vector tsvector;
   UPDATE laws SET search_vector =
     to_tsvector('french', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(theme, ''));
   CREATE INDEX laws_search_idx ON laws USING GIN (search_vector);
   ```
2. **Trigger** : `CREATE TRIGGER laws_search_update BEFORE INSERT OR UPDATE ON laws FOR EACH ROW EXECUTE FUNCTION tsvector_update_trigger(search_vector, 'pg_catalog.french', title, description, theme);`
3. **Enrichissement optionnel** : Inclure `law_summaries.summary` dans le vecteur via JOIN pour les lois qui en ont
4. **Code** : Remplacer `ILIKE` par `plainto_tsquery('french', ...)` avec `ts_rank()` pour le tri

### Champs à indexer

- `laws.title` (toujours rempli, 16 723 lois)
- `laws.description` (4 640 lois)
- `laws.theme` (8 147 lois)
- Optionnel : `law_summaries.summary` (1 443 lois) — nécessite un trigger ou une vue matérialisée

### Avantage pour le use case "Duplomb"

- Recherche "duplomb néonicotinoïde" → match les deux termes simultanément avec ranking
- Recherche "pesticide abeille" → match via stemming même si le mot exact n'apparaît pas

---

## Piste 4 : Lier la fiche parlementaire à ses lois

### Complexité pour AN : DÉJÀ FAIT ✅

- `src/routes/an/deputes/[id]/+page.server.ts:365` → `loadLawsImplication()`
- Helper : `getActorLawsImplication(actorId, limit)` dans `helpers.ts:1108`
- Fonctionne via `law_cosignatories` JOIN `laws`

### Complexité pour Sénat : FAIBLE (si données cosignatories existent)

- Ajouter `loadLawsImplication` dans `src/routes/senat/senateurs/[id]/+page.server.ts`
- Réutiliser le même helper `getActorLawsImplication(params.id, 20)`
- Ajouter la section dans le template Svelte
- **Bloqué** par : absence de données cosignatories pour les sénateurs (voir Piste 2)

### Alternative sans cosignatories : recherche par nom dans titre

- Certaines lois portent le nom du sénateur dans leur titre (ex: "loi Duplomb")
- On pourrait faire un ILIKE sur `laws.title` avec le `last_name` du sénateur
- **Problème** : beaucoup de faux négatifs (la plupart des lois ne mentionnent pas le nom de l'auteur dans le titre)
- **Problème** : faux positifs possibles (homonymes)
- Ce serait un palliatif, pas une solution structurelle

---

## Recommandation d'ordonnancement

| Priorité | Piste                                 | Effort | Valeur  | Dépendances               |
| -------- | ------------------------------------- | ------ | ------- | ------------------------- |
| 1        | Piste 1 : Lois dans recherche globale | Faible | Haute   | Aucune                    |
| 2        | Piste 3 : Full-text search            | Moyen  | Haute   | Aucune (améliore Piste 1) |
| 3        | Piste 4 : Lien sénateur→lois          | Faible | Moyenne | Piste 2 pour le Sénat     |
| 4        | Piste 2 : Cosignatories Sénat         | Haute  | Moyenne | Investigation dump DOSLEG |

Pistes 1 et 3 peuvent être faites indépendamment et immédiatement.
Piste 4 côté Sénat est bloquée par Piste 2 (données manquantes).
