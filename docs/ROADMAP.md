

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

### 4.6 Positionnement politique automatisé
- [x] Intégrer données ParlGov (1700+ partis européens)
- [x] Implémenter fuzzy Jaccard matching (75% success rate)
- [x] Éliminer hardcoding spectrumOrder AN/PE (71 IDs)
- [x] ETL import automatisé avec CLI flags (--dry-run, --verbose)
- [x] Migration DB + index politicalPosition
- [x] 124 tests (100% coverage module ParlGov)
- [x] Migrer positions PE vers DB (seed script Chapel Hill Expert Survey)

---

## Phase 5 - Soft Launch (19-22 semaines)

### 5.1 Qualité
- [ ] Tests unitaires API
- [x] Tests E2E interface
- [x] Audit de sécurité statique + Security Headers HTTP
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
- [x] ETL votes en session plénière (via HowTheyVote.eu API)
- [x] Historique des mandats européens (depuis 2004) - 303 MEPs, 554 mandats, termes 6-10

### 7.2 Interface eurodéputés
- [x] Page `/eurodeputes` - Liste des eurodéputés français avec filtres (84 MEPs, infinite scroll)
- [x] Fiche détaillée eurodéputé (profil + groupe + mandats)
- [x] Statistiques de vote au Parlement européen (via ETL HowTheyVote.eu)
- [x] Comparaison entre eurodéputés (`/eurodeputes/compare`)

### 7.3 Intégration multi-chambres
- [x] Navigation unifiée AN / Sénat / PE (liens dans header)
- [x] Recherche globale tous élus français (`/recherche`)
- [x] Statistiques comparées entre chambres (page `/stats`)

---

## Sources de données

