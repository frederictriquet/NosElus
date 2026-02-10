# NosElus - Fonctionnalités implémentées

## Vue d'ensemble

Plateforme de transparence parlementaire française couvrant trois chambres :
- **Assemblée Nationale** (AN) - 2100 députés historiques, 17 872 scrutins
- **Sénat** - 348 sénateurs, 9 groupes
- **Parlement Européen** (PE) - 303 eurodéputés français depuis 2004

---

## 1. Assemblée Nationale

### 1.1 Députés
| Page | Fonctionnalités |
|------|-----------------|
| `/an/deputes` | Liste paginée, recherche par nom, tri, filtres par groupe |
| `/an/deputes/[id]` | Profil complet, photo, groupe, mandats historiques |

**Fiche député :**
- Informations biographiques (naissance, profession, circonscription)
- Groupe parlementaire avec couleur et badge
- Historique des mandats (député, groupes, commissions)
- Statistiques de vote (pour/contre/abstention, participation)
- Alignement avec son groupe (% de votes conformes)
- Activité parlementaire (présences, interventions, amendements, questions)
- Votes récents avec position et résultat
- Liens externes (assemblee-nationale.fr)

### 1.2 Scrutins
| Page | Fonctionnalités |
|------|-----------------|
| `/an/scrutins` | Liste avec filtres (date, résultat), pagination |
| `/an/scrutins/[id]` | Détail, répartition votes, votes par groupe, liste nominative |

### 1.3 Groupes parlementaires
| Page | Fonctionnalités |
|------|-----------------|
| `/an/groupes` | Liste des 11 groupes avec effectifs et couleurs |
| `/an/groupes/[id]` | Détail groupe, liste membres, statistiques |

### 1.4 Statistiques `/an/stats`
- Top 10 participation
- Cohésion de vote par groupe
- Répartition globale (pour/contre/abstention)
- Activité mensuelle (graphique barres)
- Résultats scrutins (adoptés/rejetés)
- Alignement avec le gouvernement
- Évolution temporelle des positions
- Heatmap votes par groupe
- Matrice de proximité politique entre groupes

### 1.5 Carte politique `/an/carte`
- Hémicycle SVG interactif (groupes gauche→droite)
- Bar chart de répartition
- Miniatures des députés par groupe

