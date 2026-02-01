# Implémentation : Phase 2.2 UI - Implication législative

## Date : 2026-02-01

## Objectif

Afficher l'implication des députés dans les textes de loi (auteur/cosignataire) dans l'UI.

## Composants implémentés

### 1. Helpers d'agrégation (`src/lib/server/api/helpers.ts`)

```typescript
// Récupère les textes signés par un acteur
export async function getActorLawsImplication(
  actorId: string,
  limit = 50
): Promise<ActorLawImplication[]>

// Récupère les contributeurs d'un texte
export async function getLawContributors(
  lawId: string
): Promise<LawContributor[]>
```

### 2. Page député (`/an/deputes/[id]`)

**Server** (`+page.server.ts`) :
- Ajout de `loadLawsImplication()` qui appelle `getActorLawsImplication()`
- Streamed data : `lawsImplication: loadLawsImplication()`

**UI** (`+page.svelte`) :
- Nouvelle section "Textes signés" avec AsyncCard
- Affichage du rôle (auteur/cosignataire) en badge coloré
- Compteurs par rôle
- Liens vers les pages des textes

### 3. Page dossier législatif (`/an/laws/[id]`)

**Server** (`+page.server.ts`) :
- Ajout de `loadContributors()` qui appelle `getLawContributors()`
- Streamed data : `contributors: loadContributors()`

**UI** (`+page.svelte`) :
- Nouvelle section "Contributeurs" avec AsyncCard
- Groupes séparés : Auteurs / Cosignataires
- Liens vers les pages des députés

## Styles

### law-item (page député)
- `.law-role` : Badge avec couleur selon rôle (author = primary, cosignatory = secondary)
- `.law-info` : Titre et date du texte
- Hover effect

### contributor-item (page dossier)
- Pills cliquables avec noms des députés
- Séparation auteurs/cosignataires
- Layout flexible (wrap)

## Données utilisées

- Table : `law_cosignatories` (4684 entrées)
- Relations : laws ← law_cosignatories → actors
- Tri : par date de dépôt (desc) + ordre de signature

## Tests manuels

```bash
# Vérifier les données
docker exec noselus-postgres psql -U noselus -d noselus -c "
SELECT COUNT(*) FROM law_cosignatories;
"
# → 4684

# Top contributeurs
docker exec noselus-postgres psql -U noselus -d noselus -c "
SELECT a.last_name, COUNT(*) 
FROM law_cosignatories lc 
JOIN actors a ON lc.actor_id = a.id 
GROUP BY a.last_name 
ORDER BY COUNT(*) DESC 
LIMIT 5;
"
# → Bayrou (39), Clouet (37), etc.

# Vérifier le serveur
npm run check  # ✅ Pas d'erreurs TS
npm run dev    # ✅ Démarre sur :5174
```

## Commit

```
feat(ui): add law implication UI for deputies and laws (phase 2.2)

- Add getActorLawsImplication() and getLawContributors() helpers
- Display signed laws on deputy page with role badges
- Display contributors on law detail page
- Group by author/cosignatory with counts
```
