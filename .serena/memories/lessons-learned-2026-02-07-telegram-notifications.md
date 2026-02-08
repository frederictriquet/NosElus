# Leçons Apprises : Intégration Telegram Notifications (2026-02-07)

**Type** : Post-implémentation  
**Sessions** : 3 (exploration → implémentation → review)  
**Résultat** : ✅ 31 scripts intégrés, 0 erreurs TypeScript, documentation complète

---

## 1. Ce qui a Bien Fonctionné ✅

### Approche modulaire centralisée

**Décision** : Un seul module `notifications.ts` avec fonction publique `notifyETLComplete()`

**Résultat** :
- Aucune duplication de code
- Modifications centralisées (ex: fix regex .env → 1 fichier)
- Pattern uniforme sur 31 scripts
- Type-safety garantie via interface partagée

**Leçon** : Pour une fonctionnalité transverse, toujours centraliser la logique métier.

---

### Graceful degradation obligatoire

**Décision** : Credentials manquants ou erreur d'envoi → warning, pas crash

**Résultat** :
- 0 ETL cassé si Telegram mal configuré
- Adoption facilitée (pas besoin de setup immédiat)
- Logs explicites pour debugging

**Code clé** :
```typescript
if (!credentials) {
  console.warn('⚠️  Telegram credentials not configured.');
  console.warn('   ETL notifications will be skipped.');
  return;  // Pas d'exception
}
```

**Leçon** : Les fonctionnalités non-critiques doivent toujours être dégradables proprement.

---

### Singleton lazy avec guard

**Décision** : Logger créé au premier appel, réutilisé ensuite

**Résultat** :
- Pas de connexion multiple inutile
- Détection credentials au runtime (pas au build)
- Pattern clair et maintenable

**Code clé** :
```typescript
let telegramLogger: FemtoLogger | null | undefined;
// undefined = pas encore initialisé, null = credentials manquants

function getLogger(): FemtoLogger | null {
  if (telegramLogger !== undefined) return telegramLogger;
  // ... initialisation ...
}
```

**Leçon** : Utiliser `undefined` vs `null` comme états sémantiques différents.

---

### Code review systématique avant merge

**Process** : Invoke `/code-review --thorough --security` sur 38 fichiers

**Résultat** : Détection de 4 issues avant production :
1. Regex .env fragile (pas de support quotes)
2. Compteur erreurs hardcodé à 0
3. 18 scripts sans flag dryRun
4. Patterns inconsistants

**Leçon** : Review systématique = investissement faible, ROI énorme.

---

## 2. Problèmes Rencontrés et Solutions 🔧

### Problème 1 : Regex .env trop simpliste

**Symptôme** : `TELEGRAM_BOT_TOKEN="value"` (avec quotes) → parsing échoué

**Cause** : Regex `/^(TELEGRAM_\w+)=(.+)$/` capture les quotes dans la valeur

**Solution** :
```typescript
// Avant
const match = trimmed.match(/^(TELEGRAM_\w+)=(.+)$/);

// Après
const match = trimmed.match(/^(TELEGRAM_\w+)=["']?(.+?)["']?$/);
```

**Impact** : Support de tous les formats d'écriture `.env`

**Leçon** : Toujours supporter les variantes syntaxiques courantes (quotes, espaces, etc.).

---

### Problème 2 : Erreurs non trackées (download-data.ts)

**Symptôme** : Script rapport `errors: 0` même quand téléchargement échoue

**Cause** : Hardcodage de `errors: 0` au lieu de compter les vraies erreurs

**Solution** :
```typescript
let errors = 0;

for (const dataset of DATASETS) {
  try {
    await download(dataset.url);
  } catch (error) {
    // Tentative avec URLs alternatives
    let recovered = false;
    for (const altUrl of altUrls) {
      try {
        await download(altUrl);
        recovered = true;
        break;
      } catch { continue; }
    }
    if (!recovered) errors++;
  }
}

const stats = { ..., errors };  // Valeur réelle
```

**Leçon** : Ne jamais hardcoder des métriques qui devraient être calculées.

---

### Problème 3 : Flag dryRun oublié (18 scripts)

**Symptôme** : Notifications envoyées même avec `--dry-run`

**Cause** : Appels sans le paramètre `dryRun` dans `notifyETLComplete()`