| Source | Type | Statut | Documentation |
|--------|------|--------|---------------|
| NosDéputés.fr | API JSON | ✅ Fait | [API](https://www.nosdeputes.fr/api) |
| NosSénateurs.fr | API JSON | ⚠️ Inaccessible | Site archivé |
| Assemblée Nationale | JSON/XML | ✅ Fait | [data.assemblee-nationale.fr](https://data.assemblee-nationale.fr/) |
| Sénat | API + CSV | ✅ Fait | [data.senat.fr](https://data.senat.fr/) |
| ParlTrack | JSON dump | ✅ Fait | [parltrack.org](https://parltrack.org/dumps/) |
| EU Election Results | HTML/CSS | ✅ Fait | [results.elections.europa.eu](https://results.elections.europa.eu) |
| HowTheyVote.eu | API JSON | ✅ Fait | [howtheyvote.eu](https://howtheyvote.eu) |
| Légifrance | API PISTE | Planifié | [legifrance.gouv.fr](https://www.legifrance.gouv.fr/contenu/pied-de-page/open-data-et-api) |

### Limitations des sources

**NosDéputés.fr (Regards Citoyens)** ✅
- Site de nouveau accessible (janvier 2026)
- Statistiques d'activité parlementaire importées (586 députés) :
  - Semaines de présence, présences en commission
  - Interventions en hémicycle et commission
  - Amendements signés/adoptés, rapports
  - Questions écrites/orales
- **ETL** : `make etl-nosdeputes-stats`

**NosSénateurs.fr (Regards Citoyens)** ⚠️
- Site toujours inaccessible
- **ETL prêt** : `make etl-nossenateurs-stats`
- **Alternative utilisée** : Données d'activité récupérées via senat.fr officiel

**Sénat - Votes nominatifs**
- Le Sénat ne publie pas les votes individuels nominatifs de manière exploitable
- Seuls les résultats agrégés des scrutins sont disponibles
- Impact : pas de statistiques de vote ni de comparaison pour les sénateurs

---

## Phase 8 - Parité fonctionnelle multi-chambres (39-46 semaines)

### 8.1 Analyse des fonctionnalités AN existantes

| Fonctionnalité AN | Page | PE | Sénat | Notes |
|------------------|------|:---:|:-----:|-------|
| Liste élus avec filtres | `/an/deputes` | ✅ | ✅ | Déjà implémenté |
| Fiche détaillée élu | `/an/deputes/[id]` | ✅ | ✅ | Déjà implémenté |
| Historique mandats | `/an/deputes/[id]` | ✅ | ✅ | Déjà implémenté |
| Liste groupes | `/an/groupes` | 🔜 | 🔜 | À implémenter |
| Détail groupe | `/an/groupes/[id]` | 🔜 | 🔜 | À implémenter |
| Liste scrutins | `/an/scrutins` | 🔜 | ❌ | PE: données HowTheyVote, Sénat: pas de données |
| Détail scrutin | `/an/scrutins/[id]` | 🔜 | ❌ | PE: votes disponibles, Sénat: bloqué |
| Statistiques | `/an/stats` | 🔜 | ❌ | PE: calculable, Sénat: pas de votes |
| Carte/Hémicycle | `/an/carte` | ✅ | ❌ | PE: implémenté, Sénat: pas de positionnement |
| Comparateur élus | `/an/compare` | ✅ | ❌ | PE: déjà fait, Sénat: nécessite votes |

**Légende**: ✅ Fait | 🔜 À faire | ❌ Bloqué (données manquantes)

### 8.2 Parlement européen (PE) - 89% faisable

Pages implémentées :
- [x] `/pe/groupes` - Liste des 9 groupes politiques européens
- [x] `/pe/groupes/[id]` - Détail groupe avec membres français
- [x] `/pe/scrutins` - Liste des scrutins PE (données HowTheyVote.eu)
- [x] `/pe/scrutins/[id]` - Détail scrutin avec votes par eurodéputé
- [x] `/pe/stats` - Statistiques de vote PE (participation, cohésion groupes)
- [x] `/pe/carte` - Visualisation hémicycle européen (spectre gauche-droite)

Données disponibles :
- ✅ Eurodéputés français (84 actuels, 303 historiques depuis 2004)
- ✅ Groupes politiques européens avec couleurs
- ✅ Votes en session plénière (via HowTheyVote.eu API)
- ✅ Mandats historiques termes 6-10

### 8.3 Sénat - 33% faisable (bloqué)

Pages implémentées :
- [x] `/senat/senateurs` - Liste des sénateurs (348)
- [x] `/senat/senateurs/[id]` - Fiche détaillée sénateur
- [x] `/senat/groupes` - Liste des groupes sénatoriaux
- [x] `/senat/groupes/[id]` - Détail groupe avec membres

Pages bloquées (absence de données) :
- ❌ `/senat/scrutins` - Pas de données de scrutins publics
- ❌ `/senat/scrutins/[id]` - Pas de votes individuels
- ❌ `/senat/stats` - Nécessite votes pour calculer statistiques
- ❌ `/senat/compare` - Comparaison nécessite votes

**Problème**: Le Sénat ne publie pas les votes individuels nominatifs de manière exploitable.
Sources explorées sans succès :
- data.senat.fr : dossiers législatifs uniquement
- API senat.fr : liste sénateurs et commissions uniquement
- NosSénateurs.fr : site fermé

**Piste potentielle**: Scraping des comptes-rendus de séance (complexe, non fiable)

### 8.4 Infrastructure commune

Améliorations déjà implémentées :
- [x] Store unifié `chamber-period.ts` (cookies pour persistance)
- [x] Hooks server pour lecture périodes depuis cookies
- [x] Sélecteurs de période contextuels par chambre
- [x] Valeur par défaut : mandature en cours (plus "toutes")
- [x] Filtrage dropdowns comparateur par période sélectionnée

### 8.5 Ordre d'implémentation recommandé

1. **PE Groupes** (1-2 jours)
   - `/pe/groupes` - Liste groupes européens
   - `/pe/groupes/[id]` - Détail avec membres

2. **PE Scrutins** (2-3 jours)
   - `/pe/scrutins` - Liste scrutins avec filtres
   - `/pe/scrutins/[id]` - Détail scrutin + votes

3. **PE Stats** (1-2 jours)
   - `/pe/stats` - Dashboard statistiques PE

4. **Sénat Groupes** (1 jour)
   - `/senat/groupes` - Liste groupes sénatoriaux
   - `/senat/groupes/[id]` - Détail avec membres

5. **Investigation Sénat votes** (exploration)
   - Rechercher sources alternatives pour votes nominatifs
   - Évaluer faisabilité scraping comptes-rendus

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
