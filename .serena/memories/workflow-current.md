# Workflow Actif : Section 4.2 - Votes Décisifs

## Tâche
Analyser et planifier l'implémentation de la section 4.2 de ROADMAP2.md : "Votes décisifs"

## Objectif
Mettre en lumière les scrutins où chaque voix comptait vraiment et identifier le poids décisif de chaque élu

## Démarré
2026-02-02 (heure de l'analyse)

## Historique
| Timestamp | Skill | Status | Notes |
|-----------|-------|--------|-------|
| 2026-02-02 | /analyze | ✅ | Analyse complète section 4.2 |
| 2026-02-02 | /explore-options | ✅ | 5 options évaluées, Option 1 recommandée |
| 2026-02-02 | /tech-choice | ✅ | ADR-2026-02-02 créé, MVP + enrichissement |
| 2026-02-02 | /roadmap-update | ✅ | Section 4.2 marquée IN_PROGRESS |
| 2026-02-02 | /architecture | ✅ | Design complet, 3 créations + 9 modifications |

## Phase Actuelle
/architecture ✅ → /implement pour implémentation MVP

## Fichiers Concernés
**À créer** : 3 fichiers
- drizzle/migrations/0007_*.sql
- src/routes/an/scrutins/serres/+page.server.ts
- src/routes/an/scrutins/serres/+page.svelte

**À modifier** : 9 fichiers
- src/lib/server/db/schema/scrutins.ts (colonne margin)
- src/lib/server/api/helpers.ts (types + 4 helpers)
- src/routes/an/scrutins/[id]/* (badge)
- src/routes/an/deputes/[id]/* (panel AsyncCard)
- src/app.css, Navigation.svelte, tests

## Décisions Prises
- **ADR-2026-02-02** : Votes décisifs via Margin Simple (≤10 voix) + Pivot Groups (Phase 2)
- Wording : "Vote serré" (neutre, factuel)
- Route : `/an/scrutins/serres`
- Colonne : `scrutins.margin` pré-calculée + index
- Roadmap mise à jour (ROADMAP2.md section 4.2 ⏳ IN_PROGRESS)

## Contexte Clé
- 5 options comparées (Margin Simple, Pondéré, Banzhaf, Pivot Groups, Hybride)
- **Recommandation** : Option 1 (Margin Simple) MVP + enrichissement Option 4 (Pivot Groups)
- Seuil suggéré : 10 voix (~1 800 scrutins, 10.1% du total)
- Wording retenu : "Vote serré" (neutre) au lieu de "décisif"
- Fondement théorique : Banzhaf/Shapley index pour référence académique
- Pattern AsyncCard + helpers factorisés réutilisables

## Prochaine Étape
/tech-choice pour documenter ADR "Calcul du Poids Décisif" avec Option 1 + enrichissement Option 4
