# Roadmap — Accessibilité citoyenne

> Objectif : permettre à n'importe quel citoyen de retrouver des informations objectives et officielles
> à partir d'une affirmation lue sur les réseaux sociaux, sans connaître le vocabulaire parlementaire.
>
> Contexte déclencheur : post viral affirmant "le RN défend les travailleurs" alors que
> le groupe a voté contre l'augmentation du SMIC à 1500€ net (20/07/2022).
>
> Dernière mise à jour : 2026-02-28

---

## Vue d'ensemble des 4 features

Ces features sont interdépendantes et se renforcent mutuellement :

```
Recherche langage naturel  ──►  Vérifier une affirmation
        │                               │
        ▼                               ▼
 Fiches thématiques       ◄──  Cartes de vote partageables
```

- La **recherche** alimente "Vérifier une affirmation" (même infrastructure)
- Les **cartes** sont générées depuis les résultats de vérification
- Les **fiches thématiques** sont taguées via les thèmes détectés en recherche

---

## Feature 1 — Recherche en langage naturel

**Objectif** : taper "SMIC RN vote" et obtenir les scrutins pertinents, sans connaître le titre exact de la loi.

**Cas d'usage** :

1. Utilisateur lit un post sur les réseaux sociaux
2. Il arrive sur NosElus et tape sa question en langage libre
3. Il obtient les votes officiels pertinents avec contexte

**Exemples de requêtes** : "SMIC RN vote", "retraites LFI 2023", "immigration droite abstention"

### Phase A — Fulltext enrichi (court terme)

- S'appuie sur l'indexation fulltext PostgreSQL déjà en place (`migration 0014`)
- Enrichir l'index avec titres de lois, descriptions de scrutins, noms de groupes politiques
- Ranking par pertinence
- **Prérequis** : auditer `src/routes/api/v1/search/+server.ts` pour voir ce qui est déjà indexé

### Phase B — Recherche sémantique (moyen terme)

- Embeddings vectoriels sur les descriptions de scrutins/lois
- pgvector (extension PostgreSQL) pour similarité cosine
- Avantage : trouve "SMIC" même si la loi parle de "rémunération minimale"

### Phase C — LLM + RAG (ambitieux)

- LLM identifie les entités (parti, thème, période) et interroge la base
- Réponse sourcée avec liens vers les votes

**Point d'entrée UX** : champ de recherche proéminent sur la page d'accueil (actuellement absent ou discret)

---

## Feature 2 — Fiches thématiques

**Objectif** : offrir un troisième axe d'entrée dans le site — par sujet du quotidien — en plus de "par élu" et "par loi".

**Principe** : regrouper les votes par grands thèmes de vie, avec bilan par groupe politique en langage simple. Ne jamais afficher un numéro de loi en premier plan.

### Thèmes envisagés (7 au lancement)

| Thème           | Scrutins couverts                                |
| --------------- | ------------------------------------------------ |
| Pouvoir d'achat | SMIC, inflation, taxes énergie                   |
| Logement        | Encadrement loyers, APL, expulsions              |
| Retraites       | Réforme 2023, âge légal, pénibilité              |
| Santé           | Déserts médicaux, remboursements, hôpital public |
| Immigration     | Asile, nationalité, régularisation               |
| Environnement   | ZFE, pesticides, énergies renouvelables          |
| Démocratie      | RIC, proportionnelle, transparence               |

### Structure d'une fiche

```
[Thème : Pouvoir d'achat]

Bilan par groupe :
  NFP       → POUR dans 4 scrutins sur 4
  RN        → CONTRE dans 3 scrutins sur 4
  Ensemble  → CONTRE dans 2, abstention dans 2

Scrutins clés :
  20/07/2022 — Augmentation du SMIC à 1500€ net  [voir →]
  15/02/2023 — ...
```

### Pages à créer

- `/themes` — liste des thèmes avec résumé par groupe
- `/themes/[slug]` — fiche détaillée d'un thème

### Système de tags (prérequis)

3 options, par ordre de préférence :

1. **Tags officiels AN** — vérifier si `etl-an-dossiers` les importe déjà (les mots-clés officiels des dossiers sont déjà importés selon TODO.md)
2. **Tagging LLM** (mistral-nemo) sur titre + description de scrutin
3. **Tagging manuel éditorial** — fiable mais lourd, réservé aux scrutins emblématiques

