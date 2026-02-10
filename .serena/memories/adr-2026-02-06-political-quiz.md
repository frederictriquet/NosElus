# ADR-006 : Quiz Politique Interactif

## Métadonnées

- **Date** : 2026-02-06
- **Statut** : ✅ Accepté
- **Décideurs** : Équipe NosElus + utilisateur
- **Type** : Feature majeure
- **Domaine** : UX / Engagement citoyen

---

## Contexte

### Problème

Les citoyens ont du mal à se positionner politiquement de manière objective. Les étiquettes politiques traditionnelles (gauche/droite) sont floues et ne reflètent pas toujours les positions réelles sur les sujets concrets.

**Besoin identifié** : Permettre aux citoyens de découvrir leur alignement politique en se basant sur leurs opinions sur de vraies lois votées à l'Assemblée nationale, plutôt que sur des déclarations de principe.

### Drivers

1. **Pédagogie citoyenne** : Rendre les lois accessibles via les résumés IA existants
2. **Objectivité** : Baser l'alignement sur des votes réels (données factuelles)
3. **Engagement** : Format ludique et interactif pour attirer l'attention
4. **Valorisation des données** : Exploiter les 267 lois déjà analysées par IA

### Contraintes

- **Pas de modification du schéma DB** : Utiliser uniquement les données existantes
- **Performance** : Le quiz doit charger rapidement (< 2s)
- **Mobile-first** : Interface utilisable sur smartphone
- **Respect de la vie privée** : Pas de tracking des réponses utilisateur côté serveur
- **Cohérence architecturale** : Suivre les patterns du projet (AsyncCard, routes SvelteKit)

---

## Options Considérées

### 1. Sélection des Lois

| Option                                   | Description                   | Score      | Verdict        |
| ---------------------------------------- | ----------------------------- | ---------- | -------------- |
| **1A - Aléatoire pure**                  | ORDER BY RANDOM()             | 70/120     | ❌ Rejeté      |
| **1B - Stratifiée par tags**             | Diversité thématique garantie | 85/120     | ⚠️ Alternative |
| **1C - Curée manuellement**              | 15-20 lois choisies à la main | 75/120     | ❌ Rejeté      |
| **1D - Mixte (stratifiée + importance)** | Tags + filtre scrutins        | **95/120** | ✅ **Retenue** |

### 2. Calcul d'Alignement

| Option                      | Description            | Score       | Verdict        |
| --------------------------- | ---------------------- | ----------- | -------------- |
| **2A - Similarité Jaccard** | % d'accord simple      | **117/120** | ✅ **Retenue** |
| **2B - Pondérée**           | Poids par importance   | 88/120      | ❌ Rejeté      |
| **2C - Distance cosinus**   | Vecteurs mathématiques | 65/120      | ❌ Rejeté      |

### 3. Présentation Résultats

| Option                       | Description              | Score      | Verdict        |
| ---------------------------- | ------------------------ | ---------- | -------------- |
| **3A - Barres horizontales** | Liste simple avec barres | 92/120     | ⚠️ Alternative |
| **3B - Radar chart**         | Graphique araignée       | 70/120     | ❌ Rejeté      |
| **3C - Podium + tableau**    | Top 3 + détails          | **99/120** | ✅ **Retenue** |

### 4. Architecture Routing

| Option                        | Description             | Score       | Verdict        |
| ----------------------------- | ----------------------- | ----------- | -------------- |
| **4A - Route unique + state** | Tout dans /an/quiz      | 85/120      | ❌ Rejeté      |
| **4B - Routes séparées**      | /quiz + /quiz/resultats | **103/120** | ✅ **Retenue** |
| **4C - SPA full client**      | Navigation JS pure      | 60/120      | ❌ Rejeté      |

### 5. Stockage Votes

| Option                  | Description            | Score       | Verdict        |
| ----------------------- | ---------------------- | ----------- | -------------- |
| **5A - localStorage**   | Navigateur uniquement  | **110/120** | ✅ **Retenue** |
| **5B - Session cookie** | Cookie serveur         | 85/120      | ❌ Rejeté      |
| **5C - DB + Auth**      | Sauvegarde persistante | 55/120      | ❌ Rejeté      |

### 6. Composants UI

| Option                            | Description                   | Score       | Verdict        |
| --------------------------------- | ----------------------------- | ----------- | -------------- |
| **6A - From scratch**             | Tous nouveaux composants      | 70/120      | ❌ Rejeté      |
| **6B - Réutilisation + nouveaux** | AsyncCard + composants ciblés | **107/120** | ✅ **Retenue** |

