# ADR-003 : Récupération du Texte Complet des Lois

## Métadonnées
- **Date** : 2026-02-02
- **Statut** : 📋 Proposé
- **Décideurs** : Fred (utilisateur), Claude (assistant)
- **Contexte** : Feature law-full-text-import (branche dédiée)

## Contexte

### Problème

Les résumés LLM actuellement générés pour les lois sont **trompeurs** car ils sont créés uniquement à partir du **titre** de la loi, pas du texte complet. Le LLM "invente" un résumé basé sur ses connaissances générales, ce qui peut conduire à des hallucinations.

Les données open data de l'Assemblée nationale (JSON) contiennent uniquement les **métadonnées** (titre, dates, type, statut) mais pas le **contenu textuel** (exposé des motifs, articles).

### Drivers

1. **Qualité** : Besoin de vrais résumés basés sur le texte réel
2. **Transparence** : Ne pas tromper l'utilisateur avec des résumés approximatifs
3. **Valeur** : Rendre le texte complet accessible dans l'UI
4. **Confiance** : Source officielle et fiable

### Contraintes

- Pas de budget pour API payante
- Limites de rate limiting à respecter
- Stockage DB limité (~50 KB par loi pour texte complet)
- 14 663 lois en base (potentiellement à enrichir)
- Pas de serveur dédié pour scraping massif

## Options Considérées

### Matrice comparative complète

| Critère | Poids | PISTE | NosDép | LEGI Bulk | Scraping AN | Hybride |
|---------|-------|-------|--------|-----------|-------------|---------|
| **Qualité source** | 5 | 5/5 | 3/5 | 5/5 | 3/5 | 4/5 |
| **Couverture** | 5 | 2/5 | 3/5 | 2/5 | 5/5 | 5/5 |
| **Facilité implémentation** | 4 | 3/5 | 2/5 | 1/5 | 4/5 | 1/5 |
| **Maintenabilité** | 5 | 5/5 | 3/5 | 4/5 | 1/5 | 2/5 |
| **Coût opérationnel** | 3 | 4/5 | 5/5 | 3/5 | 2/5 | 2/5 |
| **Pérennité** | 4 | 5/5 | 3/5 | 5/5 | 2/5 | 3/5 |
| **Rapidité MVP** | 3 | 3/5 | 2/5 | 1/5 | 4/5 | 1/5 |
| **Score pondéré** | - | **109/145** | **80/145** | **80/145** | **82/145** | **79/145** |

### Option 1 : API Légifrance via PISTE (Score: 109) ✅

**Description** : Utiliser l'API officielle Légifrance/DILA via le portail PISTE.

**Avantages** :
- ✅ **Source officielle** : DILA (organisme public)
- ✅ **Qualité maximale** : Texte consolidé, juridiquement fiable
- ✅ **API REST** : Documentation Swagger, OAuth 2.0
- ✅ **Gratuit** : Inscription requise, quotas généreux
- ✅ **Pérenne** : Service gouvernemental stable

**Inconvénients** :
- ❌ **Couverture limitée** : Seulement lois **promulguées** (~30%)
- ❌ **Inscription manuelle** : Compte PISTE + acceptation CGU
- ❌ **Complexité auth** : OAuth 2.0 client credentials
- ❌ **Quotas** : Non publics, configurables par app

**Effort** : 🟡 Moyen (2-3 jours)  
**Risque** : 🟢 Faible

**Prérequis** :
1. Inscription sur https://piste.gouv.fr/registration
2. Accepter CGU (sandbox + production)
3. Récupérer client_id + client_secret

**Couverture** : ~30-40% des lois (promulguées uniquement)

---

### Option 2 : API NosDéputés.fr (Score: 80) ❌

**Description** : Utiliser l'API de Regards Citoyens.

**Avantages** :
- ✅ API publique gratuite
- ✅ Données parlementaires agrégées

**Inconvénients** :
- ❌ **API cassée** : Tests montrent HTML au lieu de JSON
- ❌ Documentation obsolète (dernière législature référencée : 16)
- ❌ Dépendance service tiers (disponibilité incertaine)
- ❌ Pas de texte complet dans les réponses

**Effort** : 🟡 Moyen  
**Risque** : 🔴 Élevé (service non fonctionnel)

**Verdict** : **Rejeté** — API non fonctionnelle pour notre cas d'usage

---

### Option 3 : LEGI Bulk Download (Score: 80) ❌

**Description** : Télécharger le bulk LEGI (~20 GB) depuis data.gouv.fr.

**Avantages** :
- ✅ Données officielles complètes
- ✅ Pas de quota API

**Inconvénients** :
- ❌ **Taille massive** : ~20 GB
- ❌ **Parsing XML complexe** : DTD LEGIFRANCE
- ❌ **Couverture limitée** : Seulement lois promulguées
- ❌ Synchronisation hebdomadaire complexe

**Effort** : 🔴 Élevé (5-7 jours)  
**Risque** : 🟡 Moyen

**Verdict** : **Rejeté** — Overhead trop important pour MVP

---

### Option 4 : Scraping du site AN (Score: 82) ❌

**Description** : Scraper les pages HTML `/dyn/opendata/[uid].html`.