### 1.6 Comparateur `/an/compare`
- Comparaison de 2 députés
- Similarité de vote (% d'accord)
- Distance politique pondérée
- Liste des votes divergents

---

## 2. Sénat

### 2.1 Sénateurs
| Page | Fonctionnalités |
|------|-----------------|
| `/senat/senateurs` | Liste paginée, recherche, filtres par groupe |
| `/senat/senateurs/[id]` | Profil avec mandats et commissions |

**Fiche sénateur :**
- Informations biographiques
- Groupe parlementaire actuel
- Historique mandats (groupe, commissions, délégations)
- Activité parlementaire (présences, interventions, rapports, questions)
- Liens externes (senat.fr)

### 2.2 Groupes sénatoriaux
| Page | Fonctionnalités |
|------|-----------------|
| `/senat/groupes` | Liste des 9 groupes avec effectifs |
| `/senat/groupes/[id]` | Détail groupe avec membres |

### 2.3 Limitations
- Pas de scrutins (votes individuels non publiés)
- Pas de statistiques de vote
- Pas de comparateur

---

## 3. Parlement Européen

### 3.1 Eurodéputés
| Page | Fonctionnalités |
|------|-----------------|
| `/pe/eurodeputes` | Liste infinite scroll, recherche, filtres |
| `/pe/eurodeputes/[id]` | Profil complet avec votes et mandats |

**Fiche eurodéputé :**
- Groupe politique européen avec couleur
- Historique mandats (termes 6-10, depuis 2004)
- Statistiques de vote (participation, positions)
- Alignement avec son groupe
- Votes récents

### 3.2 Scrutins PE
| Page | Fonctionnalités |
|------|-----------------|
| `/pe/scrutins` | Liste des votes en session plénière |
| `/pe/scrutins/[id]` | Détail avec votes des eurodéputés français |

### 3.3 Groupes européens
| Page | Fonctionnalités |
|------|-----------------|
| `/pe/groupes` | 9 groupes (PPE, S&D, RE, Verts, GUE, ECR, PfE, ESN, NI) |
| `/pe/groupes/[id]` | Détail groupe avec membres français |

### 3.4 Statistiques `/pe/stats`
Dashboard statistiques européennes

### 3.5 Carte politique `/pe/carte`
- Hémicycle européen (eurodéputés français)
- Groupes ordonnés gauche→droite
- Couleurs officielles (source: results.elections.europa.eu)

### 3.6 Comparateur `/pe/eurodeputes/compare`
Comparaison de 2 eurodéputés

---

## 4. Fonctionnalités transversales

### 4.1 Navigation
- Header avec tabs AN / Sénat / PE
- Sous-navigation contextuelle par chambre
- Sélecteur de période persistant (cookies)

### 4.2 Périodes
| Chambre | Concept | Valeurs |
|---------|---------|---------|
| AN | Législature | 12-17 |
| PE | Terme | 6-10 |
| Sénat | Renouvellement | 2017, 2020, 2023 |

### 4.3 Recherche globale `/recherche`
Recherche unifiée tous élus (AN + Sénat + PE)

### 4.4 Sources `/sources`
Documentation des sources de données

---

## 5. Composants réutilisables

| Composant | Usage |
|-----------|-------|
| `ElectedCard` | Carte élu (miniature ou complète) |
| `ProfileHeader` | En-tête profil avec photo et groupe |
| `PeriodSelector` | Sélecteur de période contextuel |
| `GroupAlignmentCard` | Indicateur d'alignement avec le groupe |
| `ActivityStatsCard` | Statistiques d'activité parlementaire |
| `VoteDistributionCard` | Répartition des votes |
| `AsyncCard` | Conteneur avec chargement asynchrone |

---

## 6. Sources de données

| Source | Données | Statut |
|--------|---------|--------|
| data.assemblee-nationale.fr | Députés, scrutins, votes, amendements | ✅ |
| NosDéputés.fr | Statistiques d'activité (586 députés) | ✅ |
| data.senat.fr | Sénateurs, dossiers législatifs | ✅ |
| senat.fr | Statistiques d'activité sénateurs | ✅ |
| ParlTrack | Eurodéputés, mandats historiques | ✅ |
| HowTheyVote.eu | Votes PE session plénière | ✅ |
| results.elections.europa.eu | Couleurs groupes PE | ✅ |

---

## 7. ETL disponibles

```bash
# Assemblée Nationale
make etl-all-legislatures     # Import complet (législatures 12-17)
make etl-an-incremental       # Import incrémental AN
make etl-an-nosdeputes-stats  # Statistiques d'activité

# Sénat
make etl-senat-senators       # Sénateurs et groupes
make etl-senat-laws           # Dossiers législatifs
make etl-senat-activity       # Statistiques d'activité

# Parlement Européen
make etl-europarl-meps        # Eurodéputés actuels
make etl-europarl-historical  # Historique depuis 2004
make etl-europarl-votes       # Votes HowTheyVote.eu

# Transversal
make etl-external-colors      # Couleurs PE/Sénat officielles
```

---

## 8. Stack technique

- **Frontend** : SvelteKit 5, Svelte 5 (runes)
- **Backend** : SvelteKit API routes
- **Base de données** : PostgreSQL + Drizzle ORM
- **Styling** : CSS custom properties, responsive

---

## 9. Volumes de données

| Entité | Volume |
|--------|--------|
| Députés historiques | 2 100 |
| Mandats députés | 12 245 |
| Scrutins AN | 17 872 |
| Votes nominatifs AN | 1 993 587 |
| Sénateurs | 348 |
| Dossiers Sénat | 12 171 |
| Eurodéputés français | 303 |
| Mandats PE | 554 |
| Groupes politiques | 29 |
