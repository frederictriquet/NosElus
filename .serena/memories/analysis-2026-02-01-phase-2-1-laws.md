# Analyse - Phase 2.1 : Trajectoire des textes de loi

## Date : 2026-02-01

## Découverte majeure

**L'infrastructure ETL existe DÉJÀ** ✅

L'analyse révèle que la phase 2.1 est **moins complexe que prévu** car :
- Schéma DB `laws` existe
- ETL `importLaws()` implémenté
- ETL `linkScrutinsToLaws()` implémenté
- Script `import-laws.ts` prêt
- Makefile `make etl-laws` disponible

**Seul manquant : l'UI** (route + page)

## État actuel

### Infrastructure ✅
- `src/lib/server/db/schema/laws.ts` - Schema complet
- `src/lib/server/etl/sources/assemblee/laws.ts` - ETL laws + link
- `scripts/etl/import-laws.ts` - Script d'import
- `@tricoteuses/assemblee` - Parser XML AN

### Données ❌
- 0 laws AN importées (12k laws Sénat seulement)
- 0% scrutins liés (`lawId` NULL)
- ETL non exécuté (nécessite `ETL_DATA_DIR`)

## Prérequis ETL

```bash
# Cloner données AN
git clone https://git.tricoteuses.fr/data/assemblee.git

# Configurer
export ETL_DATA_DIR=/path/to/assemblee

# Exécuter
make etl-laws
```

## Structure page `/an/laws/[id]`

### Données disponibles (table laws)
- `id`, `title`, `shortTitle`
- `type` (PJL, PPL, PLFR, etc.)
- `status` (en cours, adopté, rejeté, promulgué)
- `depositDate`, `adoptionDateAN`, `adoptionDateSenat`
- `promulgationDate`, `publicationDate`
- `initiator` (gouvernement, assemblée, sénat)
- `theme`, `subThemes`

### Relations disponibles
- `scrutins` via `lawsRelations` (many scrutins)
- `amendments` via `lawsRelations` (many amendments)

### Composants UI à créer

1. **Route** : `src/routes/an/laws/[id]/+page.server.ts`
2. **Page** : `src/routes/an/laws/[id]/+page.svelte`
3. **Loader** : Récupérer law + scrutins liés + amendements
4. **Timeline** : Liste chronologique des étapes

## Pattern UI similaire existant

**Page député** (`/an/deputes/[id]`) :
- ProfileHeader
- AsyncCard pour panels
- Listes avec liens

**Réutilisable** :
- Même structure de layout
- AsyncCard pour scrutins/amendements
- Timeline similar à `careerMilestones`

## Complexité révisée

**ROADMAP2 dit** : 🔴 Complexe
**Réalité** : 🟡 Moyen (ETL existe, juste UI)

**Tâches restantes** :
1. Exécuter ETL (10 min)
2. Créer route UI (2-3h)
3. Tests (1h)

**Total estimé** : ~4-5h (pas plusieurs jours)

## Recommandation

**Implémenter phase 2.1 maintenant** car :
- Infrastructure prête
- Rapide à faire (UI seulement)
- Débloque phase 2.2
- Apporte grosse valeur (vision processus législatif)
