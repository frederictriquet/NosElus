# Fonctionnalité : Recherche en langage naturel

## Contexte

Les utilisateurs arrivent sur NosElus avec une question concrète en tête ("est-ce que le RN a voté contre le SMIC ?") mais l'interface actuelle suppose de connaître le nom d'un parlementaire ou un texte de loi. Cette fonctionnalité vise à permettre une recherche en prose, comme on poserait une question à quelqu'un.

## Cas d'usage principal

1. L'utilisateur lit un post sur les réseaux sociaux affirmant qu'un parti/député a voté pour ou contre quelque chose.
2. Il arrive sur NosElus et tape sa question directement dans un champ de recherche.
3. Il obtient les votes officiels pertinents avec contexte.

## Exemples de requêtes cibles

- "SMIC RN vote"
- "retraites LFI 2023"
- "immigration droite abstention"
- "augmentation fonctionnaires macronistes"

## Approche technique envisagée

### Option A — Recherche fulltext enrichie (court terme)

- Indexation fulltext PostgreSQL déjà en place (migration `0014_law_fulltext_search.sql`)
- Enrichir l'index avec les titres de lois, descriptions de scrutins, groupes politiques
- Matching par mots-clés avec ranking par pertinence

### Option B — Recherche sémantique (moyen terme)

- Embeddings vectoriels sur les descriptions de scrutins/lois
- pgvector (extension PostgreSQL) pour la similarité cosine
- Permet de trouver "SMIC" même si la loi parle de "rémunération minimale"

### Option C — LLM + RAG (ambitieux)

- L'utilisateur pose une question en langage libre
- Un LLM identifie les entités (parti, thème, période) et interroge la base
- Retourne une réponse sourcée avec liens vers les votes

## État actuel du code

- Route de recherche existante : `src/routes/recherche/` et `src/routes/api/v1/search/`
- Helpers API : `src/lib/server/api/helpers.ts`
- La recherche actuelle semble porter sur les lois (`src/routes/an/laws/`)

## Prochaines étapes suggérées

1. Auditer `src/routes/api/v1/search/+server.ts` pour comprendre ce qui est déjà indexé
2. Tester la pertinence des résultats fulltext sur des requêtes utilisateurs réelles
3. Décider entre option A (rapide) ou B (plus précis)
4. Ajouter un champ de recherche proéminent sur la page d'accueil

## Liens

- Inspirations : Regards Citoyens, DécodeursDu Vote (Le Monde)
- MCP datagouv.fr : pourrait enrichir les résultats avec des datasets officiels (quand il sera fonctionnel — voir DATAGOUV-MCP.md)
