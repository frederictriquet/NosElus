# NosElus - Roadmap v2

**Objectif** : Passer d'une logique "vote isolé" à une logique "processus législatif + responsabilité".

**Légende complexité** : 🟢 Simple | 🟡 Moyen | 🔴 Complexe | ⚫ Très complexe

---

## Phase 1 : Fondations analytiques

### 1.1 Typologie des scrutins (priorité haute) ✅ Terminé

| Tâche | Complexité | Statut |
|-------|------------|--------|
| Classifier les scrutins (vote final, article, amendement, procédure, budget, constitutionnel) | 🟡 Moyen | ✅ `src/lib/server/etl/classify.ts` |
| Ajouter le type de scrutin dans la base | 🟢 Simple | ✅ colonne `category` + migration |
| UI : filtres par type de scrutin | 🟢 Simple | ✅ `/an/scrutins` |
| Stats séparées par type de scrutin | 🟡 Moyen | ✅ `/an/stats` |

**Valeur** : Rend les statistiques défendables et nuancées.

**Implémenté** : Classification regex par titre (99% de couverture), helper dynamique `getScrutinCategories()`, filtres et panel de stats.

---

### 1.2 Dissidence intra-groupe ✅ Terminé

| Tâche | Complexité | Statut |
|-------|------------|--------|
| Calculer le taux de dissidence par élu vs son groupe | 🟡 Moyen | ✅ `calculateAutonomyStats()` |
| Identifier les votes clivants en interne (% minorité) | 🟡 Moyen | ✅ `getDivisiveVotes()` |
| UI : indicateur d'autonomie de vote | 🟢 Simple | ✅ `/an/deputes/[id]` panel |
| Page groupe : liste des votes les plus divisifs | 🟡 Moyen | ✅ `/an/groupes/[id]` section |

**Valeur** : Révèle la discipline de parti et les "francs-tireurs".

**Implémenté** : Calcul TypeScript avec cache in-memory (1h), helpers `calculateAutonomyStats()` et `getDivisiveVotes()`, wording neutre "Autonomie de vote" (au lieu de "dissidence"), breakdown par catégorie de scrutin, métrique minorityRate pour votes divisifs.

---

## Phase 2 : Processus législatif

### 2.1 Trajectoire des textes de loi ✅ MVP Terminé

| Tâche | Complexité | Statut |
|-------|------------|--------|
| Modèle de données "dossier législatif" (texte → lectures → votes) | 🟡 Moyen | ✅ `src/lib/server/db/schema/laws.ts` |
| ETL : lier scrutins aux textes (parsing titres) | 🟢 Simple | ✅ `make etl-link-laws` (97.6% couverture) |
| UI : page texte avec chronologie (dépôt → adoption) | 🟡 Moyen | ✅ `/an/laws/[id]` |
| UI : page détail scrutin avec lien vers dossier | 🟢 Simple | ✅ `/an/scrutins/[id]` |
| UI : liste des dossiers législatifs | 🟢 Simple | ✅ `/an/laws` |
| ETL : import complet via API AN (dossiers + cosignataires) | 🟡 Moyen | ✅ `make etl-dossiers-an` |
| UI : visualisation du parcours AN ↔ Sénat ↔ CMP | 🔴 Complexe | ⏳ à faire |

**Valeur** : Sortir du vote isolé, comprendre le processus complet.

**MVP Implémenté** :
- ETL `linkScrutinsByTitle()` : extrait le nom du texte depuis les titres de scrutins
- 874 textes créés, 5121/5244 scrutins liés (97.6%)
- UI : liste `/an/laws`, détail `/an/laws/[id]`, détail scrutin `/an/scrutins/[id]`
- Navigation "Textes" ajoutée

**Option 3 Implémenté** :
- ETL `importDossiersAN()` : import complet depuis les fichiers AN OpenData
- 2213 dossiers importés, 4684 cosignataires (2699 auteurs + 1984 cosignataires)
- Table `law_cosignatories` avec rôle et ordre de signature
- Phase 2.2 débloquée

---

### 2.2 Implication individuelle par texte ✅ Terminé

