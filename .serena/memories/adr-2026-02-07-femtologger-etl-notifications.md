# ADR-008 : Notifications Telegram des ETL avec FemtoLogger

## Métadonnées

- **ID** : ADR-008
- **Date** : 2026-02-07
- **Statut** : ✅ Accepté
- **Décideurs** : User, Claude Opus 4.6
- **Phase Roadmap** : Infrastructure / Monitoring

## Contexte

### Problème

NosElus possède 30 scripts ETL dans `scripts/etl/*.ts` qui importent des données depuis diverses sources (Assemblée nationale, Sénat, Parlement Européen, HowTheyVote.eu, etc.). Ces ETL sont exécutés manuellement ou via cron, et il n'existe actuellement **aucune notification** lors de leur complétion ou échec.

**Besoin** : Être notifié sur Telegram à la fin de n'importe quel ETL pour :
- Savoir qu'un import long (5-30 min) est terminé
- Détecter rapidement les échecs d'import
- Avoir un historique des exécutions ETL

### Drivers

1. **Monitoring** : Visibilité sur l'état des imports de données
2. **Réactivité** : Notification immédiate en cas d'erreur
3. **Historique** : Trace des exécutions dans Telegram (searchable)
4. **Simplicité** : Éviter un système de monitoring lourd (Prometheus, etc.)

### Contraintes

1. **Flag --dry-run** : AUCUNE notification ne doit être envoyée en mode dry-run
2. **Graceful degradation** : Échec de notification NE DOIT PAS crasher l'ETL
3. **Credentials optionnels** : L'ETL doit fonctionner même si Telegram n'est pas configuré
4. **30 scripts existants** : Tous doivent être notifiés de manière cohérente
5. **Patterns du projet** : Doit respecter `database-queries-factorization.md` (factorisation > duplication)

### Exploration préalable

Exploration documentée dans : `/tmp/.../scratchpad/femtologger-options-exploration.md`

**3 options évaluées** :
1. Modification directe de chaque script (duplication massive)
2. Helper centralisé `src/lib/server/etl/notifications.ts` ✅
3. Wrapper HOF (Higher-Order Function)

## Décision

Nous choisissons **Option 2 : Helper centralisé** via un module `src/lib/server/etl/notifications.ts` avec fonction `notifyETLComplete()`.

### Raisons principales

