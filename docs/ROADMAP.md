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
- [ ] ETL Assemblée Nationale (data.assemblee-nationale.fr) - Députés *(optionnel, nécessite données Tricoteuses)*
- [ ] ETL Assemblée Nationale - Scrutins détaillés *(optionnel)*
- [ ] ETL Assemblée Nationale - Amendements *(Phase 2)*
- [ ] ETL Sénat (data.senat.fr) - Sénateurs *(Phase 2)*
- [ ] ETL Sénat - Travaux législatifs (DOSLEG) *(Phase 2)*

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
- [ ] Intégrer données AN historiques depuis 1997
- [ ] Consolider affiliations politiques successives
- [ ] Mapper les mandats avec les législatures

### 2.2 Votes historiques
- [ ] Charger scrutins archivés XIVe législature
- [ ] Charger scrutins archivés XVe législature
- [ ] Charger scrutins XVIe législature (actuelle)

### 2.3 Dossiers législatifs
- [ ] ETL dossiers législatifs AN
- [ ] ETL dossiers législatifs Sénat (DOSLEG)
- [ ] Lier scrutins aux textes de loi

---

## Phase 3 - UI initiale (9-12 semaines)

### 3.1 Pages principales
- [x] Page d'accueil avec statistiques clés
- [x] Liste des députés avec filtres et recherche
- [ ] Liste des sénateurs avec filtres *(Phase 2 - données non disponibles)*
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
- [ ] Taux de participation par député
- [ ] Cohésion de vote par groupe
- [ ] Alignement avec le gouvernement
- [ ] Évolution des positions dans le temps

### 4.2 Visualisations
- [ ] Graphiques temporels des votes
- [ ] Heatmap des votes par groupe
- [ ] Carte des circonscriptions
- [ ] Timeline de carrière politique

### 4.3 Comparateur
- [ ] Comparaison de deux élus
- [ ] Similarité de vote
- [ ] Distance politique calculée

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

## Sources de données

| Source | Type | Statut | Documentation |
|--------|------|--------|---------------|
| NosDéputés.fr | API JSON | En cours | [API](https://www.nosdeputes.fr/api) |
| Assemblée Nationale | JSON/XML | À faire | [data.assemblee-nationale.fr](https://data.assemblee-nationale.fr/) |
| Sénat | CSV/SQL | À faire | [data.senat.fr](https://data.senat.fr/) |
| Légifrance | API PISTE | Planifié | [legifrance.gouv.fr](https://www.legifrance.gouv.fr/contenu/pied-de-page/open-data-et-api) |

---

## Notes techniques

- **Stack**: SvelteKit + TypeScript + PostgreSQL + Drizzle ORM
- **Législature actuelle**: 16 (nosdeputes.fr), 17 pas encore disponible
- **Fréquence ETL**: À définir (quotidien/hebdomadaire)