| Tâche | Complexité | Statut |
|-------|------------|--------|
| Lier cosignataires aux propositions de loi | 🟡 Moyen | ✅ `law_cosignatories` (4684 entrées) |
| Helpers d'agrégation et requêtes | 🟡 Moyen | ✅ `getActorLawsImplication()`, `getLawContributors()` |
| Tests d'intégration | 🟢 Simple | ✅ 11 tests (100% pass) |
| UI : vue "implication" sur page élu | 🟡 Moyen | ✅ Section "Textes signés" avec rôles et compteurs |
| UI : contributeurs sur page texte | 🟡 Moyen | ✅ Section "Contributeurs" groupée par rôle |

**Valeur** : Passer de "a voté pour/contre" à "a contribué activement".

**Implémenté** :
- Helpers factorisés : `getActorLawsImplication()` et `getLawContributors()`
- Page député : Section "Textes signés" avec badges auteur/cosignataire + compteurs
- Page dossier : Section "Contributeurs" groupée par rôle avec liens
- Tests d'intégration validant tous les cas (11 tests, 100% pass)
- Code review appliquée : imports statiques, tri explicite, accessibilité
- Commit d'implémentation : `8eb43d2`

---

## Phase 3 : Thématisation

### 3.1 Classification thématique

| Tâche | Complexité | Dépendances | Statut |
|-------|------------|-------------|--------|
| Définir taxonomie de thèmes (10-15 catégories) | 🟢 Simple | Analyse éditoriale | ✅ 20 tags implémentés |
| Classifier manuellement les 100 scrutins principaux | 🟡 Moyen | Taxonomie | 🔜 Auto via LLM |
| Exploiter les mots-clés officiels des dossiers | 🟡 Moyen | Dossiers importés | 🔜 À faire |
| NLP léger pour suggestion automatique de thème | 🔴 Complexe | Classification manuelle | ✅ LLM Ollama (mistral-nemo) |
| UI : filtres et stats par thème | 🟡 Moyen | Thèmes en base | ✅ Filtre dropdown `/an/laws` + TagBadge |

**Valeur** : Répondre à "Comment X vote sur l'environnement ?".

**Implémentation 2026-02-05** :
- 20 tags référence (économie, santé, environnement, etc.) dans table `tags` avec couleurs
- Migration JSONB → relational `law_tags` (many-to-many) avec `unaccent` pour accent normalization
- UI : dropdown filtre par tag, TagBadge composant réutilisable affichant couleur depuis DB
- LLM : tags dynamiques depuis DB (pas hardcodé), génération auto par mistral-nemo via Ollama
- Batch loading (1+N → 2 queries) pour éviter N+1 sur `/an/laws` et `/debug`
- Commit `7e4c28e` : docs(tags) avec JSDoc + pattern documentation

---

### 3.2 Profils thématiques des élus

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Calculer participation par thème | 🟡 Moyen | Thématisation |
| Calculer dissidence par thème | 🟡 Moyen | Thématisation + dissidence |
| Indice de spécialisation (concentration thématique) | 🟡 Moyen | Stats thématiques |
| UI : radar chart / heatmap thématique sur page élu | 🟡 Moyen | Calculs |

**Valeur** : Profil politique multidimensionnel.

---

## Phase 4 : Analyses avancées

### 4.1 Proximité idéologique individuelle

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Matrice de proximité député ↔ député (cosine similarity) | 🔴 Complexe | Votes existants |
| Projection 2D (PCA ou UMAP) | 🔴 Complexe | Matrice proximité |
| UI : visualisation interactive de l'espace politique | 🔴 Complexe | Projection |
| Trajectoire temporelle d'un élu dans l'espace | ⚫ Très complexe | Projection + historique |

**Valeur** : Carte politique objective basée sur les votes réels.

---

### 4.2 Votes décisifs ✅ DONE (MVP Phase 1)

| Tâche | Complexité | Statut | Notes |
|-------|------------|--------|-------|
| Identifier scrutins à faible majorité (< 10 voix) | 🟢 Simple | ✅ Done | Colonne `scrutins.margin` pré-calculée + index |
| Calculer "poids décisif" de chaque vote individuel | 🟡 Moyen | ✅ Done | Margin Simple (margin ≤ 10) + stats gagnant/perdant |
| Identifier groupes pivot | 🟡 Moyen | ⏳ Phase 2 | Helper `getPivotGroups()` enrichissement futur |
| UI : badge "vote serré" + page `/an/scrutins/serres` | 🟡 Moyen | ✅ Done | Route + filtres + pagination + badges scrutins/députés |

