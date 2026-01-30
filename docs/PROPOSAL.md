# NosElus - Propositions de fonctionnalités

**Légende complexité :** 🟢 Simple (1-2 jours) | 🟡 Moyen (3-5 jours) | 🔴 Complexe (1-2 semaines) | ⚫ Très complexe (2+ semaines)

---

## 1. Enrichissement des données existantes

### 1.1 Assemblée Nationale

| Fonctionnalité | Source de données | Complexité |
|----------------|-------------------|------------|
| **Amendements détaillés** : Afficher les amendements par député avec auteur, contenu, statut | `data.assemblee-nationale.fr/travaux-parlementaires/amendements` (JSON) - déjà importés en base | 🟡 Moyen - UI à créer, données existantes |
| **Questions parlementaires** : Intégrer questions écrites/orales avec réponses ministérielles | `data.assemblee-nationale.fr/travaux-parlementaires/questions` (JSON) | 🟡 Moyen - nouvel ETL + UI |
| **Interventions en séance** : Timeline des prises de parole en hémicycle | `data.assemblee-nationale.fr/travaux-parlementaires/debats` (XML) | 🔴 Complexe - parsing XML volumineux |
| **Rapports parlementaires** : Liste des rapports rédigés par chaque député | `data.assemblee-nationale.fr/travaux-parlementaires/rapports` (JSON) | 🟡 Moyen - nouvel ETL + UI |

### 1.2 Sénat

| Fonctionnalité | Source de données | Complexité |
|----------------|-------------------|------------|
| **Scraping votes sénatoriaux** : Extraire les votes depuis les comptes-rendus de séance | Comptes-rendus analytiques sur senat.fr (HTML) - scraping non structuré | ⚫ Très complexe - parsing HTML non structuré, fiabilité incertaine |
| **Commissions d'enquête** : Intégrer les travaux des commissions d'enquête | `data.senat.fr` - liste commissions disponible | 🟡 Moyen - nouvel ETL + UI |
| **Questions d'actualité** : Vidéos et transcriptions | Vidéos sur senat.fr, pas d'API structurée | 🔴 Complexe - scraping vidéos + transcription |

### 1.3 Parlement Européen

| Fonctionnalité | Source de données | Complexité |
|----------------|-------------------|------------|
| **Hémicycle complet** : Afficher tous les 720 MEPs (pas seulement français) | ParlTrack dump complet (tous pays) ou europarl.europa.eu API | 🟡 Moyen - ETL existant à adapter |
| **Commissions PE** : Participation aux commissions européennes | ParlTrack dump (champ `Committees`) | 🟢 Simple - données déjà dans dump |
| **Rapports législatifs** : Textes rapportés par les eurodéputés français | europarl.europa.eu/doceo ou ParlTrack | 🟡 Moyen - nouvel ETL |

---

## 2. Analyse et visualisations avancées

### 2.1 Analyses de vote

| Fonctionnalité | Source de données | Complexité |
|----------------|-------------------|------------|
| **Analyse par thème** : Classifier les scrutins par thématique (économie, santé, écologie...) | Données existantes + classification manuelle ou NLP sur titres | 🔴 Complexe - taxonomie à définir, classification semi-auto |
| **Votes clés** : Identifier et mettre en avant les scrutins les plus importants | Données existantes + critères éditoriaux (participation élevée, résultat serré) | 🟡 Moyen - algorithme de scoring + curation |
| **Prédiction de vote** : ML pour prédire le vote probable d'un député sur un nouveau texte | Données existantes (historique votes) | ⚫ Très complexe - modèle ML, entraînement, évaluation |
| **Analyse de cohésion** : Évolution de la cohésion des groupes dans le temps | Données existantes | 🟢 Simple - calcul sur données existantes |

### 2.2 Visualisations

| Fonctionnalité | Source de données | Complexité |
|----------------|-------------------|------------|
| **Graphe de proximité** : Network graph interactif des relations entre élus | Données existantes (votes communs) | 🔴 Complexe - calcul matrice + lib graph (D3/Sigma) |
| **Carte géographique** : Visualisation des circonscriptions avec résultats électoraux | GeoJSON circonscriptions (data.gouv.fr) + données existantes | 🟡 Moyen - intégration Leaflet + données géo |
| **Timeline interactive** : Frise chronologique de l'activité parlementaire | Données existantes | 🟡 Moyen - composant timeline custom ou lib |
| **Hémicycle animé** : Visualisation des votes en temps réel | Données existantes | 🔴 Complexe - animation SVG complexe |

