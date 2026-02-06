# ADR-005 : Migrations de Base de Données Idempotentes

## Métadonnées
- **Date** : 2026-02-06
- **Statut** : ✅ Accepté
- **Décideurs** : Équipe technique NosElus
- **Catégorie** : Infrastructure / Base de données

---

## Contexte

### Problème

Les migrations de base de données générées par Drizzle ORM ne sont pas idempotentes. Si elles sont ré-exécutées manuellement (hors du système de tracking), elles échouent avec des erreurs du type :
- `ERROR: relation "table_name" already exists`
- `ERROR: column "column_name" of relation "table_name" already exists`
- `ERROR: duplicate key value violates unique constraint`

Cela pose problème dans plusieurs scénarios :
1. **Environnements de développement** : Reset fréquent de la base nécessite re-run des migrations
2. **Récupération après erreur** : Si une migration échoue partiellement, impossible de la ré-exécuter
3. **Tests d'intégration** : Setup/teardown nécessite migrations idempotentes
4. **Debugging** : Application manuelle de migrations pour investigation

### Drivers

1. **Fiabilité** : Besoin de migrations robustes qui tolèrent les ré-exécutions
2. **Developer Experience** : Faciliter le travail en local sans craindre les migrations
3. **Récupération** : Permettre la reprise après erreurs partielles
4. **Standards** : Établir une pratique cohérente pour futures migrations

### Contraintes

1. **Ne pas modifier les migrations existantes (0000-0011)** : Déjà appliquées en production, risque critique
2. **Conserver Drizzle** : Outil de migration établi du projet, changement trop coûteux
3. **Compatibilité PostgreSQL** : Toutes les solutions doivent fonctionner avec PG 14+
4. **Maintenabilité** : Solution doit être simple à comprendre et maintenir

---

## Décision

Nous choisissons **Option 6 : Hybrid (Script NPM Hook + Documentation SERENA)** parce que :

1. **Automatisation du 80% des cas** : Script regex transforme automatiquement les opérations courantes
2. **Documentation pour les 20% restants** : Guide SERENA pour les cas complexes
3. **Validation humaine** : Review de code assure la qualité finale
4. **Évolutivité** : Facile d'améliorer le script au fil des retours
5. **Équilibre effort/bénéfice optimal** : 6-8h de setup pour un bénéfice permanent

### Architecture

```
npm run db:generate
  ↓
drizzle-kit generate (SQL non-idempotent)
  ↓
scripts/make-idempotent.js (transformations regex automatiques)
  ↓
Migration fichier .sql modifiée
  ↓
Développeur review manuellement (consulte doc SERENA si besoin)
  ↓
git commit → Code review vérifie idempotence
```

### Transformations automatiques

- `CREATE TABLE` → `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX` → `CREATE INDEX IF NOT EXISTS`
- `ALTER TABLE ADD COLUMN` → `ADD COLUMN IF NOT EXISTS`
- `DROP INDEX/COLUMN` → `DROP IF EXISTS`

### Cas manuels (documentation)

- `ADD CONSTRAINT` : Wrapper PL/pgSQL avec `IF NOT EXISTS`
- `INSERT` : `ON CONFLICT DO NOTHING`

---

## Options Considérées

| Option | Score | Effort | Verdict |
|--------|-------|--------|---------|
| 1. Manuel + Checklist | 103/130 | Faible | ❌ Trop de risque d'oubli |
| 2. Script Post-Processing | 100/130 | Moyen | ❌ Parser trop complexe |
| 3. Wrapper Drizzle Custom | 51/130 | Élevé | ❌ Maintenance cauchemardesque |
| 4. Full Manual | 100/130 | Élevé | ❌ Perte avantages Drizzle |
| 5. NPM Hook Simple | 108/130 | Faible | ⚠️ Pas de doc pour cas edge |
| **6. Hybrid (Script + Doc)** | **114/130** | **Moyen** | **✅ CHOISI** |

---

## Conséquences

### Positives
- ✅ Migrations futures (0012+) idempotentes
- ✅ 80% des transformations automatiques
- ✅ Documentation claire pour cas complexes
- ✅ Process cohérent pour l'équipe
- ✅ Moins de galères en dev

### Négatives (mitigées)
- ⚠️ Regex limitées → Doc couvre les cas edge + review humaine
- ⚠️ Discipline requise → Checklist code review obligatoire
- ⚠️ Maintenance script → Simple (~50 lignes), facile à ajuster

---

## Actions Requises

- [x] Créer `scripts/make-idempotent.js`
- [x] Modifier `package.json` : `db:generate` appelle le script
- [x] Créer documentation : `pattern-idempotent-migrations.md`
- [x] Ajouter checklist code review
- [ ] Tester sur migration 0012
- [ ] Communiquer à l'équipe

---

## Références

- [Drizzle ORM - Migrations](https://orm.drizzle.team/docs/migrations)
- [Drizzle ORM - Custom migrations](https://orm.drizzle.team/docs/kit-custom-migrations)
- [8 Drizzle ORM Patterns](https://medium.com/@bhagyarana80/8-drizzle-orm-patterns-for-clean-fast-migrations-456c4c35b9d8)
- Lessons: `lessons-learned-2026-02-05-law-tags-migration.md`

---

## Date de création
2026-02-06