1. **Cohérence architecturale** : Suit le pattern établi `database-queries-factorization.md` (helpers réutilisables)
2. **DRY optimal** : Logique centralisée dans 1 fichier (~150 lignes), testable et maintenable
3. **Simplicité d'usage** : Import + 1 appel de fonction par script (2 lignes)
4. **Safety first** : 
   - Respect `--dry-run` centralisé (impossible d'oublier)
   - Graceful degradation (credentials manquants → warning, pas crash)
   - Error handling uniforme (try/catch ne crashe pas l'ETL)
5. **Extensibilité** : Facile d'ajouter Slack, Discord, webhooks plus tard

### Trade-offs acceptés

En choisissant cette option, nous acceptons :

- **30 fichiers à modifier** (2 lignes chacun = ~60 lignes total)
  - *Mitigation* : Modification mécanique, peut être scriptée si besoin
  
- **Import supplémentaire** dans chaque script ETL
  - *Mitigation* : 1 seule ligne d'import, pattern déjà utilisé (ex: `import { db } from '...'`)

- **Moins de flexibilité** que modification directe (formatage uniforme)
  - *Mitigation* : Paramètre `additionalInfo` permet customisation si nécessaire
  - *Avantage déguisé* : Uniformité = cohérence des messages

### Options rejetées

#### Option 1 : Modification directe (duplication)

**Rejetée** car :
- Viole le principe DRY et le pattern `database-queries-factorization.md`
- Maintenance cauchemardesque (bug = 30 fichiers à modifier)
- Risque d'incohérence entre scripts
- Score : 48/165 (29%)

#### Option 3 : Wrapper HOF (Higher-Order Function)

**Rejetée** car :
- Over-engineering pour le besoin
- Pattern non utilisé ailleurs dans le projet (nouveauté)
- Refactoring lourd (restructuration de 30 scripts)
- Debugging plus complexe (stacktrace avec wrapper)
- Incompatible avec scripts multi-étapes (ex: `import-all.ts`)
- Score : 106/165 (64%)

## Architecture

### Module centralisé

```
src/lib/server/etl/
├── notifications.ts        (NOUVEAU - 150 lignes)
│   ├── getLogger()        (singleton lazy)
│   └── notifyETLComplete()
├── utils.ts               (existant)
└── types.ts               (existant - ImportStats)
```

### Signature API

```typescript
// src/lib/server/etl/notifications.ts
export async function notifyETLComplete(
  scriptName: string,
  stats: ImportStats,
  options: {
    dryRun?: boolean;
    legislature?: string;
    additionalInfo?: Record<string, unknown>;
  } = {}
): Promise<void>
```

### Usage type

```typescript
// scripts/etl/import-actors.ts
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

async function main() {
  const config = getETLConfig();
  const dryRun = process.argv.includes('--dry-run');

  // ... logique ETL ...
  const actorsStats = await importActors(config);

  // ✅ Notification (2 lignes)
  await notifyETLComplete('import-actors', actorsStats, {
    dryRun,
    legislature: config.legislature
  });

  process.exit(0);
}
```

### Fonctionnalités clés

1. **Singleton lazy** : Logger Telegram initialisé une seule fois au premier appel
2. **Graceful degradation** : Si `TELEGRAM_BOT_TOKEN` ou `TELEGRAM_CHAT_ID` absents → warning, pas d'erreur
3. **Respect --dry-run** : Check centralisé, log `[DRY-RUN] Would send...`
4. **Error handling** : `try/catch` empêche crash ETL si notification échoue
5. **Formatage riche HTML** :
   - Emoji contextuel (✅ succès total, ⚠️ succès partiel, ❌ échec)
   - Stats formatées (total, insérés, mis à jour, ignorés, erreurs, taux de succès)
   - Legislature incluse si fournie

## Conséquences

### Positives

1. ✅ **Monitoring temps réel** : Notification Telegram immédiate à la fin de chaque ETL
2. ✅ **Historique searchable** : Messages Telegram archivés et cherchables
3. ✅ **Détection d'erreurs rapide** : Emoji ❌ si > 10% d'erreurs
4. ✅ **Cohérence** : Tous les ETL notifient de la même façon
5. ✅ **Maintenabilité** : Bug/amélioration = 1 fichier à modifier
6. ✅ **Testabilité** : Tests unitaires sur `notifications.ts` suffisent
7. ✅ **Extensibilité** : Ajout Slack/Discord = modification du helper uniquement
8. ✅ **Documentation centralisée** : JSDoc sur la fonction = source unique de vérité

### Négatives (à monitorer)

1. ⚠️ **Modification de 30 fichiers** : Effort mécanique mais non-négligeable
   - *Action* : Créer un script de migration si modification manuelle trop lente
   - *Estimation* : 2-3h pour modifier 30 scripts + tests

2. ⚠️ **Dépendance externe** : FemtoLogger depuis GitHub Packages
   - *Action* : Documenter setup `.npmrc` dans README
   - *Mitigation* : Package simple, peu de dépendances, code stable

3. ⚠️ **Rate limiting Telegram** : Limite ~30 messages/seconde
   - *Action* : Monitoring si problème (peu probable, <10 ETL/heure en pratique)
   - *Mitigation* : `import-all.ts` envoie 1 message par ETL (pas de burst)

4. ⚠️ **Spam Telegram** : Risque si ETL lancés en boucle (développement)
   - *Action* : Respecter `--dry-run` systématiquement en dev
   - *Mitigation* : Message clair "[DRY-RUN] Would send..." visible dans logs

### Actions requises

- [x] Exploration des options (ADR-008)
- [ ] Installation FemtoLogger : `npm install @frederictriquet/femtologger`
- [ ] Configuration `.npmrc` pour GitHub Packages
- [ ] Création module `src/lib/server/etl/notifications.ts`
- [ ] Tests unitaires `src/lib/server/etl/notifications.test.ts`
- [ ] Modification des 30 scripts ETL (import + appel)
- [ ] Documentation `.env.example` (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
- [ ] Documentation README : Setup Telegram bot (@BotFather)
- [ ] Test manuel sur 3-4 ETL représentatifs
- [ ] Capitalisation pattern dans SERENA

## Validation

### Checklist de validation

- [x] Les stakeholders ont été consultés (User a validé l'approche)
- [x] Les contraintes sont respectées (--dry-run, graceful degradation, 30 scripts)
- [x] La décision est cohérente avec l'architecture existante (suit `database-queries-factorization.md`)
- [x] Les risques sont acceptables et mitigés (voir section Conséquences)
- [x] Les alternatives ont été correctement évaluées (3 options, scoring 29%-64%-98%)
- [x] La décision est réversible (helper peut être retiré facilement)

### Critères de décision (scoring)

| Critère | Poids | Option 1<br>(Duplication) | Option 2<br>(Helper) ✅ | Option 3<br>(Wrapper) |
|---------|-------|---------------------------|-------------------------|-----------------------|
| **Cohérence projet** | 5 | 1/5 | **5/5** | 2/5 |
| **Maintenabilité** | 5 | 1/5 | **5/5** | 4/5 |
| **Effort** | 3 | 2/5 | **4/5** | 2/5 |
| **Testabilité** | 4 | 1/5 | **5/5** | 3/5 |
| **Flexibilité** | 3 | 5/5 | 4/5 | 2/5 |
| **Respect --dry-run** | 5 | 2/5 | **5/5** | 5/5 |
| **Onboarding** | 4 | 1/5 | **5/5** | 4/5 |
| **Risque** | 4 | 1/5 | **5/5** | 3/5 |
| **Score pondéré** | - | 48/165 | **161/165** | 106/165 |
| **Pourcentage** | - | 29% | **98%** | 64% |

### Approbation

**Décision approuvée** : ✅ Oui  
**Par** : User  
**Date** : 2026-02-07  
**Commentaires** : Approche cohérente avec les patterns du projet, balance optimale simplicité/maintenabilité

## Prochaines étapes

### Implémentation (ordre recommandé)

1. **Setup environnement** (~30 min)
   - [ ] Configurer `.npmrc` pour GitHub Packages
   - [ ] Installer FemtoLogger : `npm install @frederictriquet/femtologger`
   - [ ] Ajouter variables `.env.example`

2. **Création module** (~1h30)
   - [ ] Créer `src/lib/server/etl/notifications.ts`
   - [ ] JSDoc complet sur `notifyETLComplete()`
   - [ ] Singleton `getLogger()` avec lazy init

3. **Tests** (~45 min)
   - [ ] Tests unitaires : credentials absents → warning
   - [ ] Tests unitaires : --dry-run → log, pas d'appel API
   - [ ] Tests unitaires : stats → formatage correct emoji/message
   - [ ] Mock TelegramTransport pour isolation

4. **Intégration scripts** (~2h)
   - [ ] Modifier 30 scripts ETL (import + appel)
   - [ ] Vérifier compilation TypeScript : `npx tsc --noEmit`

5. **Validation** (~30 min)
   - [ ] Test manuel dry-run : `npm run etl:import-actors -- --dry-run`
   - [ ] Test manuel réel (3-4 ETL) avec Telegram configuré
   - [ ] Vérifier messages Telegram (formatage, emoji, stats)

6. **Documentation** (~30 min)
   - [ ] README : Setup Telegram bot (@BotFather, @userinfobot)
   - [ ] `.env.example` : TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
   - [ ] Capitaliser pattern dans SERENA

**Effort total estimé** : ~6h

### Skill suivante

`/implement` pour créer le module + tests puis modifier les scripts ETL

## Références

### Documents liés

- **Exploration** : `/tmp/.../scratchpad/femtologger-options-exploration.md`
- **Pattern projet** : `database-queries-factorization.md`
- **Standard ETL** : `std-etl-cli-scripts.md`
- **FemtoLogger** : https://github.com/frederictriquet/femtologger

### Patterns connexes

- `pattern-batch-loading-n-plus-one.md` : Principe de centralisation (batch loading vs N queries)
- `pattern-oauth-token-caching.md` : Singleton pattern pour cache de tokens
- `std-api-integration-external.md` : Intégration API externes avec graceful degradation

### ETL concernés (30 scripts)

```
scripts/etl/
├── analyze-laws.ts
├── classify-scrutins.ts
├── download-data.ts
├── enrich-europarl-law-texts.ts
├── enrich-pe-group-names.ts
├── import-actors.ts
├── import-all.ts
├── import-amendements.ts
├── import-an.ts
├── import-dossiers-an.ts
├── import-europarl-activity-stats.ts
├── import-europarl-historical.ts
├── import-europarl-laws.ts
├── import-europarl-meps.ts
├── import-europarl-votes.ts
├── import-external-colors.ts
├── import-groupes-colors.ts
├── import-law-texts-piste.ts
├── import-laws.ts
├── import-nosdeputes-stats.ts
├── import-nosdeputes.ts
├── import-nossenateurs-stats.ts
├── import-political-positions.ts
├── import-scrutins.ts
├── import-senat-activity-stats.ts
├── import-senat-laws.ts
├── import-senat-mandates-history.ts
├── import-senat-senators.ts
├── link-scrutins-by-title.ts
├── seed-pe-positions.ts
└── sync-group-colors.ts
```

## Format de message Telegram

### Exemple : Succès total

```
✅ ETL Terminé: import-actors (AN-17)

📊 Résultats:
  • Total: 577
  • Insérés: 450
  • Mis à jour: 127
  • Ignorés: 0
  • Erreurs: 0
  • Taux de succès: 100.0%
```

### Exemple : Succès partiel

```
⚠️ ETL Terminé: import-scrutins (AN-17)

📊 Résultats:
  • Total: 1250
  • Insérés: 1180
  • Mis à jour: 50
  • Ignorés: 10
  • Erreurs: 10
  • Taux de succès: 99.2%
```

### Exemple : Échec significatif

```
❌ ETL Terminé: import-europarl-laws (PE-10)

📊 Résultats:
  • Total: 2039
  • Insérés: 1800
  • Mis à jour: 50
  • Ignorés: 0
  • Erreurs: 189
  • Taux de succès: 90.7%
```

## Évolution future (hors scope ADR)

### Extensions possibles

1. **Multi-transports** : Slack, Discord, webhooks
2. **Niveaux de verbosité** : `TELEGRAM_NOTIFY_LEVEL=errors|all`
3. **Groupement de messages** : 1 message récapitulatif pour `import-all.ts`
4. **Métriques** : Durée d'exécution, débit (records/sec)
5. **Liens directs** : URL vers logs, DB, dashboard

### Alternatives à considérer plus tard

- **Monitoring dédié** : Prometheus + Grafana si volume ETL augmente significativement
- **Notification conditionnelle** : Seulement si erreurs > seuil
- **Dashboard temps réel** : WebSocket pour afficher ETL en cours

## Changelog

| Date | Modification | Auteur |
|------|--------------|--------|
| 2026-02-07 | Création ADR-008 | Claude Opus 4.6 |

---

**Tags** : `#etl` `#notifications` `#telegram` `#monitoring` `#infrastructure`
