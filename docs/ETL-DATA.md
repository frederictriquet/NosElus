# Données ETL - NosElus

Le dossier `data/` contient les données téléchargées par les scripts ETL. Il est ignoré par git (`.gitignore`).

## Structure

```
data/
├── assemblee/
│   ├── acteurs_organes/json/    # Acteurs, organes, mandats AN
│   ├── scrutins/                # Scrutins par législature
│   └── dossiers_legislatifs/json/  # Dossiers législatifs AN
└── cache/
    └── amendements_17/json/     # Cache des amendements
```

## Fonctionnement

Les ETL vérifient si les fichiers existent avant de télécharger :

```typescript
if (!fs.existsSync(jsonDir)) {
    await downloadScrutins(legislature);  // Télécharge seulement si absent
}
```

**Les fichiers sont conservés** après téléchargement et réutilisés lors des exécutions suivantes.

## Sources des données

| Source | Type | URL |
|--------|------|-----|
| AN Acteurs | ZIP → JSON | `data.assemblee-nationale.fr` |
| AN Scrutins | ZIP → JSON | `data.assemblee-nationale.fr` |
| AN Dossiers | ZIP → JSON | `data.assemblee-nationale.fr` |
| Sénat | API/CSV | `data.senat.fr`, `senat.fr/api` |
| PE ParlTrack | API JSON | `parltrack.org` |
| PE HowTheyVote | API JSON | `howtheyvote.eu/api` |
| NosDéputés | API JSON | `nosdeputes.fr` |

## Déploiement en production

### Option 1 : Copier les données existantes (recommandé)

```bash
# Copier le dossier data/ depuis un environnement existant
scp -r data/ prod:/app/data/

# Les ETL utiliseront les fichiers existants sans retélécharger
make etl-an-all
```

### Option 2 : Télécharger depuis zéro

```bash
# Télécharge les données AN (scrutins, acteurs)
make etl-an-download

# Télécharge les dossiers législatifs AN
# (fait automatiquement par etl-an-dossiers si absent)
make etl-an-dossiers

# Les autres sources (Sénat, PE) sont des APIs et téléchargent à la volée
make etl-senat-senators
make etl-europarl-meps
```

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `ETL_DATA_DIR` | `./data/assemblee` | Répertoire des données AN |
| `ETL_CACHE_DIR` | `data/cache` | Répertoire de cache |
| `ETL_LEGISLATURE` | `17` | Législature à importer |

## Taille approximative

- `assemblee/` : ~160 Mo
- `cache/` : ~360 Mo
- **Total** : ~520 Mo

## Mise à jour des données

Les données AN sont mises à jour périodiquement sur `data.assemblee-nationale.fr`. Pour forcer un re-téléchargement :

```bash
# Supprimer les données existantes
rm -rf data/assemblee/scrutins

# Re-télécharger
make etl-an-download
```

Les APIs (Sénat, PE) sont interrogées en temps réel avec un cache de quelques heures (configurable dans `src/lib/server/etl/config.ts`).
