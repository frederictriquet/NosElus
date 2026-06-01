# Spec : Synchronisation Local -> Production (ETL NosElus)

**Date** : 2026-05-05
**ADR de reference** : `docs/adr-2026-05-05-sync-prod-preprod.md`

---

## 1. Objectif et contraintes

### Objectif

Permettre de preparer les donnees NosElus en local (machine puissante) puis de les synchroniser
vers le serveur de production de facon incrementale et idempotente, sans requrir de ressources
importantes en prod.

### Contraintes

| Contrainte          | Detail                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Ressources prod     | 256 MB RAM, 0.25 vCPU — aucun ETL lourd ne peut tourner en prod                                                           |
| Idempotence         | Toute sync peut etre relancee sans creer de doublons ni effacer de donnees                                                |
| Incrementalite      | Seules les donnees nouvelles ou modifiees depuis la derniere sync sont transmises                                         |
| Securite            | Credentials prod jamais dans le code source ; acces exclusivement via SSH                                                 |
| Interface DB locale | Toute requete SQL locale passe par `./scripts/db-query.sh` (regle CLAUDE.md)                                              |
| Interface DB prod   | Toute requete SQL vers la prod passe par `./scripts/db-query-prod.sh` (analogue de `db-query.sh` pour la prod via tunnel) |
| Schema coherent     | Les migrations Drizzle doivent etre appliquees en prod avant toute sync de donnees (`npm run db:migrate`)                 |

---

## 2. Architecture

```
Machine de developpement (local)
  |
  |  DATABASE_URL=postgresql://noselus:***@localhost:5433/noselus
  |
  +--[ scripts ETL TypeScript (--incremental) ]
  |
  |  Tunnel SSH ouvert par sync-to-prod.sh
  |
  +==[ SSH : localhost:5433 ]=======[ prod_host:5432 ]==+
                                                         |
                                          Serveur prod   |
                                          256 MB / 0.25 vCPU
                                                         |
                                     +-------------------+
                                     | Docker Compose    |
                                     | noselus-postgres  |
                                     | PostgreSQL 16     |
                                     | + pgvector        |
                                     +-------------------+
```

Le tunnel SSH redirige le port local 5433 vers le port 5432 du serveur PostgreSQL prod. Les scripts
ETL ne savent pas qu'ils ecrivent en prod : ils voient simplement une connexion PostgreSQL sur
`localhost:5433`.

---

## 3. Phase 1 : Bootstrap initial (premiere migration)

Le bootstrap est une operation one-time pour initialiser la base prod a partir de la base locale.

### Etapes

#### 3.1 Dumper la base locale

```bash
# db-dump.sh encapsule docker exec pour pg_dump (analogue de db-query.sh)
# Utilisation : ./scripts/db-dump.sh > fichier.sql
# Implementation : docker exec noselus-postgres pg_dump -U noselus --format=plain noselus
./scripts/db-dump.sh > noselus_bootstrap.sql
```

Note : `scripts/db-dump.sh` est a creer (voir spec du script ci-dessous). Il encapsule docker exec
localement de la meme facon que db-query.sh — autorise car il s'agit du conteneur Docker local.

#### 3.2 Transferer et restaurer en une commande (sans docker exec sur prod)

```bash
# pg_restore se connecte au port PostgreSQL expose par Docker sur localhost:5432 du serveur prod
# Docker Compose expose le port 5432 sur 127.0.0.1 du serveur prod
ssh ${PROD_SSH_USER}@${PROD_SSH_HOST} \
  "PGPASSWORD='${PROD_DB_PASSWORD}' psql \
    -h 127.0.0.1 -p ${PROD_DB_PORT:-5432} \
    -U ${PROD_DB_USER:-noselus} \
    ${PROD_DB_NAME:-noselus}" \
  < noselus_bootstrap.sql
```

Cette commande ne necessite pas docker exec sur prod : psql se connecte directement au port
PostgreSQL expose par Docker sur l'interface loopback du serveur.

#### 3.3 Nettoyage

```bash
rm noselus_bootstrap.sql
# Aucun fichier a supprimer en prod : le dump est streame via SSH sans copie intermediaire
```

#### 3.4 Verification post-bootstrap

