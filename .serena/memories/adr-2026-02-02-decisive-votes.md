# ADR-2026-02-02 : Identification et calcul des votes décisifs

## Métadonnées
- **Date** : 2026-02-02
- **Statut** : Proposé
- **Contexte** : Phase 4.2 de la roadmap - Votes décisifs
- **Décideurs** : Équipe développement + validation utilisateur

## Problème

Comment quantifier le "poids décisif" d'un vote individuel dans un scrutin parlementaire ? Quels scrutins sont considérés comme "décisifs" ?

**Besoins fonctionnels** :
1. Identifier les scrutins où chaque voix comptait vraiment
2. Calculer le poids décisif de chaque vote individuel
3. Identifier les groupes pivot (dont le basculement inverse le résultat)
4. Afficher un badge "vote décisif" sur les pages scrutins et profils élus
5. Créer une page dédiée listant tous les votes serrés

**Contraintes** :
- Wording neutre et factuel (pas de jugement normatif)
- Performance acceptable (requêtes DB optimisées)
- Transparence méthodologique (expliquer clairement le calcul)
- Cohérence avec philosophie du projet (cf. Phase 1.2 "autonomie" vs "dissidence")

## Décision

### Phase 1 (MVP) : Margin Simple

Adopter une approche binaire basée sur la **marge de victoire absolue** avec un **seuil de 10 voix**.

**Formule** :
```typescript
margin = ABS(total_for - total_against)
is_tight_vote = margin <= 10  // Seuil paramétrable en UI (5, 10, 20)
```

