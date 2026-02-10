# Guide d'Utilisation des ETL

Documentation synthétique des 35 pipelines ETL disponibles.

## 📋 Vue d'Ensemble

| Catégorie | Nombre | Description |
|-----------|--------|-------------|
| Assemblée Nationale | 10 | Import députés, scrutins, lois, amendements |
| Sénat | 4 | Import sénateurs, lois, statistiques |
| Parlement Européen | 7 | Import eurodéputés, votes, lois PE |
| Analyse IA | 2 | Classifications et analyses LLM (Ollama) |
| Enrichissement | 1 | Textes complets via API |
| Utilitaires | 6 | Couleurs, positions politiques, stats |

## 🔧 Options CLI Standard

Tous les scripts ETL supportent :

| Option | Flag | Description |
|--------|------|-------------|
| `--dry-run` | `-n` | Simulation (pas d'écriture DB) |
| `--limit N` | `-l` | Limite le nombre d'entités |
| `--verbose` | `-v` | Logs détaillés |
| `--help` | `-h` | Affiche l'aide |

**Exemple** : `npm run etl:europarl-law-texts -- --dry-run --limit 10 --verbose`

---

## 📥 ETL Assemblée Nationale

| Objectif | Commande | Prérequis | Résultats |
|----------|----------|-----------|-----------|
| **Télécharger données AN** | `make etl-an-download` | Aucun | ~160 Mo dans `data/assemblee/` |
| **Import complet AN** | `make etl-an-all` | `etl-an-download` | 2100 députés + 17872 scrutins + 1.99M votes |
| **Import incrémental** | `make etl-an-incremental` | `etl-an-all` | Nouveaux/modifiés uniquement (via `sync_metadata`) |
| **Import députés** | `make etl-an-actors` | `etl-an-download` | 2100 députés, 12245 mandats (législatures 12-17) |
| **Import scrutins + votes** | `make etl-an-scrutins` | `etl-an-download` + `etl-an-actors` | 17872 scrutins + 1.99M votes individuels |
| **Import lois AN** | `make etl-an-laws` | Aucun | Dossiers législatifs AN |
| **Lier scrutins ↔ lois** | `make etl-an-link-laws` | `etl-an-scrutins` + `etl-an-laws` | Liens scrutins ↔ textes (parsing titres) |
| **Import dossiers complets** | `make etl-an-dossiers` | Aucun | Dossiers législatifs + cosignataires |
| **Import amendements** | `make etl-an-amendements` | Aucun | Amendements AN (législatures 15-17) |
| **Stats NosDéputés.fr** | `make etl-an-nosdeputes` | `etl-an-actors` | Statistiques activité (586 députés) |
| **Stats NosDéputés (v2)** | `make etl-an-nosdeputes-stats` | `etl-an-actors` | Interventions, présences, amendements |

---

## 🏛️ ETL Sénat

| Objectif | Commande | Prérequis | Résultats |
|----------|----------|-----------|-----------|
| **Import dossiers Sénat** | `make etl-senat-laws` | Aucun | 12171 dossiers législatifs (DOSLEG, depuis 1977) |
| **Import sénateurs** | `make etl-senat-senators` | Aucun | 348 sénateurs + 9 groupes |
| **Historique mandats** | `make etl-senat-mandates-history` | `etl-senat-senators` | Mandats sénatoriaux historiques |
| **Stats sénateurs** | `make etl-senat-activity-stats` | `etl-senat-senators` | Activité depuis senat.fr officiel |
| **Stats NosSénateurs** | `make etl-nossenateurs-stats` | `etl-senat-senators` | (site fermé, prêt si réouverture) |

⚠️ **Note** : Le Sénat ne publie pas les votes individuels nominatifs. Pas de scrutins importables.

---

## 🇪🇺 ETL Parlement Européen

| Objectif | Commande | Prérequis | Résultats |
|----------|----------|-----------|-----------|
| **Import eurodéputés** | `make etl-europarl-meps` | Aucun | 84 eurodéputés FR (ParlTrack, mandat 10: 2024-2029) |
| **Historique eurodéputés** | `make etl-europarl-historical` | `etl-europarl-meps` | 303 eurodéputés, 554 mandats (termes 6-10, 2004-présent) |
| **Import votes PE** | `make etl-europarl-votes` | `etl-europarl-meps` | Votes plénière + votes individuels FR (HowTheyVote.eu) |
| **Import lois PE** | `make etl-europarl-laws` | Aucun | 2039 procédures PE (termes 8-10, HowTheyVote.eu) |
| **Enrichir textes lois PE** | `make etl-europarl-law-texts` | `etl-europarl-laws` + `etl-europarl-votes` | Descriptions (OEIL + communiqués), 2204 scrutins ↔ lois |
| **Enrichir groupes PE** | `make etl-europarl-enrich-groups` | `etl-europarl-meps` | Noms longs des groupes PE |
| **Stats eurodéputés** | `make etl-europarl-activity-stats` | `etl-europarl-meps` | Activité depuis HowTheyVote.eu |

---

## 🤖 ETL Analyse IA (nécessite Ollama)

⚠️ **Prérequis** : `ollama serve` + `ollama pull mistral-nemo`

| Objectif | Commande | Prérequis | Résultats |
|----------|----------|-----------|-----------|
| **Classifier scrutins** | `make etl-classify-scrutins` | `etl-an-scrutins` ou `etl-europarl-votes` | Catégories sémantiques (via LLM) |
| **Analyser lois (LLM)** | `make etl-analyze-laws` | `etl-an-laws` ou `etl-europarl-laws` | Analyses texte complet (Ollama) |

---

## 📄 ETL Enrichissement

| Objectif | Commande | Prérequis | Résultats |
|----------|----------|-----------|-----------|
| **Textes via Légifrance** | `make etl-law-texts` | `etl-an-laws` | Textes complets via API PISTE |

---

## 🎨 ETL Utilitaires

| Objectif | Commande | Prérequis | Résultats |
|----------|----------|-----------|-----------|
| **Sync couleurs** | `make etl-colors` | `etl-an-actors` + `etl-senat-senators` + `etl-europarl-meps` | Couleurs groupes parlementaires |
| **Couleurs externes** | `make etl-external-colors` | `etl-europarl-meps` + `etl-senat-senators` | Couleurs PE (europa.eu) + Sénat (senat.fr) |
| **Positions politiques** | `make etl-political-positions` | Groupes existants | Positions ParlGov (1700+ partis EU) |
| **Seed positions PE** | `make etl-seed-pe-positions` | `etl-europarl-meps` | Positions PE (Chapel Hill Expert Survey) |

---

## 🔄 Workflows Recommandés

### Premier import complet

```bash
# 1. Données Assemblée Nationale
make etl-an-download              # Télécharge données (~160 Mo)
make etl-an-all                   # Import complet AN

# 2. Sénat
make etl-senat-senators        # Import sénateurs
make etl-senat-laws            # Import dossiers Sénat

# 3. Parlement Européen
make etl-europarl-meps         # Import eurodéputés
make etl-europarl-historical   # Historique
make etl-europarl-votes        # Import votes PE
make etl-europarl-laws         # Import lois PE
make etl-europarl-law-texts    # Enrichir textes

# 4. Enrichissements
make etl-colors                # Couleurs groupes
make etl-political-positions   # Positions politiques
make etl-an-nosdeputes-stats   # Stats députés
make etl-senat-activity-stats  # Stats sénateurs
```

### Mise à jour incrémentale

```bash
# Nouveaux scrutins/votes uniquement
make etl-an-incremental

# Nouvelles statistiques
make etl-an-nosdeputes-stats
make etl-senat-activity-stats
make etl-europarl-activity-stats
```

### Test d'un ETL

```bash
# Mode dry-run avec limite
npm run etl:europarl-law-texts -- --dry-run --limit 5 --verbose

# Ou via Makefile (si target -dry existe)
make etl-europarl-law-texts-dry
```

---

## 📊 Résultats Attendus (Base Complète)

| Entité | Nombre | Source |
|--------|--------|--------|
| **Députés** | 2100 | AN + NosDéputés.fr |
| **Mandats députés** | 12245 | AN (législatures 12-17) |
| **Scrutins AN** | 17872 | AN (législatures 14-17) |
| **Votes individuels AN** | 1.99M | AN |
| **Sénateurs** | 348 | Sénat API |
| **Dossiers Sénat** | 12171 | Sénat DOSLEG (1977-présent) |
| **Eurodéputés** | 84 actuels, 303 historiques | ParlTrack |
| **Votes PE** | ~2200 scrutins + votes individuels | HowTheyVote.eu |
| **Lois PE** | 2039 procédures | HowTheyVote.eu |
| **Groupes** | 11 AN + 9 Sénat + 9 PE | APIs officielles |

---

## ⚙️ Configuration

### Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `ETL_DATA_DIR` | `./data/assemblee` | Répertoire données AN |
| `ETL_CACHE_DIR` | `data/cache` | Répertoire cache |
| `ETL_LEGISLATURE` | `17` | Législature par défaut |

### Cache et TTL

Configurables dans `src/lib/server/etl/config.ts` :

```typescript
export const ETL_CONFIG = {
  cacheTtl: {
    votes: 24,      // 24h
    laws: 168,      // 7 jours
    actors: 720,    // 30 jours
  }
};
```

---

## 🐛 Debugging

### Logs détaillés

```bash
# Activer mode verbose
npm run etl:nom-etl -- --verbose

# Ou via variables d'environnement
DEBUG=* npm run etl:nom-etl
```

### Tests dry-run

```bash
# Tester sans écrire en base
npm run etl:nom-etl -- --dry-run --limit 10
```

### Vérifier résultats

```bash
# Via PostgreSQL
./scripts/db-query.sh "SELECT COUNT(*) FROM actors WHERE chamber = 'AN';"

# Via logs
grep "RÉSUMÉ" logs/etl-*.log
```

---

## 📚 Ressources

- **Architecture ETL** : `src/lib/server/etl/sources/europarl/README.md`
- **Standards CLI** : `.serena/memories/std-etl-cli-scripts.md`
- **Convention Makefile** : `.serena/memories/etl-makefile-rule.md`
- **Données** : `docs/ETL-DATA.md`
- **Config** : `src/lib/server/etl/config.ts`

---

## ⚠️ Notes Importantes

1. **Ordre d'exécution** : Respecter les prérequis (ex: `etl-an-actors` avant `etl-an-scrutins`)
2. **Idempotence** : Les ETL sont idempotents (safe de ré-exécuter)
3. **Cache** : Les données téléchargées sont mises en cache (`data/`)
4. **Rate limiting** : APIs externes avec delays (500ms entre requêtes)
5. **Durée** : Import complet ~30-45 min selon connexion
