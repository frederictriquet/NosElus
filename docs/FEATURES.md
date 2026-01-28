Voici une **liste de fonctionnalités détaillée** et une **roadmap complète** pour le développement de ton application web de suivi de l’activité parlementaire française (députés *et* sénateurs), en mettant l’accent sur les sources de données disponibles et leurs documentations. Ces éléments sont pensés pour te servir de **plan de développement concret**.

---

# **I. Feature-List (fonctionnalités)**

## 1) **Gestion des acteurs politiques**

### 1.1 Profils des députés et des sénateurs

* Informations biographiques (nom, naissance, circonscription, profession…)
* Mandats successifs (dates, circonscriptions, changements de groupe politique)
* Historique des partis politiques et groupes parlementaires
* Liens vers les commissions et les organes parlementaires
* Identifiants standardisés pour requêtes API et jointures

**Sources de données :**

* *Assemblée nationale* — historique des députés et mandats (XML/JSON) ([data.assemblee-nationale.fr][1])
* *data.gouv.fr* — fichiers sénateurs actuels et historiques ([data.gouv.fr][2])
* *NosDéputés.fr* / API réflexive consolidée ([data.gouv.fr][3])

### 1.2 Suivi du parcours politique

* Ligne du temps des partis politiques et affiliations successives
* Participation à des groupes parlementaires ou commissions
* Changements de mandat (ex : devenir ministre, quitter un groupe)

## 2) **Catalogue des lois et propositions**

### 2.1 Liste des projets et propositions de loi

* Intitulé, numéro, date de dépôt, promoteurs (gouvernement ou parlementaires)
* Texte ou lien vers le texte publié (PDF/HTML ou API législative)
* Statut (en cours d’examen, adopté, promulgué)
* Étapes de la navette parlementaire (AN, Sénat, CMP…)

**Sources :**

* *Assemblée nationale – Dossiers législatifs* (JSON/XML) ([data.assemblee-nationale.fr][1])
* *Sénat – Travaux législatifs (Dosleg)* (CSV/SQL extraits) ([data.gouv.fr][4])
* (Option) **Légifrance API** pour texte des lois promulguées ([Légifrance][5])

### 2.2 Amendements et autres documents

* Amendements (auteur(s), contenu, statut adopté/rejeté)
* Rapports parlementaires
* Comptes rendus de débats liés à la loi
* Questions parlementaires sur une loi

**Sources :**

* *Assemblée nationale – Amendements* ([data.assemblee-nationale.fr][1])
* *Sénat – Amendements (Ameli)* ([data.senat.fr][6])

## 3) **Scrutins et votes**

### 3.1 Votes individuels des députés

* Pour/Contre/Abstention/Absent pour chaque scrutin
* Classement des scrutins (par loi, article, date)
* Statistiques par député et par groupe politique

**Sources :**

* *Assemblée nationale – Scrutins (Votes)* (JSON/XML) ([data.assemblee-nationale.fr][7])
* *Assemblée nationale – Archives scrutins (XIVe/XVe législatures)* ([data.assemblee-nationale.fr][8])

### 3.2 Votes au Sénat (limité)

* Le Sénat ne publie **pas systématiquement les votes individuels des sénateurs** de façon structurée comme l’AN ; il faut parfois extraire par scraping ou consolidation externe. ([index.okfn.org][9])

## 4) **Analyse et agrégations**

### 4.1 Statistiques

* Cohésion de vote d’un député / d’un groupe
* Historique des positions par thème législatif (santé, économie…)
* Alignement gouvernement/parlementaires

### 4.2 Visualisation

* Graphiques temporels des votes par député
* Cartes interactives (circonscription / parti)
* Timeline de carrière politique / lois proposées / votes

### 4.3 Moteur de recherche et filtres

* Par député, texte de loi, thème, date, groupe politique

## 5) **Fonctionnalités avancées et valeurs ajoutées**

### 5.1 Système de notifications

* Alerte quand un député vote sur un nouveau texte
* Alerte changement de groupe politique

### 5.2 Comparateur de députés

* Similarité de vote entre deux élus
* Distance politique mesurée sur scrutins

### 5.3 API interne

* Exposer les données analysées à d’autres applications

### 5.4 Connexion avec sources légales

* Intégration texte officiel Légifrance pour chaque loi adoptée

### 5.5 Contributions utilisateurs

* Commentaires ou annotations crowdsourcées (option modérée)

### 5.6 Import / export et travail collaboratif

* Export CSV/JSON
* Intégration à outils de BI (PowerBI, Tableau…)

---

# **II. Roadmap technique**

## **Phase 1 — Fondations (0–4 semaines)**

1. **Inventaire des sources & modèles de données**

   * Cataloguer les API / dumps disponibles (AN, Sénat, NosDéputes, data.gouv.fr)
   * Concevoir schéma DB unifié (députés + sénateurs + lois + votes)

2. **Ingestion initiale (ETL)**

   * Importer liste des députés + sénateurs
   * Ingestion des scrutins des dernières législatures
   * Ingestion des dossiers législatifs actuels

3. **API de base (backend)**

   * Endpoints REST pour députés, sénateurs, scrutins, textes

## **Phase 2 — Données historiques (5–8 semaines)**

1. **Historique députés**

   * Intégrer données AN historiques depuis 1997
   * Consolider affiliations politiques successives