**Solution** : Pattern uniforme ajouté partout :
```typescript
await notifyETLComplete('script', stats, {
  dryRun: process.argv.includes('--dry-run')
});
```

**Leçon** : Les flags comportementaux (dry-run, verbose, etc.) doivent être explicites, pas optionnels.

---

### Problème 4 : Choix du package (FemtoLogger vs Winston)

**Dilemme initial** : Winston (populaire) vs FemtoLogger (léger)

**Analyse** :
- Winston : 7.5 MB, complexe, pas de transport Telegram officiel
- FemtoLogger : 50 KB, TelegramTransport natif, HTML formatting built-in

**Décision** : FemtoLogger (principe YAGNI)

**Résultat** : Configuration en 2 lignes, 0 overhead

**Leçon** : Choisir la solution la plus simple qui répond au besoin. L'overkill crée de la complexité inutile.

---

## 3. Patterns Identifiés et Capitalisés 📚

### Pattern 1 : Stats combinés multi-étapes

**Cas d'usage** : ETL en plusieurs phases (organes → acteurs → mandats)

**Pattern** :
```typescript
const allStats: ImportStats[] = [step1Stats, step2Stats, step3Stats];

const combinedStats: ImportStats = {
  total: allStats.reduce((sum, s) => sum + s.total, 0),
  inserted: allStats.reduce((sum, s) => sum + s.inserted, 0),
  updated: allStats.reduce((sum, s) => sum + s.updated, 0),
  skipped: allStats.reduce((sum, s) => sum + s.skipped, 0),
  errors: allStats.reduce((sum, s) => sum + s.errors, 0)
};

await notifyETLComplete('import-all', combinedStats, {
  dryRun,
  additionalInfo: {
    step1: step1Stats.inserted,
    step2: step2Stats.inserted,
    step3: step3Stats.inserted
  }
});
```

**Capitalisation** : Documenté dans `pattern-etl-telegram-notifications.md`

---

### Pattern 2 : Error recovery avec flag

**Cas d'usage** : Retry sur sources alternatives avant de compter une erreur

**Pattern** :
```typescript
let recovered = false;

for (const altSource of alternatives) {
  try {
    await process(altSource);
    recovered = true;
    break;
  } catch { continue; }
}

if (!recovered) errors++;
```

**Capitalisation** : Documenté dans ADR-008

---

### Pattern 3 : HTML formatting contextuel

**Cas d'usage** : Messages Telegram avec emojis et formatage selon statut

**Pattern** :
```typescript
function getStatusEmoji(stats: ImportStats): string {
  if (stats.errors === 0) return '✅';  // Succès total
  const errorRate = stats.errors / stats.total;
  return errorRate < 0.1 ? '⚠️' : '❌';  // Partiel vs Échec
}

const message = `
${getStatusEmoji(stats)} ETL Terminé: ${scriptName} ${legislature || ''}

📊 Résultats:
  • Total: ${stats.total}
  • Insérés: ${stats.inserted}
  ...
`;
```

**Capitalisation** : API reference dans documentation complète

---

## 4. Décisions Architecturales 🏗️

### Décision A : Module centralisé vs modification de chaque script

**Option 1** : Dupliquer la logique Telegram dans chaque script  
**Option 2** : Module centralisé avec fonction publique  
**Option 3** : Middleware générique (process.exit hook)

**Choix** : Option 2 (module centralisé)

**Justification** :
- Maintenance : 1 fichier vs 31 fichiers
- Évolutivité : Ajouter Discord = 1 ligne de code
- Type-safety : Interface partagée garantie

**ADR** : `adr-2026-02-07-femtologger-etl-notifications.md`

---

### Décision B : Notification unique vs par étape

**Option 1** : 1 notification par phase (scrutins, votes, laws...)  
**Option 2** : 1 notification combinée en fin de script

**Choix** : Option 2 (notification unique)

**Justification** :
- Moins de bruit dans Telegram
- Vue d'ensemble claire du succès global
- additionalInfo permet de détailler les phases

**Pattern** : Documenté dans `pattern-etl-telegram-notifications.md`

---

### Décision C : Chargement .env manuel vs dotenv package

**Option 1** : `require('dotenv').config()`  
**Option 2** : Parsing manuel de `.env`

**Choix** : Option 2 (parsing manuel)

**Justification** :
- Déjà pattern existant dans le projet (cohérence)
- Pas de dépendance runtime supplémentaire
- Contrôle total sur le parsing (support quotes, comments)