---

## Décision

### Stack Technique Retenue

Nous choisissons l'architecture suivante :

| Aspect                | Choix                 | Justification                                          |
| --------------------- | --------------------- | ------------------------------------------------------ |
| **Sélection lois**    | Mixte (1D)            | Diversité thématique + filtre importance (≥3 scrutins) |
| **Calcul alignement** | Jaccard simple (2A)   | Transparent, compréhensible, suffisant                 |
| **Présentation**      | Podium + tableau (3C) | Hiérarchie visuelle claire, mobile-friendly            |
| **Routing**           | Routes séparées (4B)  | Deep-linking, navigation claire, SEO                   |
| **Stockage**          | localStorage (5A)     | Simple, privé, sans backend                            |
| **Composants**        | Réutilisation (6B)    | Cohérence avec l'existant, rapidité                    |

### Architecture Détaillée

```
Routes:
/an/quiz/
├── +page.server.ts      # Sélectionne 15 lois (stratifiée + filtre ≥3 scrutins)
├── +page.svelte         # Interface quiz avec QuizLawCard
└── resultats/
    ├── +page.ts         # Calcule alignement (lit localStorage)
    └── +page.svelte     # AlignmentPodium + tableau détaillé

Nouveaux Composants:
src/lib/components/
├── QuizLawCard.svelte       # Carte loi + boutons pour/contre
├── QuizProgress.svelte      # Barre progression (3/15)
├── AlignmentPodium.svelte   # Podium top 3 groupes
└── VoteDetailModal.svelte   # Modal détail accord/désaccord

Stores:
src/lib/stores/
└── quiz.ts                  # Store votes + progression

Utils:
src/lib/utils/
└── alignment.ts             # Fonction calculateAlignment()
```

### Algorithme de Sélection des Lois

```typescript
// Pseudo-code
const QUIZ_SIZE = 15;
const MIN_SCRUTINS = 3; // Filtre lois débattues

// 1. Récupérer les lois éligibles
const eligibleLaws = await db
	.select()
	.from(laws)
	.innerJoin(lawSummaries)
	.innerJoin(scrutins) // Au moins 1 scrutin
	.where((legislature = '17'))
	.having(count(scrutins) >= MIN_SCRUTINS)
	.groupBy(lawId);

// 2. Grouper par tag principal
const lawsByTag = groupBy(eligibleLaws, 'primaryTag');

// 3. Stratifier : prendre 1-2 lois par tag aléatoirement
const selectedLaws = [];
for (const [tag, laws] of lawsByTag) {
	const sample = randomSample(laws, Math.ceil(QUIZ_SIZE / uniqueTags.length));
	selectedLaws.push(...sample);
}

// 4. Limiter à QUIZ_SIZE
return selectedLaws.slice(0, QUIZ_SIZE);
```

### Formule d'Alignement (Jaccard)

```typescript
function calculateAlignment(
	userVotes: { lawId: string; position: 'pour' | 'contre' }[],
	groupVotes: { lawId: string; position: 'pour' | 'contre' }[]
): number {
	const matches = userVotes.filter((uv, i) => uv.position === groupVotes[i].position).length;

	return Math.round((matches / userVotes.length) * 100);
}
```

**Exemple** :

- User vote : [pour, contre, pour, contre, pour, ...] (15 lois)
- Groupe LFI : [pour, contre, contre, contre, pour, ...]
- Accords : 4/15 = 27%
- Groupe RN : [contre, contre, pour, contre, contre, ...]
- Accords : 12/15 = 80%

---

## Justifications des Choix

### Pourquoi Sélection Mixte (1D) ?

**Rejet de l'aléatoire pure (1A)** :

- Risque de 5 lois sur l'économie → expérience déséquilibrée
- Pas de garantie de diversité thématique

**Rejet de la curation manuelle (1C)** :

- Biais éditorial inacceptable pour un outil citoyen
- Maintenance lourde (nouvelle curation chaque législature)
- Pas scalable

**Choix du mixte** :

- Garantit diversité via stratification par tags
- Filtre importance via seuil de scrutins (≥3) élimine lois anecdotiques
- Pas de maintenance manuelle
- Reproductible automatiquement pour futures législatures

### Pourquoi Jaccard Simple (2A) ?

**Rejet de la pondération (2B)** :

- Complexe à expliquer à l'utilisateur
- Risque de paraître arbitraire ("pourquoi cette loi compte double ?")
- Gain marginal par rapport à la complexité ajoutée

