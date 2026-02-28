# Fonctionnalité : "Vérifier une affirmation"

## Contexte

C'est le cas d'usage le plus direct issu du post déclencheur :

> « Le RN défend les travailleurs »
> → Vote contre l'augmentation du SMIC à 1 500 € net. (vote du 20 juillet 2022)

Quelqu'un lit une affirmation politique sur les réseaux, veut savoir si c'est vrai, et arrive sur NosElus. Cette fonctionnalité lui propose un parcours dédié : entrer l'affirmation, obtenir les faits officiels qui la confirment ou l'infirment.

## Principe

Un champ sur la page d'accueil (ou une page `/verifier`) :

```
« J'ai lu que... »
[_____________________________________________]
                                    [Vérifier]
```

L'utilisateur entre une affirmation en langage libre. Le système retourne :

- Les scrutins officiels pertinents
- Le résultat réel du vote (par groupe ou par député)
- Un verdict clair : ✅ Confirmé / ❌ Infirmé / 🟡 Nuancé
- La source (lien AN officiel)

## Exemple de parcours

**Entrée** : "Le RN a voté contre l'augmentation du SMIC"

**Sortie** :

```
Affirmation : "Le RN a voté contre l'augmentation du SMIC"

📊 Scrutins trouvés :

1. PPL augmentation SMIC 1500€ — 20/07/2022
   RN : 94% contre ✅ Confirme l'affirmation
   [Voir le vote complet]

2. Amendement revalorisation SMIC — 15/11/2023
   RN : 61% contre ✅ Confirme l'affirmation

Verdict : ✅ Cette affirmation est confirmée par 2 scrutins officiels.
Source : Assemblée Nationale — nosElus.fr
```

## Approche technique (par ordre de complexité)

### Phase 1 — Recherche par mots-clés guidée (rapide, ~1 semaine)

- L'utilisateur entre une phrase
- Extraction simple des mots-clés (stop words supprimés)
- Recherche fulltext sur les scrutins + suggestion des résultats les plus proches
- Pas d'IA, pas de verdict automatique — l'utilisateur interprète lui-même
- **C'est déjà presque la fonctionnalité "Recherche langage naturel"**

### Phase 2 — Extraction d'entités + verdict semi-automatique (~1 mois)

- LLM local (mistral-nemo, déjà utilisé dans le projet) pour extraire :
  - Sujet (SMIC, retraites...)
  - Acteur (RN, LFI, un député...)
  - Direction (vote pour / contre / abstention)
- Requête SQL ciblée sur ces entités
- Génération d'un verdict avec les votes trouvés

### Phase 3 — RAG complet (ambitieux)

- Embeddings sur tous les scrutins (pgvector)
- Recherche sémantique + LLM pour synthèse
- Réponse en langage naturel avec sources citées

## Risques et garde-fous

- **Ne jamais générer de verdict sans source vérifiable** — toujours lier au vote officiel
- **Éviter le biais de confirmation** — si les résultats sont nuancés, le dire clairement
- **Pas de jugement politique** — "confirmé/infirmé" sur les faits uniquement, jamais d'interprétation
- Mentionner les limites : un vote ne résume pas la position complète d'un groupe

## Liens avec les autres fonctionnalités

- S'appuie sur **Recherche langage naturel** (Phase 1 = même chose)
- Les résultats peuvent générer des **Cartes de vote partageables**
- Les thèmes détectés alimentent les **Fiches thématiques**

## État actuel du code

- `src/routes/an/laws/+page.server.ts` : recherche de lois côté serveur
- `src/routes/api/v1/search/+server.ts` : endpoint de recherche API
- LLM déjà intégré dans le projet (law-analyzer, mistral-nemo)

## Prochaines étapes suggérées

1. Commencer par la Phase 1 (recherche mots-clés) — valider l'usage
2. Mesurer si les utilisateurs trouvent ce qu'ils cherchent
3. Itérer vers la Phase 2 si l'usage est confirmé