2. **Votes historiques**

   * Charger scrutins archivés XIVe/XVe à aujourd’hui
3. **Dossiers législatifs historiques**

   * Charger archives de lois anciennes disponibles via AN et Sénat

## **Phase 3 — UI initiale (9–12 semaines)**

1. **Tableaux récapitulatifs**

   * Député/sénateur : profil + votes + lois proposées
   * Loi : détails + votes par député + textes associés
2. **Filtres et recherche**

   * Recherche par nom, texte, date, parti

## **Phase 4 — Analyse avancée (13–18 semaines)**

1. **Statistiques & visualisation**

   * Cohésion de vote, heatmaps, timeline
2. **Fonctionnalités collaboratives**

   * Commentaires, annotations

## **Phase 5 — Soft Launch / Feedback (19–22 semaines)**

1. **Tests utilisateurs**
2. **Optimisation des performances**
3. **Documentation API publique**

## **Phase 6 — Extensions (23–30 semaines)**

1. **Notifications / alertes**
2. **Machine learning suggestions (option)**
3. **Internationalisation**

---

# **III. Sources de données & documentation**

## **Assemblée nationale (AN) – API Open Data**

* Site principal des données parlementaires (scrutins, amendements, débats, dossiers législatifs, députés) :
  [https://data.assemblee-nationale.fr/](https://data.assemblee-nationale.fr/) ([data.assemblee-nationale.fr][1])
* Détails votes JSON/XML :
  [https://data.assemblee-nationale.fr/travaux-parlementaires/votes](https://data.assemblee-nationale.fr/travaux-parlementaires/votes) ([data.assemblee-nationale.fr][7])
* Archives scrutins par législature :
  [https://data.assemblee-nationale.fr/archives-anterieures/](https://data.assemblee-nationale.fr/archives-anterieures/) ([data.assemblee-nationale.fr][8])

## **Sénat – Open Data**

* Plateforme générale des données sénatoriales (Sénateurs, amendements, questions, comptes rendus, textes) :
  [https://data.senat.fr/](https://data.senat.fr/) ([data.senat.fr][6])
* Travaux législatifs (DOSLEG) :
  [https://www.data.gouv.fr/datasets/travaux-legislatifs-senat](https://www.data.gouv.fr/datasets/travaux-legislatifs-senat) ([data.gouv.fr][4])
* Dossiers législatifs archives sénat (détails sur dossiers législatifs depuis 1977) :
  [https://data.senat.fr/dosleg/](https://data.senat.fr/dosleg/) ([data.senat.fr][10])

## **APIs & consolidateurs**

* **NosDéputés.fr** – API de données parlementaires consolidées (AN + JO) (voir doc API) ([data.gouv.fr][3])
* **Pappers Politique** – API commerciale consolidant données parlementaires diverses ([Pappers Politique][11])

## **Complément législatif**

* **Légifrance API** – texte officiel des lois promulguées (via API PISTE) ([Légifrance][5])

---

# **IV. Modèle de données simplifié (pour backend)**

### Entités principales

* **Actor** (député/sénateur): id, noms, partis successifs, mandats
* **Law**: id, titre, statut, dépôt_date, promulguée_date
* **Amendment**: id, law_id, auteur(s), contenu, statut
* **Vote**: actor_id, law_id, scrutin_id, position
* **Scrutin**: id, date, type, texte lié
* **Debate**: law_id, art_id, texte, intervenants

---

Si tu veux, je peux te fournir **des exemples de requêtes API** pour chacun des endpoints clés (AN, Sénat, NosDéputés) ainsi qu’un **schéma de base de données SQL** prêt à l’emploi.

[1]: https://data.assemblee-nationale.fr/?utm_source=chatgpt.com "Accueil - Assemblée nationale"
[2]: https://www.data.gouv.fr/datasets/les-senateurs?utm_source=chatgpt.com "Jeu de données - Les Sénateurs | data.gouv.fr"
[3]: https://www.data.gouv.fr/datasets/activit-des-dputs-de-lassemble-nationale-13me-lgislature/?utm_source=chatgpt.com "Jeu de données Activité des députés de l'Assemblée nationale (13ème législature) | data.gouv.fr"
[4]: https://www.data.gouv.fr/datasets/travaux-legislatifs-senat?utm_source=chatgpt.com "Jeu de données - Travaux législatifs (Sénat)"
[5]: https://www.legifrance.gouv.fr/contenu/pied-de-page/open-data-et-api?utm_source=chatgpt.com "Open data et API"
[6]: https://data.senat.fr/?utm_source=chatgpt.com "data.senat.fr - Sénat"
[7]: https://data.assemblee-nationale.fr/travaux-parlementaires/votes?utm_source=chatgpt.com "Votes"
[8]: https://data.assemblee-nationale.fr/archives-anterieures/archives-15e/scrutins?utm_source=chatgpt.com "Scrutins"
[9]: https://index.okfn.org/place/fr/draftlegislation.html?utm_source=chatgpt.com "Entry for France / Draft Legislation - Global Open Data Index"
[10]: https://data.senat.fr/dosleg/?utm_source=chatgpt.com "La base DOSLEG : data.senat.fr"
[11]: https://politique.pappers.fr/api?utm_source=chatgpt.com "Offres de Pappers Politique"