**Rejet de la distance cosinus (2C)** :

- Overkill mathématique pour un quiz grand public
- Résultats peu différents de Jaccard en pratique
- Incompréhensible pour l'utilisateur moyen

**Choix de Jaccard** :

- **Transparence** : "Tu es d'accord avec X% des votes de ce groupe"
- **Simplicité** : Concept accessible à tous
- **Suffisance** : Donne une indication claire d'alignement

### Pourquoi Podium + Tableau (3C) ?

**Rejet du radar chart (3B)** :

- Illisible sur mobile (trop de groupes = axes)
- Nécessite bibliothèque de charts (dépendance supplémentaire)
- Ordre des groupes sur le radar impacte la perception

**Choix du podium** :

- **Hiérarchie visuelle** : Top 3 mis en avant immédiatement
- **Progressive disclosure** : Aperçu → détails au clic
- **Mobile-friendly** : Vertical scrolling naturel
- **Gamification** : Podium = aspect ludique

### Pourquoi Routes Séparées (4B) ?

**Rejet de la route unique (4A)** :

- Pas de deep-linking (impossible de partager résultats)
- Perte d'état au refresh (frustration utilisateur)
- URL ne reflète pas l'étape (mauvais UX)

**Rejet du SPA full client (4C)** :

- Contre les patterns SvelteKit (SSR)
- SEO problématique
- Chargement initial plus lourd

**Choix des routes séparées** :

- **Deep-linking** : `/an/quiz/resultats?session=abc` partageable
- **Navigation native** : Back button fonctionne
- **SEO** : Deux pages indexables
- **SvelteKit-friendly** : Suit les conventions du framework

### Pourquoi localStorage (5A) ?

**Rejet des cookies (5B)** :

- Overhead inutile pour un quiz anonyme
- Nécessite backend pour gérer sessions
- Expire à la fermeture du navigateur (mauvais UX)

**Rejet de la DB (5C)** :

- Hors scope v1 (nécessite authentification complète)
- RGPD complexe (consentement, suppression, etc.)
- Overhead technique élevé

**Choix de localStorage** :

- **Simplicité** : API native, 5 lignes de code
- **Vie privée** : Aucune donnée côté serveur
- **Persistence** : Survit aux refreshs, pas aux fermetures
- **Suffisant** : Pour un quiz anonyme, localStorage est idéal

---

## Trade-offs Acceptés

### 1. Pas de synchronisation multi-device

**Inconvénient** : L'utilisateur qui commence le quiz sur mobile et veut finir sur desktop ne peut pas.

**Mitigation** :

- Acceptable pour v1 (cas d'usage rare pour un quiz de 5-10 min)
- Pourrait être ajouté en v2 avec authentification optionnelle

### 2. Perte si effacement localStorage

**Inconvénient** : Si l'utilisateur efface ses cookies/données, il perd ses résultats.

**Mitigation** :

- Message d'avertissement avant de quitter la page de résultats
- Bouton "Recommencer" permet de refaire facilement
- Acceptable pour un quiz ludique (non critique)

### 3. Algorithme Jaccard simpliste

**Inconvénient** : Ne tient pas compte de l'importance relative des lois (PLF 2025 = même poids qu'une PPL mineure).

**Mitigation** :

- La sélection mixte filtre déjà les lois anecdotiques (≥3 scrutins)
- Transparence > sophistication pour ce cas d'usage
- Pourrait être amélioré en v2 si besoin exprimé

### 4. Limité à la législature 17

**Inconvénient** : Pas de comparaison historique ou multi-législatures.

**Mitigation** :

