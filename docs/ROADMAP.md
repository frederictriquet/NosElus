

# Roadmap NosElus

## Phase 1 - Fondations (0-4 semaines)

### 1.1 Inventaire des sources & modèles de données
- [x] Cataloguer les API / dumps disponibles (AN, Sénat, NosDéputés, data.gouv.fr)
- [x] Concevoir schéma DB unifié (députés + sénateurs + lois + votes)
- [x] Configurer PostgreSQL avec Drizzle ORM

### 1.2 Ingestion initiale (ETL)
- [x] ETL NosDéputés.fr - Députés
- [x] ETL NosDéputés.fr - Groupes parlementaires
- [x] ETL NosDéputés.fr - Scrutins
- [x] ETL NosDéputés.fr - Votes individuels
- [x] ETL Assemblée Nationale (data.assemblee-nationale.fr) - Députés historiques (2100 députés, 12 245 mandats)
- [x] ETL Assemblée Nationale - Scrutins détaillés (17 872 scrutins, 15e-17e législatures)
- [x] ETL Assemblée Nationale - Votes nominatifs (1 993 587 votes)
- [x] ETL Assemblée Nationale - Amendements (15e-17e législatures)
- [x] ETL Sénat (API senat.fr) - Sénateurs (348 sénateurs, 9 groupes)
- [x] ETL Sénat (data.senat.fr) - Travaux législatifs (DOSLEG) - 12 171 dossiers

### 1.3 API de base (backend)
- [x] Endpoint REST `/api/v1/actors` - Liste des députés (618 importés)
- [x] Endpoint REST `/api/v1/actors/:id` - Détail d'un élu + votes
- [x] Endpoint REST `/api/v1/scrutins` - Liste des scrutins (4105 importés)
- [x] Endpoint REST `/api/v1/scrutins/:id` - Détail d'un scrutin avec votes
- [x] Endpoint REST `/api/v1/organs` - Groupes parlementaires (11 importés)
- [x] Endpoint REST `/api/v1/search` - Recherche globale
- [x] Pagination, filtres et tri sur tous les endpoints

---

## Phase 2 - Données historiques (5-8 semaines)

### 2.1 Historique députés
- [x] Intégrer données AN historiques depuis 1997 (2100 députés, législatures 12-17)
- [x] Consolider affiliations politiques successives (8321 mandats GP)
- [x] Mapper les mandats avec les législatures (3924 mandats député)

### 2.2 Votes historiques
- [x] Charger scrutins archivés XIVe législature (via @tricoteuses/assemblee)
- [x] Charger scrutins archivés XVe législature (via @tricoteuses/assemblee)
- [x] Charger scrutins XVIe législature (via @tricoteuses/assemblee)
- [x] Support import incrémental avec tracking des syncs

### 2.3 Dossiers législatifs
- [x] ETL dossiers législatifs AN
- [x] ETL dossiers législatifs Sénat (DOSLEG) - 12 171 dossiers depuis 1977
- [x] Lier scrutins aux textes de loi

---

## Phase 3 - UI initiale (9-12 semaines)

### 3.1 Pages principales
- [x] Page d'accueil avec statistiques clés
- [x] Liste des députés avec filtres et recherche
- [x] Liste des sénateurs avec filtres et recherche (348 sénateurs)
- [x] Fiche détaillée d'un élu (profil + votes)
- [x] Liste des scrutins avec filtres (date, résultat)
- [x] Détail d'un scrutin (votes par position, par député)
- [x] Liste des groupes parlementaires
- [x] Détail d'un groupe parlementaire

### 3.2 Recherche et navigation
- [x] Recherche par nom de député
- [x] Recherche par titre de scrutin
- [x] Filtres par résultat (adopté/rejeté)
- [x] Pagination sur toutes les listes

---

## Phase 4 - Analyse avancée (13-18 semaines)

### 4.1 Statistiques
- [x] Taux de participation par député (Top 10)
- [x] Cohésion de vote par groupe (tableau votes par groupe)
- [x] Répartition globale des votes (pour/contre/abstention)
- [x] Activité mensuelle (graphique à barres)
- [x] Résultats des scrutins (adoptés/rejetés)
- [x] Alignement avec le gouvernement (majorité présidentielle REN/MODEM/HOR)
- [x] Évolution des positions dans le temps (graphique mensuel)