**Approche recommandée** : commencer par 2-3 thèmes pilotes (Pouvoir d'achat + Retraites), tagger ~20 scrutins manuellement pour valider, puis automatiser.

---

## Feature 3 — Cartes de vote partageables

**Objectif** : produire des contenus dans le même format que la désinformation (visuels compacts, mobiles, partageables) mais avec des données officielles vérifiables.

**Principe** : pour chaque scrutin, une "carte" avec titre en français simple, résultat par groupe, date et lien source.

### Format texte (copier-coller)

```
📊 VOTE : Augmentation du SMIC à 1500€ net
📅 20 juillet 2022 — Assemblée Nationale

✅ Pour    : NFP (100%), PCF (100%)
❌ Contre  : RN (94%), LR (87%), Ensemble (72%)
🟡 Abstention : —

Source : nosElus.fr/scrutin/XXX
```

Implémentation : bouton "Copier" sur chaque page de scrutin. Trivial, ~1 jour de dev.

### Format image (OG card dynamique)

- Dimensions 1200×630px (standard Open Graph)
- Générée côté serveur depuis une route SvelteKit `/og/scrutin/[id].png`
- Utilisable sur Twitter/X, Facebook, WhatsApp sans action supplémentaire
- Options d'implémentation : `satori` (SVG→PNG), `canvas` Node.js, ou service tiers

### Partage natif mobile

- Web Share API (`navigator.share()`) pour iOS/Android
- Fallback : copie dans le presse-papier

### Prérequis bloquant

- **Champ `title_simple`** sur la table `scrutins` : le titre juridique ("PPL visant à instituer...") doit être traduit en langage courant. Options : traduction manuelle pour les scrutins majeurs, ou LLM.
- Le design doit inspirer confiance : pas de couleurs partisanes, logo NosElus visible, lien source toujours présent.

### Séquence d'implémentation recommandée

1. Ajouter le champ `title_simple` (nullable) en base
2. Remplir manuellement pour les 20-30 scrutins les plus consultés
3. Implémenter le bouton "Copier le résumé" (format texte)
4. Implémenter l'OG image dynamique
5. Tester la viralité

---

## Feature 4 — Vérifier une affirmation

**Objectif** : permettre à un utilisateur d'entrer une affirmation politique lue sur les réseaux et d'obtenir les faits officiels qui la confirment ou l'infirment.

**Point d'entrée UX** : champ proéminent sur la page d'accueil ou page dédiée `/verifier`.

```
« J'ai lu que... »
[_____________________________________________]
                                    [Vérifier]
```

### Exemple de résultat

```
Affirmation : "Le RN a voté contre l'augmentation du SMIC"

Scrutins trouvés :

1. Augmentation SMIC 1500€ — 20/07/2022
   RN : 94% contre  →  ✅ Confirme l'affirmation

2. Revalorisation SMIC — 15/11/2023
   RN : 61% contre  →  ✅ Confirme l'affirmation

Verdict : ✅ Confirmé par 2 scrutins officiels — Source : Assemblée Nationale
```

### Phase 1 — Recherche guidée (~1 semaine)

- Extraction des mots-clés (stop words supprimés)
- Recherche fulltext sur les scrutins
- Pas de verdict automatique — l'utilisateur interprète les résultats
- **Note** : c'est quasiment la Feature 1 (Recherche langage naturel) — implémenter les deux ensemble

### Phase 2 — Verdict semi-automatique (~1 mois)

- LLM local (mistral-nemo, déjà intégré) extrait : sujet, acteur, direction du vote attendu
- Requête SQL ciblée sur ces entités
- Génération d'un verdict ✅ / ❌ / 🟡 avec les votes trouvés

### Phase 3 — RAG complet (ambitieux)

- Embeddings sur tous les scrutins (pgvector)
- Recherche sémantique + LLM pour synthèse en langage naturel
- Réponse avec sources citées intégrées

### Garde-fous impératifs

- Ne jamais générer de verdict sans source officielle vérifiable
- Si les résultats sont nuancés, l'afficher clairement (verdict 🟡 Nuancé)
- Aucun jugement politique : "confirmé/infirmé" sur les faits uniquement
- Toujours mentionner les limites : un vote ne résume pas la position complète d'un groupe

---

## Séquence de développement recommandée

Ces features partagent des briques communes. Ordre suggéré pour maximiser la réutilisation :

| Étape | Feature                        | Livrable                                                 | Effort      |
| ----- | ------------------------------ | -------------------------------------------------------- | ----------- |
| 1     | Recherche + Vérifier (Phase 1) | Champ de recherche enrichi + page `/verifier` basique    | ~1 semaine  |
| 2     | Cartes texte                   | Bouton "Copier" sur pages scrutin + champ `title_simple` | ~1-2 jours  |
| 3     | Fiches thématiques (pilote)    | 2-3 thèmes avec tagging manuel                           | ~1 semaine  |
| 4     | Cartes image (OG)              | Images partageables générées côté serveur                | ~2-3 jours  |
| 5     | Vérifier (Phase 2)             | Verdict semi-auto via LLM                                | ~1 mois     |
| 6     | Recherche sémantique           | pgvector + embeddings                                    | À planifier |
| 7     | RAG complet                    | Réponse en langage naturel sourcée                       | Ambitieux   |