- Acceptable pour v1 (focus sur l'actualité)
- Architecture extensible : ajout d'un sélecteur de législature trivial
- Données disponibles pour L15/L16 si besoin futur

---

## Conséquences

### Impacts Positifs

✅ **Engagement citoyen** : Format ludique augmente l'intérêt pour les lois  
✅ **Valorisation des données** : Exploite les 267 lois déjà analysées  
✅ **Objectivité** : Basé sur des votes réels, pas des déclarations  
✅ **Simplicité** : Aucune authentification requise (barrière d'entrée basse)  
✅ **Performance** : localStorage = pas de latence réseau  
✅ **Cohérence** : Réutilise patterns existants (AsyncCard, routes)

### Impacts Négatifs (à Monitorer)

⚠️ **Biais de sélection** : La stratification par tags peut ne pas être parfaite  
→ **Action** : Monitorer les retours utilisateurs, ajuster l'algorithme si nécessaire

⚠️ **Complexité de l'algo de sélection** : La requête SQL peut être lente  
→ **Action** : Mesurer performance en prod, ajouter cache si besoin (localStorage côté client)

⚠️ **Interprétation des résultats** : Risque de simplification excessive  
→ **Action** : Ajouter disclaimer explicite ("Ce quiz est indicatif, basé sur X lois")

### Actions Requises

#### Avant implémentation

- [ ] Valider le nombre final de lois (15, 20 ou autre)
- [ ] Confirmer si abstention utilisateur est permise
- [ ] Décider si partage de résultats est nécessaire v1

#### Pendant implémentation

- [ ] Créer les 4 nouveaux composants (QuizLawCard, QuizProgress, AlignmentPodium, VoteDetailModal)
- [ ] Implémenter store Svelte pour état quiz
- [ ] Implémenter fonction calculateAlignment()
- [ ] Créer routes `/an/quiz` et `/an/quiz/resultats`
- [ ] Ajouter lien vers quiz dans navigation AN

#### Après implémentation

- [ ] Mesurer performance de la requête de sélection
- [ ] Tester localStorage sur différents navigateurs
- [ ] Valider mobile-responsiveness
- [ ] Collecter feedback utilisateurs sur la pertinence des lois sélectionnées

---

## Références

### ADR Liés

- ADR-001 : Classification scrutins (utilise la colonne `category`)
- ADR-002 : Votes décisifs (pourrait être utilisé pour filtrer lois "importantes")

### Patterns Réutilisés

- `ui-best-practices.md` : AsyncCard pour chargement progressif
- `std-reusable-components.md` : Création de composants réutilisables
- `routes-structure.md` : Organisation des routes par chambre

### Documentation Externe

- [Jaccard Similarity](https://en.wikipedia.org/wiki/Jaccard_index)
- [SvelteKit Routing](https://kit.svelte.dev/docs/routing)
- [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

### Données Sources

- **267 lois** avec résumé IA disponibles
- **85 lois** en législature 17 avec votes de groupes
- **19 tags** thématiques pour stratification

---

## Validation

### Checklist de Validation

- [x] Les stakeholders ont été consultés (utilisateur demandeur)
- [x] Les contraintes sont respectées (pas de modif schéma DB)
- [x] La décision est cohérente avec l'architecture existante (SvelteKit, patterns)
- [x] Les risques sont acceptables et mitigés (voir Trade-offs)
- [x] Les alternatives ont été correctement évaluées (6 aspects, 17 options)
- [x] La décision est réversible (modifications isolées dans `/an/quiz/`)

### Approbation

**Décision approuvée** : ✅ Oui  
**Par** : Équipe NosElus  
**Date** : 2026-02-06  
**Commentaires** : Décision validée après exploration complète des options. Prêt pour architecture détaillée puis implémentation.

---

## Notes de Mise en Œuvre

### Ordre d'Implémentation Recommandé

1. **Phase 1 : Fondations** (utils + store)
   - Créer `src/lib/utils/alignment.ts`
   - Créer `src/lib/stores/quiz.ts`

2. **Phase 2 : Composants UI**
   - QuizLawCard.svelte (le plus critique)
   - QuizProgress.svelte
   - AlignmentPodium.svelte
   - VoteDetailModal.svelte

3. **Phase 3 : Routes**
   - `/an/quiz/+page.server.ts` (sélection lois)
   - `/an/quiz/+page.svelte` (interface quiz)
   - `/an/quiz/resultats/+page.ts` (calcul alignement)
   - `/an/quiz/resultats/+page.svelte` (affichage résultats)

4. **Phase 4 : Intégration**
   - Lien dans navigation AN
   - Tests manuels
   - Ajustements finaux

### Risques Techniques Identifiés

| Risque                                        | Probabilité | Impact | Mitigation                                        |
| --------------------------------------------- | ----------- | ------ | ------------------------------------------------- |
| Requête de sélection lente                    | Moyenne     | Moyen  | Mesurer perf, ajouter index DB si besoin          |
| localStorage incompatible (vieux navigateurs) | Faible      | Faible | Fallback sessionStorage + message                 |
| groupResults JSONB mal formaté                | Faible      | Élevé  | Validation en dev, fallback sur votes individuels |
| Expérience mobile dégradée                    | Moyenne     | Moyen  | Tests mobile early, design mobile-first           |

---

## Historique des Modifications

| Date       | Auteur        | Modification               |
| ---------- | ------------- | -------------------------- |
| 2026-02-06 | Claude + User | Création initiale de l'ADR |
