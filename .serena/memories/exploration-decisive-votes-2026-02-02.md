# Exploration : Calcul du Poids Décisif d'un Vote

## Date : 2026-02-02

## Problème
Quantifier le "poids décisif" d'un vote individuel dans un scrutin parlementaire pour la section 4.2 de la roadmap.

## Options évaluées

1. **Margin Simple** - Score: 119/140 - ✅ **Retenue (MVP)**
   - Seuil binaire (margin ≤ 10 voix)
   - Simplicité maximale, transparence totale
   - Pré-calculable, performance optimale

2. **Pondéré** - Score: 104/140 - ⏸️ Rejetée (complexité intermédiaire)
   - Poids inversement proportionnel à marge
   - Nuancé mais paramètre `max_margin` arbitraire

3. **Banzhaf Index** - Score: 77/140 - 📚 Référence académique (pas d'implémentation)
   - Théorie des jeux coopératifs
   - Complexité élevée, gain marginal faible pour citoyens
   - Utilisé comme référence théorique dans documentation

4. **Pivot Groups** - Score: 97/140 - ✅ **Retenue (Enrichissement Phase 2)**
   - Identification groupes dont basculement inverse résultat
   - Intérêt journalistique/politique élevé
   - Complémentaire à Option 1

5. **Hybride** - Score: 106/140 - ⏸️ Rejetée (complexité sans gain clair)
   - Seuil absolu + relatif
   - Deux paramètres au lieu d'un

## Choix final

**Phase 1 (MVP)** : Option 1 - Margin Simple
- Formule : `margin = ABS(total_for - total_against)`
- is_decisive = `margin <= 10`
- Colonne `scrutins.margin` pré-calculée + index

**Phase 2 (Enrichissement)** : Ajouter Option 4 - Pivot Groups
- Helper `getPivotGroups(scrutinId)`
- Section "Groupes pivot" sur page scrutin
- Complète l'analyse sans complexifier le concept de base

## Paramètres retenus

- **Seuil** : 10 voix (roadmap)
  - ~1 800 scrutins (10.1% du total)
  - Ajustable en UI (5, 10, 20)
- **Wording** : "Vote serré" (neutre, factuel)
- **Route** : `/an/scrutins/serres`
- **Badge** : `.tight-vote-badge` (couleur neutre, pas dramatique)

## Données statistiques

| Seuil | Scrutins | % |
|-------|----------|---|
| = 0 | 71 | 0.4% |
| ≤ 1 | 191 | 1.1% |
| ≤ 5 | ~700 | 3.9% |
| ≤ 10 | ~1800 | 10.1% |
| ≤ 20 | ~3600 | 20.1% |

## Leçons apprises

1. **Simplicité > Sophistication** : Pour impact citoyen, option simple mais transparente bat option mathématiquement rigoureuse mais obscure
2. **Fondement académique** : Banzhaf/Shapley utiles comme référence théorique sans implémentation
3. **Enrichissement progressif** : MVP simple + enrichissement ultérieur > système complexe d'emblée
4. **Wording neutre** : "Serré" vs "Décisif" évite jugement normatif (cohérent avec "Autonomie" vs "Dissidence")

## Références académiques

- Banzhaf power index (Penrose 1946, Banzhaf 1965)
- Shapley-Shubik power index (1954)
- Margin of victory theory (ballotpedia)
- Weighted voting by margin of victory (WVMV)

## Prochaine étape

ADR à créer : `adr-2026-02-02-decisive-votes.md`
