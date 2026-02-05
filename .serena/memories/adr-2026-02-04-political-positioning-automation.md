# ADR-004 : Automatisation du positionnement politique des partis

**Date** : 2026-02-04  
**Statut** : Accepté  
**Décideurs** : Équipe technique NosElus  
**Tags** : #ETL #data-quality #no-hardcoding #parlgov #fuzzy-matching

---

## Contexte

### Problème

Les pages `/an/carte` et `/pe/carte` contiennent des tableaux hardcodés (`spectrumOrder`) avec 71 identifiants/noms de groupes politiques pour ordonner les partis sur l'échiquier gauche-droite.

**Fichiers concernés** :
- `src/routes/an/carte/+page.svelte` : 33 IDs hardcodés (lignes 18-32)
- `src/routes/pe/carte/+page.svelte` : 38 IDs hardcodés (lignes 19-38)

**Violation** : Cette approche viole la règle `no-hardcoding-rule` qui stipule que toute donnée métier doit provenir de la base de données et que le code doit fonctionner sans modification quand de nouveaux partis apparaissent.

**Test de conformité échoué** : "Si nous importons des données de 2030 demain, le code doit fonctionner sans modification" → ÉCHEC

### Besoin

- Éliminer tout hardcoding de positionnement politique
- Permettre l'ajout de nouveaux partis via ETL uniquement (sans toucher au code)
- Fournir un ordre cohérent basé sur des données académiques reconnues
- Solution pérenne fonctionnant sur plusieurs années/législatures

### Contraintes

- Accès DB uniquement via `./scripts/db-query.sh` (règle CLAUDE.md)
- Infrastructure ETL existante avec 23 scripts (pattern établi)
- Pattern Fuzzy Jaccard déjà implémenté (`pattern-jaccard-title-matching.md`)
- Utilisation de Drizzle ORM pour les accès base

---

## Décision

**Nous adoptons ParlGov comme source de données pour le positionnement politique, avec matching automatique par similarité Fuzzy Jaccard et stockage dans une colonne `political_position` de la table `organs`.**

### Architecture retenue

#### 1. Source de données : **ParlGov**

- **Format** : CSV téléchargeable directement
- **URL** : https://www.parlgov.org/
- **Contenu** : 1700+ partis européens avec scores gauche-droite (0-10)
- **Méthodologie** : Enquêtes d'experts académiques
- **Maintenance** : Mises à jour régulières, projet actif depuis 2009

#### 2. Algorithme de matching : **Fuzzy Jaccard avec normalisation NLP**

- **Pattern existant** : `pattern-jaccard-title-matching.md` (succès 90%+)
- **Normalisation** :
  - Lowercase
  - Suppression accents
  - Suppression mots vides (stop words)
  - Suppression ponctuation
- **Seuil** : 0.4 (40% de similarité minimum)
- **Bonus** : +20% pour mots longs (8+ caractères), +20% pour années communes

#### 3. Stockage : **Colonne dans table `organs`**

- **Colonne** : `political_position REAL`
- **Migration** : `ALTER TABLE organs ADD COLUMN political_position REAL;`
- **Valeurs** : 0.0 (extrême gauche) → 10.0 (extrême droite)
- **NULL** : Autorisé pour partis non matchés

#### 4. Stratégie de fallback : **Heuristiques**

- **Non-inscrits (NI)** : `position = 999` (fin de liste)
- **Partis inconnus** : `position = 5.0` (centre par défaut)
- **Ordre final** : Tri par `political_position ASC NULLS LAST`

---

## Options considérées

### Option 1 : Choix de la source

