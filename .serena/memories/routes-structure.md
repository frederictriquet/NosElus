# Structure des routes par chambre

## Organisation

Les pages sont organisées par chambre parlementaire avec des sélecteurs de période spécifiques à chaque institution.

## Routes par chambre

### Assemblée nationale (`/an/`)
| Route | Description |
|-------|-------------|
| `/an/` | Dashboard AN |
| `/an/deputes` | Liste des députés |
| `/an/deputes/[id]` | Fiche député |
| `/an/scrutins` | Liste des scrutins |
| `/an/scrutins/[id]` | Détail d'un scrutin |
| `/an/groupes` | Groupes parlementaires |
| `/an/groupes/[id]` | Détail d'un groupe |
| `/an/stats` | Statistiques |
| `/an/carte` | Hémicycle |
| `/an/compare` | Comparateur de députés |

**Période** : Législature (12-17) → `?legislature=17`

### Sénat (`/senat/`)
| Route | Description |
|-------|-------------|
| `/senat/` | Dashboard Sénat |
| `/senat/senateurs` | Liste des sénateurs |
| `/senat/senateurs/[id]` | Fiche sénateur |

**Période** : Renouvellement (2023, 2020...) → `?renouvellement=2023`

### Parlement européen (`/pe/`)
| Route | Description |
|-------|-------------|
| `/pe/` | Dashboard PE |
| `/pe/eurodeputes` | Liste des eurodéputés |
| `/pe/eurodeputes/[id]` | Fiche eurodéputé |
| `/pe/eurodeputes/compare` | Comparateur |

**Période** : Terme (6-10) → `?terme=10`

## Autres routes
| Route | Description |
|-------|-------------|
| `/` | Page d'accueil avec liens vers les chambres |
| `/recherche` | Recherche globale (cross-chamber) |

## Redirections (hooks.server.ts)

Les anciennes URLs redirigent automatiquement (301) :
- `/deputes` → `/an/deputes`
- `/scrutins` → `/an/scrutins`
- `/groupes` → `/an/groupes`
- `/stats` → `/an/stats`
- `/carte` → `/an/carte`
- `/compare` → `/an/compare`
- `/senateurs` → `/senat/senateurs`
- `/eurodeputes` → `/pe/eurodeputes`

## Composants clés

- `PeriodSelector.svelte` - Sélecteur de période générique
- `ElectedCard.svelte` - Carte d'élu (supporte `type: 'depute' | 'senateur' | 'eurodepute'`)

## Stores

- `src/lib/stores/chamber-period.ts` - Gestion des périodes par chambre avec localStorage
