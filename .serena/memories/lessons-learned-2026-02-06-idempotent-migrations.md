# Lessons Learned : Migrations Idempotentes avec Drizzle ORM

## Date

2026-02-06

## Contexte

Mise en place d'un système pour rendre toutes les migrations Drizzle ORM idempotentes, permettant leur ré-exécution sans erreur dans les environnements de développement et de test.

**Objectif** : Établir un standard pour les migrations futures (0012+) sans toucher aux migrations existantes (0000-0011).

## Architecture Retenue

**Solution Hybrid** (ADR-005) :

- Script automatique `make-idempotent.js` pour 80% des cas
- Documentation SERENA pour les 20% restants
- Review humaine obligatoire

## Leçons Apprises

### ✅ Ce qui a bien fonctionné

#### 1. Approche Hybrid (Auto + Manuel)

**Décision** : Ne pas chercher la perfection (100% automatique) mais viser l'efficacité (80% auto + 20% doc).

**Bénéfice** :

- Script simple et maintenable (~85 lignes)
- Gère les cas courants sans complexité excessive
- Doc guide pour les cas edge

**Apprentissage** : Un parser SQL complet (regex + AST) aurait été **over-engineering** pour un besoin ponctuel. La simplicité l'emporte.

#### 2. Détection des Cas Edge avec Warnings

Le script ne se contente pas de transformer, il **détecte et alerte** :

```javascript
const constraintMatches = result.match(/ADD CONSTRAINT/g);
if (constraintMatches) {
	warnings.push('⚠️ ADD CONSTRAINT nécessite review manuelle');
}
```

**Bénéfice** : Le développeur sait immédiatement qu'une action manuelle est requise, avec un lien vers la doc.

**Apprentissage** : Un outil qui **guide** est plus utile qu'un outil qui essaie de tout faire automatiquement.

#### 3. Integration dans le Workflow (NPM Hook)

```json
"db:generate": "drizzle-kit generate && node scripts/make-idempotent.js"
```

**Bénéfice** :