```bash
# Ouvrir le tunnel
ssh -N -L ${LOCAL_TUNNEL_PORT:-5433}:127.0.0.1:${PROD_DB_PORT:-5432} \
    -i ${PROD_SSH_KEY:-~/.ssh/id_rsa} \
    ${PROD_SSH_USER}@${PROD_SSH_HOST} &
TUNNEL_PID=$!
sleep 3

# Verification via db-query-prod.sh (voir section 9)
./scripts/db-query-prod.sh "SELECT 'scrutins', COUNT(*) FROM scrutins UNION ALL SELECT 'actors', COUNT(*) FROM actors;"

kill $TUNNEL_PID
```

#### 3.5 Spec de `scripts/db-dump.sh`

```bash
#!/usr/bin/env bash
# Encapsule pg_dump sur le conteneur PostgreSQL local
# Usage : ./scripts/db-dump.sh > fichier.sql
# Analogue de db-query.sh pour les dumps complets

set -euo pipefail

CONTAINER="${POSTGRES_CONTAINER:-noselus-postgres}"
USER="${POSTGRES_USER:-noselus}"
DB="${POSTGRES_DB:-noselus}"

docker exec "${CONTAINER}" pg_dump -U "${USER}" --format=plain "${DB}"
```

---

## 4. Phase 2 : Syncs regulieres via SSH tunnel

Apres le bootstrap, les syncs incrementales s'executent regulierement selon le calendrier defini
dans `docs/notes.md`.

### 4.1 Ouvrir le tunnel SSH

```bash
ssh -N \
    -L 5433:localhost:${PROD_DB_PORT:-5432} \
    -i ${PROD_SSH_KEY:-~/.ssh/id_rsa} \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    ${PROD_SSH_USER}@${PROD_SSH_HOST} &
TUNNEL_PID=$!
```

`ServerAliveInterval=30` : le client SSH envoie un keepalive toutes les 30 secondes.
`ServerAliveCountMax=3` : apres 3 keepalives sans reponse (90 secondes), le tunnel est ferme
et le processus SSH se termine, ce qui fait echouer les ETLs en cours avec une erreur de
connexion PostgreSQL — comportement souhaite (fail visible, pas de transaction silencieusement
ouverte). Le tunnel fonctionne en arriere-plan (`-N`, `&`) ; `$TUNNEL_PID` est conserve pour
le trap EXIT.

### 4.2 Configurer DATABASE_URL vers le tunnel

```bash
export DATABASE_URL="postgresql://noselus:${PROD_DB_PASSWORD}@localhost:5433/noselus"
```

A partir de cet instant, tout script ETL qui utilise `DATABASE_URL` ecrit en prod.

### 4.3 Lancer les ETL dans l'ordre

Les ETL sont lances via les targets Makefile existantes, dans l'ordre defini par `docs/notes.md`.

**Scope weekly** (hebdomadaire) :

```bash
make etl-an-download
make etl-an-incremental
make etl-an-dossiers
make etl-an-link-laws
make etl-europarl-votes
make etl-europarl-laws
```

**Scope enrichment** (apres chaque import) :

```bash
make etl-an-law-texts
make etl-europarl-law-texts
make etl-an-analyze-laws
make etl-europarl-analyze-laws
make etl-an-classify-scrutins
```

**Scope monthly** (mensuel) :

```bash
make etl-an-nosdeputes-stats
make etl-senat-activity-stats
make etl-europarl-activity-stats
make etl-senat-senators
```

### 4.4 Fermer le tunnel

```bash
kill $TUNNEL_PID
wait $TUNNEL_PID 2>/dev/null
```

---

## 5. Script `scripts/sync-to-prod.sh`

### 5.1 Interface

