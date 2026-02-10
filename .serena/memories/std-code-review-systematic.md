# Standard : Code Review Systématique Avant Merge

## Catégorie

Quality Assurance / Process

## Date d'adoption

2026-02-01

## Règle

**TOUJOURS effectuer une code review complète avant de merger**, même pour du code écrit par soi-même.

La review utilise la skill `/code-review` avec checklist complète :

- Correctness (exactitude)
- Security (sécurité)
- Performance
- Maintainability (maintenabilité)
- Testing

## Justification

### Bénéfices observés (Phase 2.2)

Lors de la review de la phase 2.2, **3 améliorations** ont été identifiées et corrigées :

1. **Import dynamique inutile** (`helpers.ts`)
   - Problème : `await import()` au lieu d'import statique
   - Impact : Incohérent avec le reste du fichier
   - Fix : Import statique de `laws` et `lawCosignatories`

2. **Tri ambigu** (`helpers.ts:808`)
   - Problème : `orderBy(desc(date), signatureOrder)` sans direction explicite
   - Impact : Lisibilité réduite (ASC par défaut non évident)
   - Fix : `orderBy(desc(date), asc(signatureOrder))`

3. **Accessibilité** (`+page.svelte`)
   - Problème : Liens sans `title` attribute
   - Impact : Expérience utilisateur dégradée
   - Fix : Ajout de `title="Voir le détail du texte"`

**Résultat** : Code plus propre, maintenable et accessible.

## Checklist de Review

### 1. Correctness ✓

- [ ] Le code fait ce qu'il est censé faire
- [ ] Les edge cases sont gérés
- [ ] Pas de bugs évidents

### 2. Security 🔒

- [ ] Pas de secrets hardcodés
- [ ] Validation des entrées
- [ ] Pas d'injection SQL/XSS

### 3. Performance ⚡

- [ ] Pas de N+1 queries
- [ ] Pas de boucles inutiles
- [ ] Index DB utilisés

### 4. Maintainability 🔧

- [ ] Code lisible
- [ ] Noms de variables clairs
- [ ] Pas de duplication
- [ ] Respect des conventions

### 5. Testing ✅

- [ ] Tests présents
- [ ] Couverture suffisante
- [ ] Tests maintenables

## Process

```
1. Implémenter la feature
2. Lancer `/code-review`
3. Analyser le rapport
4. Appliquer les suggestions
5. Re-vérifier avec `/test-run`
6. Passer à `/pre-merge`
```

## Niveaux de Sévérité

| Niveau         | Action               | Exemple                 |
| -------------- | -------------------- | ----------------------- |
| 🚨 **Blocker** | Obligatoire          | Fuite de sécurité       |
| ⚠️ **Major**   | Fortement recommandé | N+1 query               |
| 💡 **Minor**   | Optionnel            | Amélioration lisibilité |
| 📝 **Nitpick** | À discrétion         | Style/préférence        |

## Exemples

### ✅ Review Effectuée (Phase 2.2)

```markdown
## Code Review : Phase 2.2

Verdict : ✅ Approuvé avec suggestions mineures

### Suggestions appliquées :

1. 💡 Import statique au lieu de dynamique
2. 📝 Tri explicite avec asc()
3. 💡 Attributs d'accessibilité

→ Commit : 007df28
```

### ❌ À Éviter

Merger directement sans review juste parce que "ça fonctionne".

## Exceptions

Aucune. Même les hotfixes critiques doivent être reviewés (a posteriori si urgence).

## Vérification

```bash
# Lancer la code review
/code-review

# Vérifier que les suggestions sont appliquées
git log -1 --stat
```

## Métriques de Succès

| Indicateur              | Phase 2.2  |
| ----------------------- | ---------- |
| Review effectuée        | ✅ Oui     |
| Suggestions identifiées | 3          |
| Suggestions appliquées  | 3/3 (100%) |
| Regressions introduites | 0          |
| Tests passants          | 24/24      |

## Outils

- **Skill** : `/code-review`
- **Checklist** : Intégrée dans la skill
- **Format** : Rapport markdown avec sévérités

## Références

- Code review Phase 2.2 : Commit `007df28`
- Documentation : `.serena/memories/pattern-workflow-skills-orchestration.md`
- Exemple : Rapport complet généré lors de la session

## Voir aussi

- `/pre-merge` - Prochaine étape après review
- `/test-run` - Validation après corrections