- Transparence totale (le développeur n'a rien à faire)
- Impossible d'oublier
- Log visible à chaque génération

**Apprentissage** : **Hook automatique > documentation manuelle**. Les humains oublient, les scripts non.

#### 4. Décision de NE PAS Modifier les Migrations Existantes

**Risque identifié dès l'analyse** : Modifier 0000-0011 = risque de casser la prod.

**Décision** : Standard s'applique uniquement à 0012+.

**Bénéfice** :

- Zéro risque prod
- Implémentation rapide (pas de migration des anciennes)
- Focus sur le futur

**Apprentissage** : **Pragmatisme > purisme**. Accepter que l'existant reste imparfait si le coût/risque de correction est trop élevé.

#### 5. Patterns SQL Idempotents Documentés

La doc SERENA liste **tous les cas** avec exemples :

- `CREATE TABLE IF NOT EXISTS`
- `ADD COLUMN IF NOT EXISTS`
- Wrapper PL/pgSQL pour `ADD CONSTRAINT`
- `ON CONFLICT DO NOTHING` pour INSERT

**Bénéfice** : Checklist code review claire, pas d'ambiguïté.

**Apprentissage** : **Exemples concrets > explications théoriques**. Montrer le code avant/après est plus efficace que décrire.

### ⚠️ Points d'Attention

#### 1. Regex Limités (Mais Acceptables)

Le script utilise des regex simples :

```javascript
result.replace(/CREATE TABLE "(\w+)"/g, 'CREATE TABLE IF NOT EXISTS "$1"');
```

**Limitation connue** : Ne gère pas :

- Les noms de tables avec caractères spéciaux
- Les syntaxes SQL complexes (sous-requêtes, etc.)

**Mitigation** :

- Review humaine obligatoire
- Documentation des limitations dans le code
- Amélioration itérative si besoin réel

**Apprentissage** : **Documenter les limitations connues** plutôt que de viser la perfection inaccessible.

#### 2. Drizzle Peut Changer le Format SQL

**Risque** : Si Drizzle change sa génération SQL, le script peut casser.

**Mitigation** :

- Script simple, facile à ajuster
- Tests manuels lors des updates Drizzle
- Monitoring des releases Drizzle

**Apprentissage** : Accepter une **dépendance fragile** quand l'alternative (wrapper Drizzle custom) est pire.

#### 3. ADD CONSTRAINT Nécessite PL/pgSQL

PostgreSQL n'a pas de `ADD CONSTRAINT IF NOT EXISTS` natif.

**Solution** :

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_name') THEN
    ALTER TABLE "x" ADD CONSTRAINT "fk_name" ...;
  END IF;
END $$;
```

**Apprentissage** : Certains cas **nécessitent vraiment une intervention manuelle**. Ne pas forcer l'automatisation.

### ❌ Erreurs Évitées

#### 1. Ne Pas Créer un Wrapper Drizzle Custom

**Option rejetée** : Surcharger les méthodes de génération Drizzle.

**Raison** :

- Trop couplé aux internals Drizzle
- Maintenance cauchemardesque
- Risque de casser à chaque update

**Apprentissage** : **Ne pas toucher aux internals d'une bibliothèque externe**. Post-processing est plus safe.

#### 2. Ne Pas Viser 100% d'Automatisation

**Tentation** : Parser SQL complet avec AST pour gérer tous les cas.

**Raison de rejeter** :

- Effort démesuré (20-30h) pour peu de gain (les 20% restants)
- Parser SQL = problème complexe (dialectes, edge cases)
- Overkill pour un besoin ponctuel

**Apprentissage** : **80/20 rule**. 80% des bénéfices avec 20% de l'effort. Accepter que les 20% restants nécessitent du manuel.

#### 3. Ne Pas Parser avec des Bibliothèques Externes

**Option envisagée** : Utiliser `node-sql-parser` ou similaire.

**Raison de rejeter** :

- Dépendance supplémentaire
- Complexité ajoutée
- Regex suffisent pour les cas simples

**Apprentissage** : **YAGNI** (You Aren't Gonna Need It). Ne pas ajouter de dépendances "au cas où".

## Workflow Skills Orchestration

### Progression Efficace

```
/analyze (1h)
  → /explore-options (1.5h)
    → /tech-choice (0.5h, ADR créé)
      → /implement (1.5h)
        → /capitalize (0.5h)
          → /pre-merge
```

**Total** : ~5h de la demande initiale au merge.

**Apprentissage** : Le workflow structuré **accélère** plutôt que ralentir. Chaque phase a un objectif clair.

### ADR Avant Implémentation

Le fait de créer l'ADR-005 **avant** d'implémenter a permis :

- Valider l'approche avec l'utilisateur
- Avoir un plan clair pour `/implement`
- Documenter les options rejetées (évite de les réexplorer)

**Apprentissage** : **ADR = gain de temps**, pas une "paperasse". C'est un investissement qui évite les retours en arrière.

## Métriques

| Métrique                                    | Avant             | Après                         |
| ------------------------------------------- | ----------------- | ----------------------------- |
| Migrations idempotentes                     | 0/12 (0%)         | Standard établi pour 0012+    |
| Temps pour rendre une migration idempotente | 5-10 min (manuel) | 0 sec (auto) + 2 min (review) |
| Risque d'oubli                              | Élevé             | Faible (hook auto)            |
| Documentation                               | Inexistante       | ADR + Pattern SERENA          |

## Réutilisabilité

### Ce qui est réutilisable dans d'autres projets

1. **Pattern "NPM Hook + Script Post-Processing"**
   - Applicable à tout outil générant du code (Prisma, TypeORM, etc.)
   - Alternative légère aux wrappers custom

2. **Template ADR pour décisions techniques**
   - Format : Contexte → Options → Décision → Conséquences
   - Scoring matriciel pour comparer options

3. **Approche Hybrid (Auto + Doc)**
   - Applicable à tout système nécessitant validation humaine
   - Balance automation/sécurité

### Code réutilisable

Le script `make-idempotent.js` peut être adapté pour :

- Autres ORM (Prisma, TypeORM)
- Autres bases (MySQL, SQLite)
- Autres transformations post-génération

## Checklist pour Futures Migrations Similaires

- [ ] Identifier le format de génération de l'outil (Drizzle, Prisma, etc.)
- [ ] Lister les transformations idempotentes possibles
- [ ] Créer script post-processing avec regex basiques
- [ ] Détecter les cas edge avec warnings
- [ ] Documenter les cas manuels dans SERENA
- [ ] Intégrer via NPM hook
- [ ] Tester sur migration existante
- [ ] Créer ADR pour justifier l'approche
- [ ] Ajouter checklist code review

## Voir aussi

- ADR : `adr-2026-02-06-idempotent-migrations.md`
- Pattern : `pattern-idempotent-migrations.md`
- Lessons similaires : `lessons-learned-2026-02-05-law-tags-migration.md` (migration JSONB → relationnel)
- Standard : `std-code-review-systematic.md` (checklist migrations)

## Fichiers Créés

| Fichier                                   | Type   | Lignes  | Rôle                         |
| ----------------------------------------- | ------ | ------- | ---------------------------- |
| `scripts/make-idempotent.js`              | Script | 85      | Transformations automatiques |
| `adr-2026-02-06-idempotent-migrations.md` | ADR    | ~250    | Justification technique      |
| `pattern-idempotent-migrations.md`        | Doc    | ~100    | Patterns SQL + checklist     |
| `package.json` (modifié)                  | Config | 1 ligne | Hook NPM                     |

## Historique

| Date       | Modification                                            |
| ---------- | ------------------------------------------------------- |
| 2026-02-06 | Création suite à implémentation migrations idempotentes |