**Avantages** :
- ✅ Couverture maximale (~95%)
- ✅ URL prévisibles

**Inconvénients** :
- ❌ **Rate limiting** : 429 Too Many Requests constaté
- ❌ **Fragile** : Structure HTML peut changer
- ❌ **Maintenance coûteuse**
- ❌ Risque juridique (CGU)

**Effort** : 🟡 Moyen  
**Risque** : 🔴 Élevé

**Verdict** : **Rejeté** — Trop fragile, risque de blocage

---

### Option 5 : Approche hybride (Score: 79) ❌

**Description** : Combiner PISTE + scraping.

**Inconvénients** :
- ❌ Complexité élevée (2 implémentations)
- ❌ Logique de fallback complexe

**Verdict** : **Rejeté** — Over-engineering pour MVP

---

## Décision

**Nous choisissons l'Option 1 : API Légifrance via PISTE** parce que :

1. **Qualité maximale** : Source officielle juridiquement fiable
2. **Maintenabilité** : API stable et pérenne (service gouvernemental)
3. **Coût acceptable** : Gratuit après inscription
4. **Évolutivité** : Possibilité d'étendre avec d'autres bases DILA

### Trade-offs acceptés

En choisissant cette option, nous acceptons :

- **Couverture limitée (~30%)** - Mitigation : 
  - Démarrer avec les lois promulguées (les plus importantes)
  - Étendre plus tard avec scraping ciblé si besoin
  - Afficher clairement "Texte non disponible" pour les autres

- **Inscription manuelle requise** - Mitigation :
  - Processus one-time (~15 min)
  - Documenter les étapes dans le README

- **Complexité OAuth 2.0** - Mitigation :
  - Utiliser une lib OAuth (ex: `simple-oauth2`)
  - Stocker token en cache avec refresh auto

### Options rejetées

- **NosDéputés.fr** : API non fonctionnelle (retourne HTML au lieu de JSON)
- **LEGI Bulk** : Overhead trop important (~20 GB) pour couverture identique à PISTE
- **Scraping AN** : Trop fragile, rate limiting agressif (429 constaté)
- **Hybride** : Complexité injustifiée pour MVP

## Conséquences

### Impacts positifs

- ✅ Résumés LLM de **vraie qualité** (basés sur texte réel)
- ✅ Texte complet accessible dans l'UI
- ✅ Source officielle = **confiance utilisateurs**
- ✅ Maintenabilité à long terme

### Impacts négatifs (à monitorer)

- ⚠️ **Couverture partielle** (~30%) → Afficher clairement le statut
  - **Action** : Badge "Texte disponible" vs "Métadonnées uniquement"
  
- ⚠️ **Quotas API** (limites inconnues avant inscription) → Monitoring
  - **Action** : Logger les appels, implémenter cache local
  
- ⚠️ **Latence API** (inconnue) → UX
  - **Action** : Chargement async, skeleton loaders

### Actions requises

- [ ] **Phase 1** : Inscription PISTE (15 min)
  - Créer compte sur https://piste.gouv.fr/registration
  - Accepter CGU sandbox + production
  - Récupérer credentials (client_id + secret)

- [ ] **Phase 2** : Implémentation ETL (2-3 jours)
  - Script `scripts/etl/import-law-texts-piste.ts`
  - OAuth 2.0 client credentials flow
  - Mapping API → table `laws` (nouvelle colonne `full_text`)
  - Rate limiting respectueux

- [ ] **Phase 3** : UI (1 jour)
  - Afficher texte complet dans page law detail
  - Section repliable "Texte complet"
  - Badge "Source officielle Légifrance"

- [ ] **Phase 4** : LLM enrichi (1 jour)
  - Modifier `law-analyzer.ts` pour utiliser `full_text` si disponible
  - Badge "Résumé basé sur texte complet" vs "Résumé basé sur titre"

## Validation

### Checklist

- [x] Contraintes respectées (gratuit, pérenne, maintenable)
- [x] Architecture cohérente (ETL pattern existant)
- [x] Risques acceptables (source officielle)
- [x] Alternatives évaluées (5 options comparées)
- [x] Décision réversible (si quotas insuffisants → fallback LEGI bulk)

### Approbation

**Décision approuvée** : En attente utilisateur  
**Par** : Fred  
**Date** : 2026-02-02

## Références

- [API Légifrance - FAQ](https://www.legifrance.gouv.fr/contenu/menu/pied-de-page/foire-aux-questions-api)
- [PISTE Portal](https://piste.gouv.fr)
- [API Reference (Swagger)](https://piste.gouv.fr/api-catalog-sandbox)
- [CGU API Légifrance](https://www.legifrance.gouv.fr/contenu/Media/files/pied-de-page/cgu-legifrance-api-vf-15-12-2022_0.pdf)
- [Exploration options](/explore-options - 2026-02-02)
- [LEGI data.gouv.fr](https://www.data.gouv.fr/datasets/legi-codes-lois-et-reglements-consolides)

## Liens internes

- Branche : `feature/law-full-text-import`
- Schema : `src/lib/server/db/schema/laws.ts` (colonne `full_text` à ajouter)
- ETL : `scripts/etl/import-law-texts-piste.ts` (à créer)