### 4.2 Visualisations
- [x] Graphique barres activité mensuelle
- [x] Barre de répartition des votes
- [x] Heatmap des votes par groupe (15 derniers scrutins)
- [x] Matrice de proximité politique entre groupes
- [x] Évolution temporelle des votes par député
- [x] Statistiques et évolution par groupe parlementaire
- [x] Période d'activité parlementaire (premier/dernier vote)
- [x] Badge groupe parlementaire sur page député
- [x] Carte politique avec hémicycle et Leaflet
- [x] Timeline de carrière (jalons d'activité parlementaire)

### 4.3 Comparateur
- [x] Comparaison de deux élus
- [x] Similarité de vote (taux d'accord)
- [x] Liste des votes divergents
- [x] Distance politique calculée (pondérée selon type de désaccord)

---

## Phase 5 - Soft Launch (19-22 semaines)

### 5.1 Qualité
- [ ] Tests unitaires API
- [ ] Tests E2E interface
- [ ] Audit de performance
- [ ] Audit d'accessibilité (RGAA)

### 5.2 Documentation
- [ ] Documentation API publique (OpenAPI/Swagger)
- [ ] Guide utilisateur
- [ ] Mentions légales et RGPD

### 5.3 Déploiement
- [ ] Configuration CI/CD
- [ ] Déploiement production
- [ ] Monitoring et alertes

---

## Phase 6 - Extensions (23-30 semaines)

### 6.1 Notifications
- [ ] Système d'alertes email
- [ ] Suivi d'un député spécifique
- [ ] Alertes sur nouveaux scrutins

### 6.2 Intégrations
- [ ] Légifrance API (textes de loi promulguées)
- [ ] Export CSV/JSON des données
- [ ] API publique pour développeurs tiers

### 6.3 Fonctionnalités collaboratives
- [ ] Annotations utilisateurs (modérées)
- [ ] Commentaires sur les votes
- [ ] Partage sur réseaux sociaux

---

## Phase 7 - Parlement européen (31-38 semaines)

### 7.1 Données eurodéputés
- [x] ETL Parlement européen - Eurodéputés français (84 MEPs via ParlTrack, mandat 10 2024-2029)
- [x] ETL Parlement européen - Groupes politiques européens (9 groupes avec couleurs officielles)
- [x] ETL couleurs groupes PE depuis results.elections.europa.eu
- [x] ETL couleurs groupes Sénat depuis senat.fr
- [ ] ETL votes en session plénière (via HowTheyVote.eu ou VoteWatch.eu)
- [ ] Historique des mandats européens (depuis 2004)

### 7.2 Interface eurodéputés
- [ ] Page `/eurodeputes` - Liste des eurodéputés français avec filtres
- [ ] Fiche détaillée eurodéputé (profil + votes européens)
- [ ] Statistiques de vote au Parlement européen
- [ ] Comparaison entre eurodéputés

### 7.3 Intégration multi-chambres
- [ ] Navigation unifiée AN / Sénat / PE
- [ ] Recherche globale tous élus français
- [ ] Statistiques comparées entre chambres

---

## Sources de données

| Source | Type | Statut | Documentation |
|--------|------|--------|---------------|
| NosDéputés.fr | API JSON | ✅ Fait | [API](https://www.nosdeputes.fr/api) |
| Assemblée Nationale | JSON/XML | ✅ Fait | [data.assemblee-nationale.fr](https://data.assemblee-nationale.fr/) |
| Sénat | API + CSV | ✅ Fait | [data.senat.fr](https://data.senat.fr/) |
| ParlTrack | JSON dump | ✅ Fait | [parltrack.org](https://parltrack.org/dumps/) |
| EU Election Results | HTML/CSS | ✅ Fait | [results.elections.europa.eu](https://results.elections.europa.eu) |
| HowTheyVote.eu | API JSON | Planifié | [howtheyvote.eu](https://howtheyvote.eu) |
| Légifrance | API PISTE | Planifié | [legifrance.gouv.fr](https://www.legifrance.gouv.fr/contenu/pied-de-page/open-data-et-api) |

---

## Notes techniques

- **Stack**: SvelteKit + TypeScript + PostgreSQL + Drizzle ORM
- **Législatures supportées**: 14, 15, 16, 17 (via @tricoteuses/assemblee)
- **Import AN**: `make etl-all-legislatures` pour importer toutes les législatures
- **Import PE**: `make etl-europarl-meps` pour importer les eurodéputés français (ParlTrack)
- **Import couleurs**: `make etl-external-colors` pour les couleurs PE/Sénat depuis sources officielles
- **Mode incrémental**: `make etl-incremental` avec tracking dans table `sync_metadata`
- **Cache ETL**: Fichiers JSON dans `data/cache/` avec TTL configurable
- **Fréquence ETL**: À définir (quotidien/hebdomadaire)