```
Usage: ./scripts/sync-to-prod.sh [OPTIONS]

Options:
  --dry-run              Affiche les ETL qui seraient lances sans les executer
  --scope SCOPE          Scope de synchronisation : weekly | enrichment | monthly | all
                         (defaut: all)
  --since DATE           Optimisation : passe --since DATE aux ETL qui le supportent.
                         N'affecte PAS la logique d'idempotence : sync_metadata continue de
                         determiner ce qui est reellement nouveau. --since est une optimisation
                         de performance, pas une garantie de completude.
                         Format : YYYY-MM-DD (ex: 2026-04-01)
                         Valeur par defaut : aucune (comportement incremental complet via sync_metadata)

                         Contrat technique :
                         - ETLs qui acceptent --since (passe via ARGS="--since DATE") :
                             etl-an-scrutins, etl-an-laws, etl-europarl-votes, etl-europarl-laws
                         - ETLs qui ignorent --since (lances sans argument supplementaire) :
                             tous les autres (etl-an-download, etl-an-dossiers, etl-an-link-laws,
                             etl-an-law-texts, etl-an-analyze-laws, etl-an-classify-scrutins,
                             etl-europarl-law-texts, etl-europarl-analyze-laws, scopes monthly)
                         - Mecanisme de passage : `make <target> ARGS="--since ${SINCE_DATE}"`
                           Les targets Makefile transmettent $(ARGS) aux scripts TypeScript
  -h, --help             Affiche cette aide

Variables d'environnement requises :
  PROD_SSH_HOST          Hote SSH du serveur prod (ex: prod.noselus.fr)
  PROD_SSH_USER          Utilisateur SSH (ex: deploy)
  PROD_DB_PASSWORD       Mot de passe PostgreSQL prod

Variables optionnelles :
  PROD_SSH_KEY           Chemin vers la cle SSH (defaut: ~/.ssh/id_rsa)
  PROD_DB_PORT           Port PostgreSQL prod (defaut: 5432)
  LOCAL_TUNNEL_PORT      Port local pour le tunnel (defaut: 5433)
  TELEGRAM_BOT_TOKEN     Token du bot Telegram pour les notifications (optionnel)
  TELEGRAM_CHAT_ID       ID du chat Telegram pour les notifications (optionnel)
  LOG_FILE               Chemin du fichier de log (defaut: /tmp/sync-to-prod.log)
```

### 5.2 Comportement detaille

0. **Verification du lock** : tenter d'acquerir un lock exclusif :
   ```bash
   LOCK_FILE=/tmp/sync-to-prod.lock
   exec 9>"${LOCK_FILE}"
   if ! flock -n 9; then
     echo "[ERROR] sync-to-prod.sh est deja en cours d'execution (lock: ${LOCK_FILE})" >&2
     exit 2
   fi
   ```
   Exit code 2 reserve au conflit de lock (distinct du exit code 1 pour erreur ETL et 0 pour succes),
   ce qui permet au cron de distinguer "echec ETL" de "sync deja active" dans ses logs.
1. **Validation** : verifier que les variables d'environnement obligatoires sont definies ;
   echouer avec un message explicite si l'une manque
2. **Ouverture du tunnel** : `ssh -N -L ${LOCAL_TUNNEL_PORT}:localhost:${PROD_DB_PORT} ...`
3. **Verification de connexion** : tenter une connexion PostgreSQL via le tunnel (retry 5x,
   delai 2s) ; echouer si le tunnel n'est pas operationnel au bout de 10 secondes
4. **Validation de compatibilite de schema** : comparer le nombre de migrations Drizzle
   appliquees en local et en prod via `__drizzle_migrations` :
   ```bash
   LOCAL_COUNT=$(./scripts/db-query.sh "SELECT COUNT(*) FROM __drizzle_migrations;")
   PROD_COUNT=$(./scripts/db-query-prod.sh "SELECT COUNT(*) FROM __drizzle_migrations;")
   if [ "$LOCAL_COUNT" != "$PROD_COUNT" ]; then
     echo "[ERROR] Schema local (${LOCAL_COUNT} migrations) != prod (${PROD_COUNT} migrations)." >&2
     echo "[ERROR] Appliquer 'npm run db:migrate' en prod avant de syncer." >&2
     exit 3
   fi
   ```
   Exit code 3 reserve a l'incompatibilite de schema (distinct de exit 2 conflit lock et
   exit 1 erreur ETL). `db-query-prod.sh` requiert que le tunnel soit deja ouvert (etape 2).
5. **Mode dry-run** : si `--dry-run`, afficher la liste des ETL qui seraient executes et quitter
6. **Execution des ETL** : lancer chaque ETL dans l'ordre, capturer stdout/stderr, log chaque
   etape ; si un ETL echoue, arreter la sequence et logger l'erreur (ne pas continuer)
