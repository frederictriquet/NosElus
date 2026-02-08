# Pattern : Notifications Telegram pour ETL

**Type** : Infrastructure / Monitoring  
**Date** : 2026-02-07  
**Statut** : ✅ Standard du projet (31 scripts intégrés)

---

## Contexte d'Usage

**Quand utiliser ce pattern** :
- Scripts ETL exécutés en tâche de fond (cron, CI)
- Besoin de monitoring en temps réel du succès/échec
- Statistiques d'import à communiquer automatiquement
- Notifications mobiles pour les erreurs critiques

**Avantages** :
- ✅ Notification temps réel sur mobile
- ✅ Pas de consultation manuelle des logs
- ✅ Détection rapide des problèmes
- ✅ Historique dans Telegram (recherchable)
- ✅ Graceful degradation (pas de crash si désactivé)

---

## Implémentation Standard

### 1. Import du module

```typescript
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';
import type { ImportStats } from '../../src/lib/server/etl/types.js';
```

### 2. Pattern simple (1 étape)

```typescript
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const config = getETLConfig();
  
  // Logique ETL
  const stats = await importData(config);
  
  // Notification
  await notifyETLComplete('nom-du-script', stats, {
    dryRun,
    legislature: config.legislature  // optionnel
  });
}
```

### 3. Pattern multi-étapes (combinaison)

```typescript
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const config = getETLConfig();
  
  // Étape 1
  const step1Stats = await importOrgans(config);
  console.log(`Organes: ${step1Stats.inserted} imported`);
  
  // Étape 2
  const step2Stats = await importActors(config);
  console.log(`Acteurs: ${step2Stats.inserted} imported`);
  
  // Étape 3
  const step3Stats = await importMandates(config);
  console.log(`Mandats: ${step3Stats.inserted} imported`);
  
  // Combiner les stats
  const combinedStats: ImportStats = {
    total: step1Stats.total + step2Stats.total + step3Stats.total,
    inserted: step1Stats.inserted + step2Stats.inserted + step3Stats.inserted,
    updated: step1Stats.updated + step2Stats.updated + step3Stats.updated,
    skipped: step1Stats.skipped + step2Stats.skipped + step3Stats.skipped,
    errors: step1Stats.errors + step2Stats.errors + step3Stats.errors
  };
  
  // Notification unique avec détails
  await notifyETLComplete('import-all', combinedStats, {
    dryRun,
    legislature: config.legislature,
    additionalInfo: {
      organs: step1Stats.inserted,
      actors: step2Stats.inserted,
      mandates: step3Stats.inserted
    }
  });
}
```

---

## Interface ImportStats

```typescript
interface ImportStats {
  total: number;      // Nombre total d'entités traitées
  inserted: number;   // Nouvelles entités créées
  updated: number;    // Entités existantes mises à jour
  skipped: number;    // Entités ignorées (déjà à jour, filtres)
  errors: number;     // Échecs de traitement
}
```

**Règles de calcul** :
- `total` = inserted + updated + skipped + errors
- `successRate` = ((inserted + updated) / total) × 100

---

## Configuration

### Variables d'environnement (.env)

```bash
# Telegram Notifications (ETL)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

**Obtention** :
1. **Bot Token** : Telegram → @BotFather → `/newbot`
2. **Chat ID** : Telegram → @userinfobot → `/start`

**Optionnel** : Si non configuré, les ETL continuent normalement avec un warning.

---

## Comportement --dry-run

```typescript
await notifyETLComplete('script', stats, {
  dryRun: process.argv.includes('--dry-run')  // ⚠️ OBLIGATOIRE
});
```

**Avec --dry-run** :
```
[DRY-RUN] Would send Telegram notification for: import-actors
[DRY-RUN] Stats: {"total":577,"inserted":450,...}
```

**Sans --dry-run** :
```
✅ Telegram notification sent for: import-actors
```

**⚠️ Ne jamais oublier le flag dryRun** (bloque les notifications en mode simulation).

---

## Format des Messages

### Succès total (0 erreur)
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

### Succès partiel (< 10% erreurs)
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

### Échec significatif (≥ 10% erreurs)
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

---

## Comptage des Erreurs

### Pattern standard

```typescript
let errors = 0;

