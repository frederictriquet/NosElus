# Workflow Actif

## Tâche
Créer un composant réutilisable GroupName.svelte pour afficher le nom complet d'un parti politique au survol du nom court

## Objectif
- Extraire le pattern `.group-name-hover` de ElectedCard.svelte
- Créer un composant réutilisable
- L'appliquer partout où on affiche un nom de parti

## Démarré
2026-02-01

## Historique
| Timestamp | Skill | Status | Notes |
|-----------|-------|--------|-------|
| Début | /analyze | ✅ | Analyse complète - 12 fichiers identifiés |
| Suite | /architecture | ✅ | Composant conçu avec 2 variantes (hover, stacked) |

## Phase Actuelle
/architecture (terminé)

## Contexte Clé
- **Pattern existant** : `.group-name-hover` dans ElectedCard.svelte avec animation scroll
- **Pattern alternatif** : `.group-label` dans ProfileHeader.svelte (affichage vertical)
- **12 fichiers** Svelte trouvés avec usage de noms de groupes
- **Priorité** : ElectedCard.svelte (3 occurrences) puis ProfileHeader.svelte

## Décisions à Prendre
1. Nom du composant : GroupName.svelte (recommandé)
2. Support de 2 variantes : 'hover' (scroll) vs 'stacked' (vertical) ?
3. API des props

## Fichiers Concernés
- **À créer** : `src/lib/components/GroupName.svelte`
- **À migrer** : 
  - ElectedCard.svelte (P0)
  - ProfileHeader.svelte (P1)
  - Routes scrutins/stats (P2)

## Prochaine Étape
`/implement` - Créer le composant GroupName.svelte et migrer les 2 composants principaux

## Memories Créées
- analysis-2026-02-01-group-name-hover-component.md
- arch-2026-02-01-group-name-component.md