7. **Fermeture du tunnel** : executer dans un trap `EXIT` pour garantir la fermeture meme en
   cas d'erreur
8. **Rapport final** : afficher le bilan (ETL executes, erreurs eventuelles, duree totale)

### 5.3 Dependances entre scopes

| Scope        | Prerequis en prod                                            | Comportement si prerequis absent                                                                                                              |
| ------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `weekly`     | Aucun — contient les donnees de base                         | Cree les donnees depuis zero                                                                                                                  |
| `enrichment` | `weekly` doit avoir tourne au prealable                      | Les ETL d'enrichissement skippent silencieusement les lois/scrutins absents (sync_metadata vide pour ces entites = 0 enregistrement eligible) |
| `monthly`    | `weekly` pour les acteurs                                    | Idem                                                                                                                                          |
| `all`        | Aucun — execute weekly -> enrichment -> monthly dans l'ordre | Ordre garanti par le script                                                                                                                   |

**Recommandation** : pour la premiere sync sur une prod vide (hors bootstrap), toujours lancer
`--scope all`.

**Validation de la dependance enrichment→weekly** : documentaire uniquement — le script ne
valide pas programmatiquement que `weekly` a tourne recemment. Justification : la validation
programmatique (ex: verifier `last_sync_at` dans `sync_metadata`) est fragile face aux syncs
partielles ou aux resets de metadata. Le comportement de skip silencieux (0 enregistrement
eligible) est suffisamment visible dans les logs pour alerter l'operateur. Si une validation
explicite est souhaitee a l'avenir, ajouter une verification de `sync_metadata` sur les entites
`scrutins` et `laws` avant de lancer `enrichment`.

### 5.4 Gestion des erreurs

**Idempotence garantie pour tous les ETLs du scope**

Tous les 36 scripts ETL sont idempotents (upsert base sur cles metier + sync_metadata). Si la
sequence s'arrete en cours de route, relancer `sync-to-prod.sh` avec le meme `--scope` reprend la
ou l'echec s'est produit sans creer de doublons ni effacer de donnees. Cette garantie est un
prerequis fonctionnel de l'architecture SSH tunnel.

- **Tunnel non disponible** : message d'erreur explicite + exit code 1
- **ETL en echec** : le script s'arrete, log l'ETL en echec + exit code non-zero, ferme le tunnel
- **Interruption utilisateur (Ctrl+C)** : trap SIGINT pour fermer le tunnel proprement
- **Aucun log silencieux** : toute exception/erreur est loguee sur stderr (conformement a la
  regle CLAUDE.md sur les catch silencieux)

### 5.5 Exemple d'utilisation

```bash
# Charger les variables d'environnement prod
source .env.prod

# Verifier sans executer
./scripts/sync-to-prod.sh --dry-run --scope weekly

# Sync hebdomadaire
./scripts/sync-to-prod.sh --scope weekly

# Sync complete
./scripts/sync-to-prod.sh --scope all

# Sync avec filtre temporel
./scripts/sync-to-prod.sh --scope enrichment --since 2026-04-01
```

---

## 6. Variables d'environnement

| Variable             | Description                                       | Obligatoire                           | Exemple                     |
| -------------------- | ------------------------------------------------- | ------------------------------------- | --------------------------- |
| `PROD_SSH_HOST`      | Nom d'hote ou IP du serveur prod                  | Oui                                   | `prod.noselus.fr`           |
| `PROD_SSH_USER`      | Utilisateur SSH pour la connexion                 | Oui                                   | `deploy`                    |
| `PROD_DB_PASSWORD`   | Mot de passe PostgreSQL du user `noselus` en prod | Oui                                   | `s3cr3t`                    |
| `PROD_SSH_KEY`       | Chemin vers la cle SSH privee                     | Non                                   | `~/.ssh/noselus_prod`       |
| `PROD_DB_PORT`       | Port PostgreSQL sur le serveur prod               | Non (defaut: `5432`)                  | `5432`                      |
| `LOCAL_TUNNEL_PORT`  | Port local utilise pour le tunnel SSH             | Non (defaut: `5433`)                  | `5433`                      |
| `PROD_DB_USER`       | Utilisateur PostgreSQL prod                       | Non (defaut: `noselus`)               | `noselus`                   |
| `PROD_DB_NAME`       | Nom de la base PostgreSQL prod                    | Non (defaut: `noselus`)               | `noselus`                   |
| `TELEGRAM_BOT_TOKEN` | Token du bot Telegram pour les notifications      | Non                                   | `123456:ABC-DEF`            |
| `TELEGRAM_CHAT_ID`   | ID du chat Telegram pour les notifications        | Non                                   | `-100123456789`             |
| `LOG_FILE`           | Chemin du fichier de log de sync                  | Non (defaut: `/tmp/sync-to-prod.log`) | `/var/log/sync-to-prod.log` |

