# ADR : Synchronisation Local -> Production pour l'ETL NosElus

**Date** : 2026-05-05
**Statut** : Accepte

## Contexte

L'ETL NosElus produit environ 520 Mo de donnees (scrutins, lois, textes legislatifs, embeddings vectoriels,
resumes IA). Ces traitements impliquent :

- Telechargement de fichiers JSON volumineux depuis les APIs parlementaires
- Appels LLM pour les resumes et classifications semantiques
- Generation d'embeddings (modele Xenova/multilingual-e5-small, 384 dimensions)
- Insertions massives en PostgreSQL avec pgvector

Le serveur de production dispose de ressources tres limitees (256 MB RAM, 0.25 vCPU), ce qui rend
impossible l'execution directe de l'ETL en prod. Par ailleurs, l'ETL doit etre lance plusieurs fois
par semaine pour rester a jour. La solution doit etre incrementale (ne pas retransmettre ce qui existe
deja) et idempotente (pouvoir relancer sans effet de bord).

## Options considerees

### Option 1 : pg_dump / pg_restore batch

Chaque semaine, dumper toute la base locale et la restaurer integralement en prod via SSH.

**Avantages** :

- Simple a mettre en oeuvre
- Garantit la coherence totale entre local et prod
- Pas de logique incrementale a implementer

**Inconvenients** :

- Transfert complet (~520 Mo) a chaque sync, meme si seules quelques lignes ont change
- Indisponibilite en prod pendant le restore (DROP/CREATE tables)
- Pas de granularite : impossible de synchroniser un seul domaine (ex : seulement les scrutins AN)
- Risque de regression en prod si le dump local contient des donnees en cours de traitement

### Option 2 : SSH tunnel + ETL incremental (RETENU)

Ouvrir un tunnel SSH `localhost:5433 -> prod:5432`, puis lancer les scripts ETL existants en local
avec `DATABASE_URL` pointant vers le tunnel. Les 36 scripts ETL sont deja idempotents et supportent
`--incremental` via la table `sync_metadata`.

**Avantages** :

- Aucun code ETL supplementaire : les scripts existants tournent tels quels
- Idempotence native : relancer un script ETL en prod ne cree pas de doublons
- Granularite fine : synchroniser uniquement le scope necessaire (weekly / enrichment / monthly)
- Pas d'indisponibilite : les upserts sont non-destructifs
- `sync_metadata` assure le tracking des deltas et evite le re-traitement de donnees deja presentes
- Controle total : `--dry-run` possible, log par etape

**Inconvenients** :

- Necessite un acces SSH direct au serveur prod
- La premiere fois (bootstrap), un pg_dump/restore reste necessaire
- Le tunnel SSH doit etre maintenu ouvert pendant toute la duree de la sync

### Option 3 : Export CSV/SQL selectif par table

Generer des fichiers CSV ou des scripts SQL d'INSERT/UPDATE pour chaque table, les transferer via SCP
et les rejouer en prod.

**Avantages** :

- Transferts legers si les exports sont filtres
- Pas besoin de tunnel SSH permanent

**Inconvenients** :

- Logique d'export/import a ecrire et maintenir pour chaque table (~20 tables)
- Gestion manuelle des dependances entre tables (contraintes de cles etrangeres)
- Risque d'oubli de tables ou de colonnes lors d'evolutions du schema
- Format CSV fragile pour les donnees JSONB et les vecteurs pgvector

### Option 4 : Replication logique PostgreSQL (pg_logical / pglogical)

Mecanisme natif PostgreSQL de replication logique, permettant de repliquer en continu les changements
d'une instance a une autre.

**Avantages** :

- Propagation quasi-temps-reel, pas de tunnel SSH permanent pour les donnees

**Inconvenients (disqualification)** :

- Necessite des parametres serveur (`wal_level=logical`, `max_replication_slots`) impossibles a
  activer sur un serveur a 256 MB RAM / 0.25 vCPU
- Surcout memoire permanent (WAL sender process)
- Complexite operationnelle disproportionnee pour un ETL batch
- Incompatible avec le modele "machine puissante locale" qui fait du calcul GPU/LLM

## Decision

L'**Option 2** est retenue.

Les scripts ETL existants sont deja conçus pour etre idempotents : chaque script verifie via
`sync_metadata` ce qui a deja ete traite et ne rejoue que le delta. Le mecanisme `--incremental` est
disponible sur les 36 scripts. Faire tourner ces memes scripts en local avec une `DATABASE_URL`
pointant vers un tunnel SSH vers la prod evite tout overhead de developpement.

Cette approche preserve la coherence logique de l'ETL (meme code, meme ordre d'execution, meme
validation) tout en eliminant le probleme de ressources. Le bootstrap initial via pg_dump est une
exception unique et justifiee, documentee explicitement comme telle.

## Consequences

### Ce qui change

- Introduction d'un script `scripts/sync-to-prod.sh` orchestrant l'ouverture du tunnel et l'appel
  aux ETL cibles
- Ajout d'un fichier `.env.prod` (gitignore) contenant les credentials SSH et DB prod
- Documentation du processus de bootstrap initial

### Ce qu'il faut mettre en place

- Acces SSH configure sur la machine de developpement (cle SSH, `~/.ssh/config` optionnel)
- Variables d'environnement prod (`PROD_SSH_HOST`, `PROD_SSH_USER`, `PROD_DB_PASSWORD`, etc.)
- Port 5433 libre en local pour le tunnel (non utilise par d'autres services)
- Script `scripts/db-query-prod.sh` — equivalent de `db-query.sh` pour la prod (via tunnel SSH ouvert)
- Script `scripts/db-dump.sh` — equivalent de `db-query.sh` pour les operations pg_dump locales

### Risques operationnels

- **Tunnel SSH instable pendant ETL long** (analyse LLM, embeddings) : si la connexion est
  interrompue, l'ETL leve une erreur de connexion PostgreSQL et s'arrete. Mitigation : options SSH
  `ServerAliveInterval=30 ServerAliveCountMax=3`, idempotence garantit que la relance est sans effet
  de bord
- **Absence de monitoring** : sans observabilite, une sync silencieusement echouee peut laisser la
  prod avec des donnees perimees pendant des jours. Mitigation : logging structure vers fichier +
  notification Telegram via FemtoLogger (deja disponible)
- **Execution concurrente** : deux syncs simultanees (cron + manuel) ecrivent toutes deux en prod.
  Mitigation : lock fichier via `flock` dans `sync-to-prod.sh`
- **Duree non bornee** : le scope `enrichment` (LLM, embeddings) peut durer plusieurs heures sur un
  grand delta. Mitigation : option `--timeout` ou decoupage en sous-scopes
- **Divergence de schema** : si le schema local et le schema prod different, les ETL echouent.
  Mitigation : appliquer les migrations Drizzle en prod avant chaque sync (`npm run db:migrate`)
- **Performance reseau** : les insertions via tunnel sont plus lentes que localement. Non bloquant
  car les syncs sont planifiees et non interactives

### Cout de maintenance

- La dependance aux targets Makefile et aux flags ETL existants implique que tout changement dans
  les scripts ETL peut silencieusement casser `sync-to-prod.sh`. Mitigation : documenter les
  contrats d'interface attendus (flags `--incremental`, `--since`)