**Valeur** : Mettre en lumière les moments où chaque voix comptait.

**Implémentation décidée** (ADR-2026-02-02) :
- **Formule** : `margin = ABS(total_for - total_against)`, is_tight = margin ≤ 10 voix
- **Wording** : "Vote serré" (neutre, factuel) vs "vote décisif"
- **Seuil** : Paramétrable en UI (5, 10, 20), ~1 800 scrutins détectés
- **Enrichissement Phase 2** : Groupes pivot dont basculement inverse résultat

---

## Phase 5 : Dimension temporelle

### 5.1 Timeline politique

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| UI : frise chronologique par élu | 🟡 Moyen | Données existantes |
| Marquer changements de groupe | 🟢 Simple | Données mandats |
| Détecter ruptures de comportement de vote | 🔴 Complexe | Analyse statistique |
| Corréler avec événements politiques majeurs | 🟡 Moyen | Référentiel événements |

**Valeur** : Comprendre l'évolution politique d'un élu.

---

### 5.2 Comparaisons contextualisées

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Comparer élu vs moyenne de son groupe | 🟢 Simple | Stats groupe |
| Comparer élu vs sa circonscription historique | 🟡 Moyen | Données géo |
| Comparer élu entre législatures | 🟡 Moyen | Données multi-période |
| Comparer positions AN vs Sénat sur même texte | 🟡 Moyen | Dossiers législatifs |

**Valeur** : Contextualiser les positions individuelles.

---

## Phase 6 : Fonctionnalités citoyennes

### 6.1 Suivi personnalisé

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Système de favoris (élus, textes, thèmes) | 🟡 Moyen | Auth optionnelle |
| Alertes par email sur nouveaux votes | 🔴 Complexe | Favoris + email service |
| Flux RSS par élu / thème | 🟡 Moyen | - |

**Valeur** : Engagement citoyen continu.

---

### 6.2 Exports & API

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Export CSV/JSON par élu | 🟢 Simple | - |
| Export CSV/JSON par scrutin / période | 🟢 Simple | - |
| API REST publique (lecture seule) | 🟡 Moyen | - |
| Documentation API interactive (OpenAPI) | 🟡 Moyen | API |

**Valeur** : Réutilisation par chercheurs et journalistes.

---

## Phase 7 : Transparence méthodologique

### 7.1 Documentation

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Page méthodologie par indicateur | 🟢 Simple | Contenu éditorial |
| Expliquer ce que chaque stat mesure ET ne mesure pas | 🟢 Simple | - |
| Documenter les biais connus | 🟢 Simple | - |

**Valeur** : Crédibilité intellectuelle.

---

### 7.2 Indicateurs de fiabilité

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Afficher taux de données manquantes par section | 🟢 Simple | - |
| Indicateur de couverture temporelle | 🟢 Simple | - |
| Différences AN / Sénat / PE clairement indiquées | 🟢 Simple | - |

**Valeur** : Honnêteté sur les limites des données.

---

## Récapitulatif par priorité

### Priorité 1 - Fondations (immédiat)
- ~~Typologie des scrutins~~ ✅
- ~~Dissidence intra-groupe~~ ✅
- Documentation méthodologique

### Priorité 2 - Processus législatif (court terme)
- ~~Dossiers législatifs~~ ✅ MVP (97.6% scrutins liés)
- ~~Implication individuelle par texte~~ ✅ Complété
- Exports données

### Priorité 3 - Thématisation (moyen terme)
- Classification thématique
- Profils thématiques élus
- Votes décisifs

### Priorité 4 - Analyses avancées (long terme)
- Proximité idéologique individuelle
- Timeline politique
- Suivi personnalisé

---

## Anti-features (à éviter)

Pour préserver la crédibilité du projet :

- ❌ Classements "meilleurs / pires députés"
- ❌ Scores uniques agrégés sans contexte
- ❌ Indicateurs normatifs (bien/mal)
- ❌ Simplification excessive de positions complexes