Ces variables sont stockees dans `.env.prod` a la racine du projet (voir section 7).

---

## 7. Securite

### 7.1 Tunnel SSH uniquement

Aucun port PostgreSQL n'est expose publiquement sur le serveur prod. La seule voie d'acces
est via le tunnel SSH. Le port 5432 du serveur prod est uniquement accessible depuis localhost
(liaison `127.0.0.1:5432` dans Docker Compose).

### 7.2 Fichier `.env.prod`

Les credentials prod sont stockes dans `.env.prod` a la racine du projet :

```bash
# .env.prod — NE JAMAIS COMMITER CE FICHIER
PROD_SSH_HOST=prod.noselus.fr
PROD_SSH_USER=deploy
PROD_SSH_KEY=~/.ssh/noselus_prod
PROD_DB_PORT=5432
PROD_DB_PASSWORD=<mot_de_passe_prod>
LOCAL_TUNNEL_PORT=5433
```

Le fichier `.env.prod` est reference dans `.gitignore` :

```
.env.prod
*.dump
```

### 7.3 Cle SSH

- Utiliser une cle SSH dediee pour la prod (ne pas reutiliser la cle personnelle)
- Utiliser ssh-agent avec une cle protegee par passphrase si l'environnement le permet ; pour les
  syncs automatisees (cron, CI/CD), une cle sans passphrase est acceptable a condition d'etre
  stockee dans un secrets manager ou les GitHub Secrets
- Sur le serveur prod, restreindre les commandes autorisees dans `~/.ssh/authorized_keys`
  (recommande : `command="..."` pour limiter aux transferts uniquement)

### 7.4 Credentials prod jamais commites

- `.env.prod` dans `.gitignore`
- Verifier avant chaque commit : `git diff --cached | grep -i password` ne doit rien retourner
- Le script `sync-to-prod.sh` lui-meme ne contient aucun credential en dur

### 7.5 Migrations backward-compatible (regle de pratique)

Toute migration Drizzle doit etre **additive** pour que l'ancien code survive le temps que
la sync soit completee et que la nouvelle version soit deployee.

**Autorise** :

- Ajout de colonne `NOT NULL` avec valeur par defaut
- Ajout de colonne nullable
- Ajout de table
- Ajout d'index

**Interdit sans etape intermediaire** :

- Suppression de colonne ou de table (l'ancien code plantera s'il reference la colonne)
- Renommage de colonne ou de table
- Changement de type incompatible (ex: `text` -> `integer`)
- Ajout de contrainte `NOT NULL` sans valeur par defaut sur une colonne existante

Pour les operations destructives (drop, rename), utiliser une migration en deux phases :

1. Migration 1 : rendre la colonne nullable ou ajouter la nouvelle colonne en parallele
   -> deployer le code compatible avec les deux etats
2. Migration 2 : supprimer l'ancienne colonne ou contrainte
   -> deployer apres que la sync et le deploiement de l'etape 1 sont confirmes

---

## 8. Observabilite

### 8.1 Logs structures

`sync-to-prod.sh` ecrit un log horodate dans `${LOG_FILE:-/tmp/sync-to-prod.log}` :

```
[2026-05-05 14:32:01] INFO  Tunnel SSH ouvert (PID 12345)
[2026-05-05 14:32:03] INFO  Connexion prod verifiee
[2026-05-05 14:32:03] START scope=weekly etl=etl-an-download
[2026-05-05 14:35:12] DONE  scope=weekly etl=etl-an-download duration=189s
[2026-05-05 14:35:12] START scope=weekly etl=etl-an-incremental
[2026-05-05 14:41:05] ERROR scope=weekly etl=etl-an-incremental exit_code=1
[2026-05-05 14:41:05] INFO  Tunnel SSH ferme
```

