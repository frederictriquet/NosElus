# NosElus - Roadmap v2

**Objectif** : Passer d'une logique "vote isolé" à une logique "processus législatif + responsabilité".

**Légende complexité** : 🟢 Simple | 🟡 Moyen | 🔴 Complexe | ⚫ Très complexe

---

## Phase 1 : Fondations analytiques

### 1.1 Typologie des scrutins (priorité haute)

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Classifier les scrutins (vote final, article, amendement, procédure, budget, constitutionnel) | 🟡 Moyen | Analyse des données existantes |
| Ajouter le type de scrutin dans la base | 🟢 Simple | Classification |
| UI : filtres par type de scrutin | 🟢 Simple | Données typées |
| Stats séparées par type de scrutin | 🟡 Moyen | UI filtres |

**Valeur** : Rend les statistiques défendables et nuancées.

---

### 1.2 Dissidence intra-groupe

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Calculer le taux de dissidence par élu vs son groupe | 🟡 Moyen | Données existantes |
| Identifier les votes clivants en interne (écart-type élevé) | 🟡 Moyen | Calcul dissidence |
| UI : badge "frondeur" / indicateur de loyauté | 🟢 Simple | Calculs |
| Page groupe : liste des votes les plus divisifs | 🟡 Moyen | Votes clivants |

**Valeur** : Révèle la discipline de parti et les "francs-tireurs".

---

## Phase 2 : Processus législatif

### 2.1 Trajectoire des textes de loi

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Modèle de données "dossier législatif" (texte → lectures → votes) | 🔴 Complexe | Conception |
| ETL : importer les dossiers législatifs AN | 🔴 Complexe | Modèle données |
| ETL : lier scrutins existants aux dossiers | 🟡 Moyen | Dossiers importés |
| UI : page texte avec chronologie (dépôt → adoption) | 🔴 Complexe | Données liées |
| UI : visualisation du parcours AN ↔ Sénat ↔ CMP | 🔴 Complexe | Page texte |

**Valeur** : Sortir du vote isolé, comprendre le processus complet.

---

### 2.2 Implication individuelle par texte

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Lier cosignataires aux propositions de loi | 🟡 Moyen | Dossiers législatifs |
| Lier amendements aux élus et aux textes | 🟡 Moyen | ETL amendements |
| Agréger : cosignature + amendements + votes par élu/texte | 🟡 Moyen | Données liées |
| UI : vue "implication" sur page élu et page texte | 🟡 Moyen | Agrégation |

**Valeur** : Passer de "a voté pour/contre" à "a contribué activement".

---

## Phase 3 : Thématisation

### 3.1 Classification thématique

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Définir taxonomie de thèmes (10-15 catégories) | 🟢 Simple | Analyse éditoriale |
| Classifier manuellement les 100 scrutins principaux | 🟡 Moyen | Taxonomie |
| Exploiter les mots-clés officiels des dossiers | 🟡 Moyen | Dossiers importés |
| NLP léger pour suggestion automatique de thème | 🔴 Complexe | Classification manuelle |
| UI : filtres et stats par thème | 🟡 Moyen | Thèmes en base |

**Valeur** : Répondre à "Comment X vote sur l'environnement ?".

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

### 4.2 Votes décisifs

| Tâche | Complexité | Dépendances |
|-------|------------|-------------|
| Identifier scrutins à faible majorité (< 10 voix) | 🟢 Simple | Données existantes |
| Calculer "poids décisif" de chaque vote individuel | 🟡 Moyen | Scrutins serrés |
| Identifier groupes pivot | 🟡 Moyen | Analyse coalitions |
| UI : badge "vote décisif" + page dédiée | 🟡 Moyen | Calculs |

**Valeur** : Mettre en lumière les moments où chaque voix comptait.

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
- Typologie des scrutins
- Dissidence intra-groupe
- Documentation méthodologique

### Priorité 2 - Processus législatif (court terme)
- Dossiers législatifs
- Implication individuelle par texte
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