### 2.3 Comparaisons

| Fonctionnalité | Source de données | Complexité |
|----------------|-------------------|------------|
| **Multi-comparateur** : Comparer 3+ élus simultanément | Données existantes | 🟡 Moyen - extension du comparateur existant |
| **Comparaison inter-chambres** : Comparer député vs sénateur vs eurodéputé | Données existantes - mais votes Sénat manquants | 🟢 Simple pour AN/PE, impossible pour Sénat |
| **Évolution temporelle** : Comparer un élu avec lui-même sur différentes législatures | Données existantes (mandats historiques) | 🟡 Moyen - requêtes multi-période |

---

## 3. Fonctionnalités utilisateur

### 3.3 Accessibilité

| Fonctionnalité | Source de données | Complexité |
|----------------|-------------------|------------|
| **Mode sombre** : Thème dark mode | Aucune - CSS uniquement | 🟢 Simple - CSS variables |
| **Mode haut contraste** : Accessibilité visuelle | Aucune - CSS uniquement | 🟢 Simple - CSS variables |
| **Navigation clavier** : Support complet clavier | Aucune - code existant | 🟡 Moyen - audit + corrections |
| **Lecteur d'écran** : Optimisation ARIA | Aucune - code existant | 🟡 Moyen - audit ARIA + corrections |

---

## 5. Fonctionnalités collaboratives

### 5.1 Contributions

| Fonctionnalité | Source de données | Complexité |
|----------------|-------------------|------------|
| **Signalement d'erreurs** : Permettre aux utilisateurs de signaler des incohérences | Aucune - nouveau système | 🟡 Moyen - formulaire + stockage + admin |
| **Annotations communautaires** : Commentaires modérés sur les scrutins | Aucune - nouveau système | 🔴 Complexe - auth + modération + stockage |
| **Fact-checking** : Liens vers vérifications de faits | Sources externes (AFP Factuel, Les Décodeurs...) | 🟡 Moyen - curation manuelle ou API partenaire |

### 5.2 Éducation civique

| Fonctionnalité | Source de données | Complexité |
|----------------|-------------------|------------|
| **Glossaire** : Définitions des termes parlementaires | Contenu éditorial à créer | 🟢 Simple - page statique markdown |
| **Tutoriels** : Guide d'utilisation de la plateforme | Contenu éditorial à créer | 🟢 Simple - pages markdown |
| **Quiz** : Tests de connaissance civique | Contenu éditorial + logique quiz | 🟡 Moyen - composant quiz interactif |

---

## 6. Performance et qualité

### 6.2 Monitoring

| Fonctionnalité | Source de données | Complexité |
|----------------|-------------------|------------|
| **Analytics** : Suivi d'usage (Plausible/Matomo) | Aucune - intégration service tiers | 🟢 Simple - ajout script |
| **Alertes erreurs** : Sentry ou équivalent | Aucune - intégration service tiers | 🟢 Simple - SDK Sentry |
| **Uptime monitoring** : Surveillance disponibilité | Aucune - service tiers (UptimeRobot, Better Uptime) | 🟢 Simple - configuration externe |
| **Performance tracking** : Core Web Vitals | Aucune - intégration web-vitals lib | 🟢 Simple - ajout reporting |

---

## Résumé par complexité

### 🟢 Simple (1-2 jours) - 10 items
- Analyse de cohésion dans le temps
- Commissions PE
- Comparaison inter-chambres AN/PE
- Mode sombre
- Mode haut contraste
- Glossaire
- Tutoriels
- Analytics
- Alertes erreurs
- Uptime monitoring
- Performance tracking

### 🟡 Moyen (3-5 jours) - 14 items
- Amendements détaillés AN
- Questions parlementaires AN
- Rapports parlementaires AN
- Commissions d'enquête Sénat
- Hémicycle complet PE
- Rapports législatifs PE
- Votes clés
- Carte géographique
- Timeline interactive
- Multi-comparateur
- Évolution temporelle
- Navigation clavier
- Lecteur d'écran
- Signalement d'erreurs
- Fact-checking
- Quiz

### 🔴 Complexe (1-2 semaines) - 5 items
- Interventions en séance AN
- Questions d'actualité Sénat
- Analyse par thème
- Graphe de proximité
- Hémicycle animé
- Annotations communautaires

### ⚫ Très complexe (2+ semaines) - 2 items
- Scraping votes sénatoriaux
- Prédiction de vote ML