### 8.2 Notifications Telegram

Si `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` sont definis (deja dans `.env.example`), utiliser
FemtoLogger (deja present dans `src/lib/server/etl/notifications.ts`) pour notifier :

- Debut de sync (scope, machine source)
- Fin de sync (duree totale, nombre d'ETLs executes)
- Erreur (ETL en echec, message d'erreur)

Ces variables sont deja disponibles — elles sont documentees dans la section 6.

### 8.3 Scheduling

La spec ne prescrit pas de scheduling — c'est un choix operationnel. Trois approches courantes :

- **Manuel** : `source .env.prod && ./scripts/sync-to-prod.sh --scope weekly` — adapte tant que
  la frequence est irreguliere
- **Cron local** : entree crontab sur la machine de developpement — simple, mais depend de la
  disponibilite de la machine
- **CI/CD GitHub Actions** : workflow `schedule:` avec secrets GitHub pour les credentials prod —
  recommande pour les equipes ou les syncs regulieres ; les secrets `PROD_SSH_*` et
  `PROD_DB_PASSWORD` sont stockes dans GitHub Secrets

---

## 9. Deploiement et ordre des operations

### 9.1 Ordre imperatif : migrations avant code

Deployer une nouvelle version du code avant d'appliquer les migrations Drizzle correspondantes
provoque des erreurs au demarrage (colonnes ou tables manquantes). L'ordre est imperatif :

```
1. Appliquer les migrations en prod  →  npm run db:migrate  (sur le serveur prod)
2. Deployer la nouvelle image Docker →  docker compose pull && docker compose up -d
3. Lancer la sync ETL               →  ./scripts/sync-to-prod.sh --scope all
```

Ne jamais inverser les etapes 1 et 2.

### 9.2 Migrations au demarrage du conteneur

Si le `Dockerfile` ou l'entrypoint de l'application applique automatiquement les migrations au
demarrage (`npm run db:migrate` dans le CMD ou un script d'init), l'ordre est garanti
mecaniquement : le conteneur ne devient healthy qu'une fois les migrations appliquees, et
Traefik ne lui envoie du trafic qu'apres le healthcheck.

Verifier si ce comportement est configure dans le projet avant de s'appuyer sur cet ordre
automatique — en l'absence de confirmation, appliquer les migrations manuellement (9.1).

### 9.3 Validation de compatibilite dans sync-to-prod.sh

La validation decrite en section 5.2 (etape 4) protege contre l'envoi de donnees vers une prod
dont le schema n'est pas encore a jour. Elle compare le nombre de migrations dans
`__drizzle_migrations` local et prod, et refuse de syncer si les compteurs different (exit 3).

Ce mecanisme detecte :

- Schema local en avance sur prod (migrations non encore appliquees en prod)
- Schema prod en avance sur local (cas rare : migration appliquee en prod manuellement)

Il ne detecte pas les divergences de contenu a meme nombre de migrations (ex : migration
rejouee avec un contenu different). Ce cas ne peut pas se produire avec Drizzle en usage normal.

---

## 10. Verification post-sync

Apres chaque sync, comparer les counts entre local et prod via le tunnel.

**Prerequis : le tunnel doit etre ouvert.** `sync-to-prod.sh` ferme le tunnel dans son trap
`EXIT` a la fin de l'execution. La verification post-sync est une etape manuelle separee —
l'utilisateur doit ouvrir un nouveau tunnel (section 10.2) avant d'appeler `db-query-prod.sh`.
Pour une verification integree au script, ajouter une etape de verification avant la fermeture
du tunnel (avant le trap EXIT) en utilisant `db-query-prod.sh` avec le `LOCAL_TUNNEL_PORT` deja
ouvert.

### 10.1 Spec de `scripts/db-query-prod.sh`

```bash
#!/usr/bin/env bash
# Interface unique pour les requetes SQL vers la base prod via tunnel SSH
# Usage : ./scripts/db-query-prod.sh "SELECT ..."
# Prerequis : tunnel SSH ouvert sur LOCAL_TUNNEL_PORT (defaut: 5433)

set -euo pipefail

SQL="$1"
HOST="${PROD_TUNNEL_HOST:-localhost}"
PORT="${LOCAL_TUNNEL_PORT:-5433}"
USER="${PROD_DB_USER:-noselus}"
DB="${PROD_DB_NAME:-noselus}"

PGPASSWORD="${PROD_DB_PASSWORD}" psql \
  -h "${HOST}" -p "${PORT}" \
  -U "${USER}" "${DB}" \
  -c "${SQL}"
```

### 10.2 Ouvrir un tunnel temporaire

```bash
source .env.prod
ssh -N -L ${LOCAL_TUNNEL_PORT:-5433}:localhost:${PROD_DB_PORT:-5432} \
    -i ${PROD_SSH_KEY:-~/.ssh/id_rsa} \
    ${PROD_SSH_USER}@${PROD_SSH_HOST} &
VERIFY_PID=$!
```

### 10.3 Comparer les counts

```bash
# Counts locaux (via db-query.sh, conteneur local)
./scripts/db-query.sh "
  SELECT 'scrutins' as table_name, COUNT(*) as count FROM scrutins
  UNION ALL SELECT 'actors', COUNT(*) FROM actors
  UNION ALL SELECT 'laws', COUNT(*) FROM laws
  UNION ALL SELECT 'law_summaries', COUNT(*) FROM law_summaries
  UNION ALL SELECT 'scrutin_similar', COUNT(*) FROM scrutin_similar
  ORDER BY table_name;
"

# Counts prod (via db-query-prod.sh)
./scripts/db-query-prod.sh "SELECT 'scrutins' as table_name, COUNT(*) as count FROM scrutins
    UNION ALL SELECT 'actors', COUNT(*) FROM actors
    UNION ALL SELECT 'laws', COUNT(*) FROM laws
    UNION ALL SELECT 'law_summaries', COUNT(*) FROM law_summaries
    UNION ALL SELECT 'scrutin_similar', COUNT(*) FROM scrutin_similar
    ORDER BY table_name;"
```

### 10.4 Verifier sync_metadata

```bash
# Local
./scripts/db-query.sh "
  SELECT source, entity_type, last_sync_at, last_sync_status, records_processed
  FROM sync_metadata
  ORDER BY last_sync_at DESC
  LIMIT 20;
"

# Prod (via db-query-prod.sh)
./scripts/db-query-prod.sh "SELECT source, entity_type, last_sync_at, last_sync_status, records_processed
    FROM sync_metadata ORDER BY last_sync_at DESC LIMIT 20;"
```

### 10.5 Fermer le tunnel de verification

```bash
kill $VERIFY_PID
```

---

## 11. Rollback

### 11.1 Sync partielle (un ETL a echoue)

Si la sync s'est arretee en cours de route (ex: ETL numero 4 a echoue apres que les ETL 1-3
ont tourne) :

1. Identifier l'ETL en echec dans les logs
2. Corriger le probleme (schema, donnees, connexion)
3. Relancer `sync-to-prod.sh` avec le meme `--scope` : les ETL deja executes sont idempotents,
   ils ne re-insereront pas les donnees deja presentes (protection via `sync_metadata`)
4. Aucune action manuelle necessaire sur la base prod

### 11.2 Donnees incorrectes inserees en prod

Si des donnees incorrectes ont ete inserees (ex: suite a un bug ETL) :

1. Corriger le bug dans le script ETL local
2. Identifier les donnees incorrectes via `db-query-prod.sh` avec le tunnel ouvert
3. Supprimer ou corriger les enregistrements errones manuellement via `db-query-prod.sh`
4. Mettre a jour `sync_metadata` pour forcer la re-execution du delta concerne :
   ```sql
   UPDATE sync_metadata
   SET last_processed_id = '<id_avant_donnees_incorrectes>'
   WHERE etl_name = '<nom_etl>';
   ```
5. Relancer `sync-to-prod.sh --scope <scope>`

### 11.3 Restauration complete depuis un dump

En dernier recours, si la base prod est dans un etat incoherent :

1. Generer un dump propre en local (voir Phase 1, etape 3.1 — `./scripts/db-dump.sh`)
2. Executer le bootstrap complet (Phase 1, etapes 3.2 a 3.4)
3. Verifier avec les counts (section 10)

Cette operation entraine une breve indisponibilite pendant la restauration.