**Code** : `loadTelegramEnv()` in notifications.ts

---

## 5. Métriques et Impact 📊

### Portée de l'intégration

- **Scripts modifiés** : 31 ETL
- **Lignes ajoutées** : ~400 (module + appels)
- **Lignes de doc** : 492 (telegram-notifications.md)
- **Commits** : 6 (exploration → implémentation → fixes)
- **TypeScript errors** : 0 (validation OK)

### Temps d'implémentation

- **Session 1** (exploration) : ~1h
- **Session 2** (implémentation) : ~2h
- **Session 3** (review + doc) : ~1h
- **Total** : 4h pour 31 scripts + doc complète

### Adoption

- **Configuration requise** : 2 variables d'environnement
- **Temps setup** : 5 minutes (création bot Telegram)
- **Breaking changes** : 0 (feature opt-in)

---

## 6. À Éviter à l'Avenir ❌

### Anti-pattern 1 : Hardcoder des métriques

```typescript
// ❌ FAUX
const stats = { errors: 0 };  // Pas de tracking réel

// ✅ CORRECT
let errors = 0;
try { ... } catch { errors++; }
const stats = { errors };
```

---

### Anti-pattern 2 : Oublier le dry-run

```typescript
// ❌ FAUX (notifications en mode simulation)
await notifyETLComplete('script', stats);

// ✅ CORRECT
await notifyETLComplete('script', stats, {
  dryRun: process.argv.includes('--dry-run')
});
```

---

### Anti-pattern 3 : Notifications multiples pour 1 ETL

```typescript
// ❌ FAUX (pollution Telegram)
await notifyETLComplete('step1', step1Stats, { dryRun });
await notifyETLComplete('step2', step2Stats, { dryRun });

// ✅ CORRECT (stats combinés)
const combinedStats = { ... };
await notifyETLComplete('import-all', combinedStats, {
  dryRun,
  additionalInfo: { step1: ..., step2: ... }
});
```

---

## 7. Recommandations Futures 🚀

### Court terme

1. **Monitoring** : Créer dashboard avec historique des notifications
   - Table `etl_runs` pour stocker les stats
   - Endpoint `/api/etl/history` pour consultation

2. **Alertes** : Configurer notifications critiques (>20% erreurs)
   - Message urgent avec tag @username
   - Logs détaillés des erreurs

3. **Tests** : Ajouter tests unitaires pour `notifications.ts`
   - Mock de FemtoLogger
   - Validation format des messages
   - Coverage des edge cases

### Moyen terme

4. **Support multi-channels** : Discord, Slack
   - FemtoLogger supporte Discord nativement
   - Slack nécessite un transport custom

5. **Enrichissement** : Liens vers logs, durée d'exécution
   - Ajouter `duration` dans additionalInfo
   - URL vers logs CloudWatch/Datadog

### Long terme

6. **Orchestration** : Système de retry automatique sur échec
   - Détection erreurs récupérables
   - Relance automatique avec backoff

---

## 8. Documentation Créée 📖

- **ADR** : `adr-2026-02-07-femtologger-etl-notifications.md` (décision technique)
- **Pattern** : `pattern-etl-telegram-notifications.md` (guide d'implémentation)
- **Features** : `docs/features/telegram-notifications.md` (documentation utilisateur, 492 lignes)
- **Lessons** : Ce fichier (post-mortem de l'implémentation)

---

## 9. Validation Finale ✅

### Checklist de qualité

- [x] TypeScript compilation : 0 erreurs
- [x] Prettier formatting : Tous fichiers conformes
- [x] Tests manuels : Dry-run et production testés
- [x] Code review : 4 issues détectées et corrigées
- [x] Documentation : Complète (setup, usage, troubleshooting, API)
- [x] Capitalisation SERENA : ADR + Pattern + Lessons documented

### Coverage des cas d'usage

- [x] ETL simple (1 phase)
- [x] ETL multi-étapes (stats combinés)
- [x] Scripts avec options (--legislature, --incremental)
- [x] Scripts avec retry (fallback URLs)
- [x] Mode dry-run (simulation)
- [x] Credentials manquants (graceful degradation)
- [x] Erreur d'envoi (warning, pas crash)

---

## Tags

`#lessons-learned` `#etl` `#telegram` `#notifications` `#post-mortem` `#2026-02-07`