| Option | Score | Avantages | Inconvénients |
|--------|-------|-----------|---------------|
| **1A. ParlGov** ✅ | **4.8/5** | Format simple (CSV), 1700+ partis, documentation claire, projet actif | Positions statiques (pas d'évolution dans le temps) |
| 1B. IPWE/QoG | 3.3/5 | Focus polarisation | Accès complexe, moins parties, documentation fragmentée |
| 1C. ELFF/Manifesto | 3.0/5 | Multi-dimensionnel | Complexité élevée, formats multiples, overhead |

### Option 2 : Algorithme de matching

| Option | Score | Avantages | Inconvénients |
|--------|-------|-----------|---------------|
| 2A. Exact matching | 2.5/5 | Simple, rapide | Taux de succès <50% (variantes de noms) |
| **2B. Fuzzy Jaccard** ✅ | **4.4/5** | Pattern existant, 90%+ succès, robuste aux variantes | Requiert normalisation NLP |
| 2C. Semi-automatique | 4.0/5 | 100% précision | Table de mapping manuelle à maintenir |

### Option 3 : Stockage

| Option | Score | Avantages | Inconvénients |
|--------|-------|-----------|---------------|
| **3A. Colonne `political_position`** ✅ | **4.5/5** | Simple, requêtes rapides, pas de JOIN | Pas d'historique des changements |
| 3B. Table séparée | 3.2/5 | Historique, versioning | Complexité accrue, JOIN requis |

### Option 4 : Gestion des non-matchés

| Option | Score | Avantages | Inconvénients |
|--------|-------|-----------|---------------|
| 4A. Position par défaut (999) | 3.0/5 | Simple | Perd info pour NI légitimes |
| 4B. Dernière valeur connue | 3.5/5 | Continuité | Complexe pour nouveaux partis |
| **4C. Heuristiques (NI=999, défaut=5.0)** ✅ | **4.3/5** | Équilibre logique/simplicité | Positions centrées pas toujours justes |

---

## Justification

### Pourquoi ParlGov ?

1. **Simplicité d'intégration** : CSV direct, pas d'API à maintenir
2. **Couverture** : 1700+ partis européens incluant tous les partis français majeurs
3. **Fiabilité académique** : Projet universitaire reconnu, enquêtes d'experts
4. **Documentation** : Codebook clair, méthodologie transparente
5. **Maintenance** : Actif depuis 2009, mises à jour régulières

**Score total** : 4.8/5 (vs 3.3 pour IPWE, 3.0 pour ELFF)

### Pourquoi Fuzzy Jaccard ?

1. **Pattern éprouvé** : Déjà implémenté et validé (90%+ succès sur matching titres lois)
2. **Robustesse** : Gère les variantes de noms ("La France Insoumise" ↔ "LFI-NFP")
3. **Pas de dépendance externe** : Pas de ML, pas d'API tierce
4. **Maintenance faible** : Code stable, tests existants

**Score total** : 4.4/5 (vs 2.5 pour exact, 4.0 pour semi-auto)

### Pourquoi colonne dans `organs` ?

1. **Conformité au schéma** : Attribut intrinsèque d'un groupe politique
2. **Performance** : Pas de JOIN supplémentaire pour chaque requête
3. **Simplicité** : `ORDER BY political_position ASC` direct
4. **Cohérence** : Même pattern que `color`, `shortName`

**Trade-off accepté** : Pas d'historique des changements de position → Acceptable car positions changent peu à l'échelle décennale

---

## Conséquences

### Positives ✅

1. **Conformité `no-hardcoding-rule`** : Plus aucun positionnement hardcodé
2. **Extensibilité automatique** : Nouveaux partis gérés par ETL uniquement
3. **Cohérence inter-pages** : `/an/carte` et `/pe/carte` utilisent la même logique
4. **Traçabilité** : Données sourcées, méthodologie académique transparente
5. **Maintenabilité** : Changement de source possible sans refonte code métier

### Négatives ⚠️

1. **Maintenance ETL** : Script d'import à maintenir et exécuter régulièrement
2. **Dépendance externe** : Si ParlGov disparaît, migration vers autre source nécessaire
3. **Matching imparfait** : ~10% de partis non matchés automatiquement (fallback heuristique)
4. **Pas d'historique** : Changement de position d'un parti écrase la valeur précédente

### Atténuations des risques

- **Dépendance ParlGov** : Données CSV archivables localement + architecture permettant changement de source
- **Matching imparfait** : Table de mapping manuelle pour cas complexes (future itération)
- **Pas d'historique** : Acceptable pour MVP, table séparée envisageable si besoin futur

---

## Implémentation

### Fichiers à créer

1. **ETL Script** : `scripts/etl/import-political-positions.ts`
   - Téléchargement CSV ParlGov
   - Parsing et normalisation
   - Matching Fuzzy Jaccard avec `organs`
   - Upsert des positions

2. **Utilitaire** : `src/lib/utils/political-spectrum.ts`
   - Fonction `sortByPoliticalPosition(groups: Organ[]): Organ[]`
   - Heuristiques de fallback (NI, centre)
   - Tests unitaires inclus

3. **Types** : `src/lib/server/etl/sources/parlgov/types.ts`
   - Interfaces pour données ParlGov

4. **Migration** : `migrations/XXXX-add-political-position-to-organs.sql`
   ```sql
   ALTER TABLE organs ADD COLUMN political_position REAL;
   CREATE INDEX idx_organs_political_position ON organs(political_position);
   ```

### Modifications de code

1. **`src/routes/an/carte/+page.svelte`** (lignes 18-32)
   - **AVANT** : Tableau `spectrumOrder` hardcodé (33 IDs)
   - **APRÈS** : `sortedGroups = sortByPoliticalPosition(data.groups)`

2. **`src/routes/pe/carte/+page.svelte`** (lignes 19-38)
   - **AVANT** : Tableau `spectrumOrder` hardcodé (38 IDs)
   - **APRÈS** : `sortedGroups = sortByPoliticalPosition(data.groups)`

3. **`src/lib/server/db/schema/organs.ts`**
   - Ajout : `politicalPosition: real('political_position')`

### Tests requis

- ✅ Matching Fuzzy Jaccard (>90% succès)
- ✅ Heuristiques fallback (NI, centre)
- ✅ Tri avec NULL/NaN
- ✅ Intégration DB (migration + query)

### Acceptance criteria

- [ ] Plus aucun hardcoding de positionnement dans le code
- [ ] ETL script exécutable et testé
- [ ] Migration DB appliquée en production
- [ ] Pages `/an/carte` et `/pe/carte` affichent ordre cohérent
- [ ] Tests unitaires passent (>90% coverage)
- [ ] Documentation à jour (`political-spectrum.test.ts`)

---

## Alternatives futures

Si ParlGov devient insuffisant :

1. **Enrichissement** : Combiner ParlGov + IPWE pour polarisation temporelle
2. **Machine Learning** : Classifier positions via analyse texte manifestes (ELFF)
3. **Crowdsourcing** : Interface admin pour ajuster positions manuellement
4. **Historique** : Migrer vers table séparée `organ_positions(organ_id, date, position)`

Critères de réévaluation :
- Taux de matching <80% sur nouveaux partis
- Demande utilisateur pour historique des évolutions
- Disponibilité d'une source plus complète/récente

---

## Références

- **Memories SERENA** :
  - `.serena/memories/no-hardcoding-rule.md`
  - `.serena/memories/datasources-political-positioning.md`
  - `.serena/memories/pattern-jaccard-title-matching.md`
  - `.serena/memories/etl-makefile-rule.md`

- **Sources externes** :
  - ParlGov : https://www.parlgov.org/
  - IPWE Dataset : https://datafinder.qog.gu.se/dataset/ipwe
  - ELFF Manifesto : https://www.elff.eu/data/

- **Code existant** :
  - ETL infrastructure : `scripts/etl/` (23 scripts)
  - Fuzzy matching : Pattern établi (titres lois AN-Légifrance)

---

## Historique des décisions

| Date | Changement | Raison |
|------|------------|--------|
| 2026-02-04 | Décision initiale | Violation `no-hardcoding-rule` identifiée |

---

**Prochaine revue prévue** : Après 3 mois d'utilisation en production (mai 2026)
