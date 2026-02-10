# Index des Architecture Decision Records (ADR)

## Vue d'ensemble

Cet index centralise toutes les décisions architecturales documentées du projet NosElus.

## ADR Actifs

| ID | Date | Titre | Statut | Phase | Fichier |
|----|------|-------|--------|-------|---------|
| ADR-001 | 2026-02-01 | Classification sémantique des scrutins | ✅ Accepté | 1.1 | `adr-2026-02-01-scrutin-category.md` |
| ADR-002 | 2026-02-02 | Identification et calcul des votes décisifs | ✅ Accepté | 4.2 | `adr-2026-02-02-decisive-votes.md` |
| ADR-003 | 2026-02-02 | Récupération du texte complet des lois | 📋 Proposé | 2.1 | `adr-2026-02-02-law-full-text-retrieval.md` |
| ADR-004 | 2026-02-04 | Automatisation du positionnement politique | 📋 Proposé | - | `adr-2026-02-04-political-positioning-automation.md` |
| ADR-005 | 2026-02-06 | Migrations de base de données idempotentes | ✅ Accepté | - | `adr-2026-02-06-idempotent-migrations.md` |
| ADR-006 | 2026-02-06 | Quiz politique interactif | ✅ Accepté | - | `adr-2026-02-06-political-quiz.md` |
| ADR-007 | 2026-02-07 | Expansion des lois du Parlement Européen | ✅ Accepté | 2.1 | `adr-2026-02-07-pe-laws-expansion.md` |
| ADR-008 | 2026-02-07 | Notifications Telegram des ETL avec FemtoLogger | ✅ Accepté | Infrastructure | `adr-2026-02-07-femtologger-etl-notifications.md` |
| ADR-009 | 2026-02-09 | Organisation des targets ETL du Makefile | ✅ Accepté | Developer Experience | `adr-2026-02-09-makefile-etl-organization.md` |

## Par catégorie

### Modèle de données
- **ADR-001** : Classification scrutins (colonne `category`)
- **ADR-002** : Votes décisifs (colonne `margin`)
- **ADR-004** : Positionnement politique (colonne `political_position`)

### Calculs métier
- **ADR-002** : Formule votes serrés (margin simple)

### Infrastructure / Monitoring
- **ADR-008** : Notifications Telegram des ETL (helper centralisé)

### Developer Experience
- **ADR-009** : Organisation Makefile ETL avec catégories `##@` (aide structurée)

### Sources de données
- **ADR-004** : ParlGov comme source de positionnement politique
- **ADR-007** : HowTheyVote.eu API sans filtre géographique (expansion PE)

### ETL/Import
- **ADR-007** : Extraction automatique du terme PE depuis références de procédures

### Algorithmes
- **ADR-004** : Fuzzy Jaccard pour matching partis ParlGov ↔ NosElus

### UI/UX
- **ADR-002** : Wording "vote serré" vs "vote décisif"

## Statuts

- ✅ **Accepté** : Décision validée et implémentée (9 ADRs)
- 📋 **Proposé** : Décision documentée, en attente validation/implémentation (0)
- ⏸️ **Déprécié** : Décision remplacée par une autre (0)
- ❌ **Rejeté** : Décision abandonnée (0)

## Process ADR

1. Exploration des options (`/explore-options`)
2. Documentation de la décision (`/tech-choice`)
3. Validation (équipe/utilisateur)
4. Implémentation (`/architecture` → `/implement`)
5. Mise à jour statut (Proposé → Accepté)

## Liens

- Roadmap : `docs/ROADMAP2.md`
- Patterns : `pattern-*.md`
- Standards : `std-*.md`