**Implémentation** :
- Ajouter colonne `scrutins.margin` INTEGER (pré-calculée lors de l'import)
- Index `scrutins_margin_idx` pour performance
- Helper `getTightScrutins(threshold, legislatureCondition)`
- Badge UI "Vote serré" (classe `.tight-vote-badge`)
- Page dédiée `/an/scrutins/serres` avec filtres

**Wording retenu** : "Vote serré" (neutre) au lieu de "vote décisif" (dramatique)
- Cohérent avec "autonomie de vote" (Phase 1.2) vs "dissidence"
- Factuel et transparent
- Évite jugement normatif

### Phase 2 (Enrichissement) : Groupes Pivot

Ajouter analyse des **groupes pivot** comme enrichissement complémentaire.

**Définition groupe pivot** : Groupe dont le basculement complet (tous ses votes "pour" → "contre" ou inversement) inverse le résultat du scrutin.

**Formule** :
```typescript
for (group of groups) {
  group_votes_for = COUNT(votes WHERE group_id = group AND position = 'pour')
  group_votes_against = COUNT(votes WHERE group_id = group AND position = 'contre')
  
  // Hypothèse : basculement complet du groupe
  hypothetical_for = total_for - group_votes_for + group_votes_against
  hypothetical_against = total_against - group_votes_against + group_votes_for
  
  // Le groupe est pivot si le résultat s'inverse
  original_result = total_for > total_against
  hypothetical_result = hypothetical_for > hypothetical_against
  is_pivot_group = original_result != hypothetical_result
}
```

**Implémentation** :
- Helper `getPivotGroups(scrutinId)` (pas de colonne, calcul à la volée)
- Section dédiée "Groupes pivot" sur page scrutin détail
- Complète l'analyse sans complexifier le concept de base

## Options considérées

### 1. Margin Simple (CHOISIE - MVP)
**Score** : 119/140

**Avantages** :
- ✅ Simplicité maximale (1 soustraction)
- ✅ Transparence totale pour citoyens
- ✅ Pré-calculable et indexable
- ✅ Performance optimale
- ✅ Aucune dépendance externe

**Inconvénients** :
- ❌ Binaire (pas de nuance entre 1 voix et 10 voix)
- ❌ Seuil arbitraire (10 voix = choix éditorial)

**Justification choix** : Pour un projet citoyen, simplicité et transparence priment sur sophistication mathématique.

### 2. Poids Inversement Proportionnel
**Score** : 104/140 - **REJETÉE**

**Formule** : `weight = (max_margin - margin) / max_margin`

**Raison rejet** : Complexité intermédiaire sans bénéfice clair. Le paramètre `max_margin` reste aussi arbitraire que le seuil binaire, mais moins compréhensible pour citoyens.

### 3. Indice de Banzhaf (Théorie des jeux)
**Score** : 77/140 - **RÉFÉRENCE ACADÉMIQUE UNIQUEMENT**

**Description** : Calcule probabilité qu'un vote soit "pivot" (change le résultat) dans toutes les coalitions possibles.

**Raison non-implémentation** : 
- Complexité algorithmique exponentielle (2^n coalitions)
- Gain marginal faible pour citoyens vs effort
- Utilisé comme **référence théorique** dans documentation méthodologique

**Utilisation** : Documentation transparente citant Banzhaf/Shapley comme fondement académique sans implémentation complète.

### 4. Groupes Pivot (CHOISIE - Enrichissement Phase 2)
**Score** : 97/140

**Justification** : Complémentaire à Option 1, apporte analyse politique/journalistique sans complexifier le concept de base.

### 5. Hybride Seuil Absolu + Relatif
**Score** : 106/140 - **REJETÉE**

**Formule** : `is_decisive = margin <= min(10, 0.05 * total_voters)`

**Raison rejet** : Deux paramètres arbitraires au lieu d'un, complexité sans gain démontré.

## Paramètres et Seuils

### Seuil retenu : 10 voix

**Justification empirique** :
| Seuil (voix) | Scrutins | % total | Commentaire |
|--------------|----------|---------|-------------|
| = 0 | 71 | 0.4% | Égalités parfaites (cas extrême) |
| ≤ 1 | 191 | 1.1% | Trop restrictif |
| ≤ 5 | ~700 | 3.9% | Restrictif |
| **≤ 10** | **~1 800** | **10.1%** | ✅ **Masse critique pour analyse** |
| ≤ 20 | ~3 600 | 20.1% | Trop permissif |

**Paramétrage UI** : Seuil ajustable en interface (5, 10, 20 voix) pour permettre exploration utilisateur.

### Cas particuliers

**Égalité parfaite (margin = 0)** : 71 scrutins
- Badge spécial "Égalité parfaite" (couleur distincte)
- Tous les votes sont strictement décisifs

## Conséquences

### Positives

1. **Transparence citoyenne** : Concept simple compréhensible par tous
2. **Performance** : Colonne pré-calculée + index = requêtes instantanées
3. **Scalabilité** : Pattern réutilisable pour Sénat, PE
4. **Cohérence** : Wording "serré" aligné avec philosophie projet (neutralité)
5. **Extensibilité** : Enrichissement Phase 2 (Pivot Groups) sans refonte
6. **Méthodologie défendable** : Fondement académique (Banzhaf) documenté

### Négatives (et mitigations)

1. **Seuil arbitraire (10 voix)**
   - Mitigation : Paramétrable en UI, justification empirique (10.1% des scrutins)
   
2. **Poids binaire (pas de nuance)**
   - Mitigation : Phase 2 (Pivot Groups) apporte nuance complémentaire
   
3. **Ignore composition par groupe**
   - Mitigation : Phase 2 dédiée à l'analyse coalitions

4. **Abstentions non différenciées**
   - Mitigation : Accepté (focus sur margin = différence pour/contre)

## Actions requises

### Phase 1 - MVP (Priorité haute)

- [ ] **Migration Drizzle** : Colonne `scrutins.margin` INTEGER NOT NULL
- [ ] **Index** : `CREATE INDEX scrutins_margin_idx ON scrutins(margin)`
- [ ] **ETL** : Fonction `calculateMargin()` dans import pipeline
- [ ] **Helper** : `getTightScrutins(threshold, legislatureCondition)`
- [ ] **Helper** : `getActorTightVotes(actorId, legislatureCondition, threshold)`
- [ ] **UI Badge** : Composant badge "Vote serré" sur `/an/scrutins/[id]`
- [ ] **UI Section** : Panel "Votes serrés" sur `/an/deputes/[id]` (AsyncCard)
- [ ] **UI Page** : Route `/an/scrutins/serres` avec filtres (seuil, période, catégorie)
- [ ] **Tests** : Tests d'intégration calcul margin + requêtes
- [ ] **Documentation** : Page méthodologie expliquant calcul et limites

### Phase 2 - Enrichissement (Priorité moyenne)

- [ ] **Helper** : `getPivotGroups(scrutinId)`
- [ ] **UI Section** : "Groupes pivot" sur page scrutin détail
- [ ] **Tests** : Tests d'intégration pivot groups
- [ ] **Documentation** : Méthodologie groupes pivot

### Documentation méthodologique

Créer page `/methodologie/votes-serres` expliquant :
- Définition du "vote serré" (margin ≤ 10 voix)
- Justification du seuil (distribution empirique)
- Ce que la métrique **mesure** (proximité du résultat)
- Ce que la métrique **ne mesure pas** (importance politique du texte, stratégie de vote)
- Référence académique (Banzhaf power index) sans implémentation complète
- Limites connues (seuil arbitraire, abstentions)

## Alternatives futures envisageables

Si retour utilisateurs/chercheurs le justifie :

1. **Implémentation complète Banzhaf** (si demande académique forte)
2. **Poids pondéré** (si besoin de nuance démontrée)
3. **Seuil relatif** (si biais identifié sur différentes tailles d'assemblées)

**Processus de révision** : ADR révisable en Phase 5 si données empiriques le justifient.

## Distribution estimée (17 881 scrutins)

| Catégorie margin | Scrutins | % | Label UI |
|------------------|----------|---|----------|
| = 0 | 71 | 0.4% | "Égalité parfaite" |
| 1-5 | ~630 | 3.5% | "Très serré" |
| 6-10 | ~1 100 | 6.2% | "Serré" |
| > 10 | ~16 080 | 89.9% | (pas de badge) |

## Références

- **Roadmap** : Section 4.2 - Votes décisifs (`docs/ROADMAP2.md`)
- **Exploration** : `exploration-decisive-votes-2026-02-02.md`
- **Workflow** : `workflow-current.md`
- **Règles projet** : 
  - `no-hardcoding-rule.md`
  - `database-queries-factorization.md`
  - `ui-best-practices.md` (AsyncCard pattern)
- **ADR similaires** :
  - `adr-2026-02-01-scrutin-category.md` (typologie scrutins)
- **Académique** :
  - Banzhaf power index (Penrose 1946, Banzhaf 1965)
  - Shapley-Shubik power index (1954)
  - Margin of victory theory

## Validation

**Décision approuvée** : En attente validation utilisateur

**Critères validation** :
- [ ] Wording "vote serré" validé vs "vote décisif"
- [ ] Seuil 10 voix acceptable
- [ ] MVP Phase 1 suffisant avant enrichissement Phase 2

**Prochaine étape** : `/architecture` pour design détaillé implémentation
