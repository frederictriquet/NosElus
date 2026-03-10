# Tâches à faire

> Dernière mise à jour : 2026-03-10
> Sources : ROADMAP.md, ROADMAP2.md, FEATURES.md, FEATURES2.md, PROPOSAL.md, docs/features/\*

---

## Accessibilité citoyenne (nouvelles — 2026-02-28)

> Objectif : permettre à n'importe qui de retrouver une info objective à partir d'une affirmation lue sur les réseaux
> Contexte détaillé dans `docs/features/`

- **Recherche en langage naturel** — `docs/features/recherche-langage-naturel.md`
  - Phase 1 : fulltext enrichi (court terme, s'appuie sur migration 0014)
  - Phase 2 : embeddings pgvector (moyen terme)
  - Phase 3 : LLM + RAG (ambitieux)
- **Fiches thématiques** — `docs/features/fiches-thematiques.md`
  - Pages `/themes` et `/themes/[slug]`
  - Système de tags sur les scrutins (manuel ou LLM)
  - Bilan par groupe politique par thème
- **Cartes de vote partageables** — `docs/features/cartes-vote-partageables.md`
  - Format texte copier-coller + bouton "Copier"
  - OG image dynamique (1200×630px) pour partage réseaux sociaux
  - Champ `title_simple` sur les scrutins (titre en français courant)
- **Vérifier une affirmation** — `docs/features/verifier-une-affirmation.md`
  - Phase 1 : recherche guidée (mots-clés, ~1 semaine)
  - Phase 2 : extraction entités + verdict semi-auto (LLM, ~1 mois)
  - Phase 3 : RAG complet

---

## Analyses avancées

- Profil thématique des élus (participation par thème, dissidence par thème, indice de spécialisation)
- Radar chart / heatmap thématique par élu
- Matrice de proximité député ↔ député
- Projection 2D (PCA ou UMAP) — espace politique visualisé
- Trajectoire temporelle d'un élu dans l'espace politique
- Frise chronologique par élu (changements de groupe, ruptures de comportement)
- Détecter ruptures de comportement de vote corrélées à des événements politiques
- Comparer élu vs moyenne de son groupe / vs sa circonscription / entre législatures
- Comparer positions AN vs Sénat
- Identifier groupes pivot (scrutins à faible majorité)
- Visualisation du parcours AN ↔ Sénat ↔ CMP d'une loi

---

## Données manquantes

- Amendements détaillés AN
- Questions parlementaires AN
- Interventions en séance AN
- Rapports parlementaires AN
- Votes sénatoriaux (scraping ou API à auditer)
- Commissions d'enquête Sénat
- Questions d'actualité Sénat
- Hémicycle PE complet (tous 720 MEPs, pas seulement les Français)
- Rapports législatifs PE
- Commissions PE

---

## Fonctionnalités citoyennes

- Système de favoris (élus suivis)
- Alertes email sur nouveaux scrutins
- Flux RSS par élu / thème
- Suivi d'un député spécifique
- Annotations utilisateurs (modérées)
- Commentaires sur les votes
- Signalement d'erreurs
- Partage sur réseaux sociaux (au-delà des cartes)

---

## Export et API publique

- Export CSV/JSON par élu
- Export CSV/JSON par scrutin/période
- API REST publique en lecture seule
- Documentation API interactive (OpenAPI/Swagger)

---

## Transparence méthodologique

- Documentation par indicateur (expliquer chaque stat)
- Expliciter les limites et biais connus
- Afficher taux de données manquantes par section
- Indicateur de couverture temporelle
- Différences AN / Sénat / PE clairement indiquées

---

## Documentation utilisateur

- Guide utilisateur
- Glossaire parlementaire
- Tutoriels d'utilisation
- Quiz de connaissance civique

---

## Sécurité (issues connues)

- Échapper les caractères LIKE (`%`, `_`) dans la recherche — priorité moyenne
- Résoudre les 11 vulnérabilités npm (dépendances : cookie, esbuild...) — priorité moyenne
- Rate limiting sur les APIs publiques — priorité basse
- Rate limiting sur le login admin — si exposition publique
- Logs d'audit des modifications de positions politiques
- Logs de sécurité pour détecter les abus
- HSTS (`Strict-Transport-Security`) — à configurer au niveau reverse proxy
- `Permissions-Policy` header

## Infrastructure & Qualité

- Tests unitaires API
- Audit de performance
- Audit d'accessibilité (RGAA)
- Mode sombre / Mode haut contraste
- Déploiement production
- Monitoring et alertes (Sentry, uptime, Core Web Vitals)
- Analytics (Plausible ou Matomo)

---

## ETL / Données

- ETL IA avec Ollama (classification + analyse) — prérequis : `ollama serve` (en cours)
- Investigation DOSLEG Sénat — probablement exploitable
- Forcer re-téléchargement des données ETL depuis zéro (documentation)
- Traiter le TODO `src/routes/api/quiz/group-votes/+server.ts:98` — legislature PE-10
- Préparer les données **offline incrémentalement** (ordinateur puissant local → envoi vers prod, idempotent)
- Intégration **EUR-Lex** pour récupérer les textes complets des lois PE (prérequis pour résumés IA PE)
- Exploiter les **mots-clés officiels** des dossiers AN pour la thématisation (`etl-an-dossiers` les importe déjà)
- Classification des scrutins principaux **via LLM** (alternative au classement manuel — mistral-nemo déjà disponible)
- Optimisations photos AN (court terme : `loading="lazy"` + dimensions fixes ; moyen terme : proxy cache serveur ; long terme : téléchargement local à l'ETL)

## En suspens / À explorer

- MCP data.gouv.fr — voir `DATAGOUV-MCP.md` (bug serveur, issue #25)
- Prédiction de vote (ML) — ambitieux, nécessite volume de données
- Hémicycle animé — effort visuel important
- Multi-comparateur (3+ élus simultanément)