for (const item of items) {
  try {
    await processItem(item);
  } catch (error) {
    console.error(`Failed to process ${item.id}:`, error);
    errors++;
  }
}

const stats: ImportStats = {
  total: items.length,
  inserted: newItems.length,
  updated: updatedItems.length,
  skipped: skippedItems.length,
  errors
};
```

### Pattern avec recovery (fallback URLs)

```typescript
let errors = 0;

for (const item of items) {
  try {
    await processPrimary(item);
  } catch (primaryError) {
    // Tentative avec source alternative
    let recovered = false;
    
    for (const fallback of fallbackSources) {
      try {
        await processFallback(item, fallback);
        recovered = true;
        break;
      } catch {
        continue;
      }
    }
    
    if (!recovered) {
      errors++;  // Compter seulement si échec sur toutes les sources
    }
  }
}
```

**⚠️ Ne jamais hardcoder `errors: 0`** sans tracking réel.

---

## Anti-Patterns à Éviter

### ❌ Oublier le flag dryRun

```typescript
// FAUX
await notifyETLComplete('script', stats);

// CORRECT
await notifyETLComplete('script', stats, {
  dryRun: process.argv.includes('--dry-run')
});
```

### ❌ Hardcoder errors à 0

```typescript
// FAUX
const stats = {
  total: items.length,
  inserted: newItems.length,
  updated: 0,
  skipped: 0,
  errors: 0  // ❌ Pas de tracking des vraies erreurs
};

// CORRECT
let errors = 0;
try {
  // ... logique ...
} catch {
  errors++;
}
const stats = { ..., errors };
```

### ❌ Notifications multiples pour 1 script

```typescript
// FAUX (pollution Telegram)
await notifyETLComplete('import-step1', step1Stats, { dryRun });
await notifyETLComplete('import-step2', step2Stats, { dryRun });
await notifyETLComplete('import-step3', step3Stats, { dryRun });

// CORRECT (1 notification combinée)
const combinedStats = {
  total: step1Stats.total + step2Stats.total + step3Stats.total,
  // ... autres champs ...
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

---

## Checklist d'Intégration

Quand ajouter des notifications à un nouveau script ETL :

- [ ] Import de `notifyETLComplete` et `ImportStats`
- [ ] Tracking des erreurs avec compteur `let errors = 0`
- [ ] Structurer les stats selon l'interface `ImportStats`
- [ ] Appeler `notifyETLComplete()` à la fin du script
- [ ] Passer le flag `dryRun: process.argv.includes('--dry-run')`
- [ ] Ajouter `legislature` si pertinent
- [ ] Si multi-étapes, combiner les stats avant notification
- [ ] Tester en mode `--dry-run` (doit logger, pas envoyer)
- [ ] Tester sans credentials (doit warning, pas crash)

---

## Dépannage

### Pas de notification reçue

1. Vérifier les variables d'environnement :
   ```bash
   node -e "require('dotenv').config(); console.log(process.env.TELEGRAM_BOT_TOKEN)"
   ```

2. Vérifier que le bot est ajouté au chat :
   - Chat privé : envoyer `/start` au bot
   - Groupe : ajouter le bot comme membre

3. Vérifier qu'on n'est pas en `--dry-run` :
   ```bash
   npm run etl:mon-script  # Sans --dry-run
   ```

### Warning "credentials not configured"

**Cause** : Variables manquantes dans `.env`

**Solution** :
1. Créer/compléter `.env` à la racine
2. Ajouter `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID`
3. Relancer le script

**Note** : Ce warning n'empêche pas l'ETL de fonctionner (graceful degradation).

---

## Références

- **Module** : `src/lib/server/etl/notifications.ts`
- **Documentation** : `docs/features/telegram-notifications.md`
- **ADR** : `.serena/memories/adr-2026-02-07-femtologger-etl-notifications.md`
- **Package** : [@frederictriquet/femtologger](https://www.npmjs.com/package/@frederictriquet/femtologger)

---

## Tags

`#pattern` `#etl` `#notifications` `#telegram` `#monitoring` `#infrastructure`
