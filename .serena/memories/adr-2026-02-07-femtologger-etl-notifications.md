# ADR-008 : Intégration FemtoLogger pour notifications Telegram des ETL

**Date** : 2026-02-07  
**Statut** : ✅ Accepté et implémenté  
**Contexte** : Session de travail en 3 phases (exploration → implémentation → review)

---

## Problème

Les 31 scripts ETL du projet s'exécutent en tâche de fond (cron, CI) sans monitoring actif. En cas d'échec ou de succès partiel, il faut consulter manuellement les logs pour détecter les problèmes.

**Besoin** : Recevoir une notification automatique à la fin de chaque ETL avec :

- Statut (succès, partiel, échec)
- Statistiques détaillées (total, inserted, updated, skipped, errors)
- Législature concernée
- Taux de succès calculé automatiquement

---

## Options Évaluées

### Option 1 : Nodemailer (email)

❌ **Rejetée**

- Configuration SMTP complexe
- Pas de notification temps réel mobile
- Risque spam/filtrage

### Option 2 : Winston + Transport custom

❌ **Rejetée**

- Winston trop lourd pour ce besoin simple
- Pas de transport Telegram officiel
- Overhead de configuration

### Option 3 : FemtoLogger

✅ **Retenue**

- Package ultra-léger (@frederictriquet/femtologger)
- TelegramTransport natif avec HTML formatting
- Configuration minimale (2 variables d'environnement)
- Maintenu activement (v0.1.4)

### Option 4 : Appels directs Telegram Bot API

❌ **Rejetée**

- Réinventer la roue (gestion tokens, retry, formatting)
- Code boilerplate dans chaque script
- Pas de type-safety

---

## Décision

**Intégration de FemtoLogger v0.1.4 avec module centralisé**

### Architecture

```
src/lib/server/etl/
├── notifications.ts          # Module centralisé (244 lignes)
│   ├── loadTelegramEnv()    # Charge .env manuellement
│   ├── getLogger()          # Singleton lazy du logger Telegram
│   ├── notifyETLComplete()  # Fonction publique principale
│   └── getStatusEmoji()     # Calcul emoji contextuel
├── types.ts                 # ImportStats interface (existant)
└── utils.ts                 # Utilitaires ETL standards
```

### Principes de design

1. **Graceful degradation** :
   - Credentials manquants → warning + skip
   - Erreur d'envoi → warning + continue
   - **L'ETL ne crashe JAMAIS à cause des notifications**

2. **Singleton lazy** :
   - Logger créé au premier appel de `getLogger()`
   - Réutilisé pour tous les appels suivants
   - Évite les connexions multiples

3. **Respect --dry-run** :
   - Check centralisé dans `notifyETLComplete()`
   - Impossible d'oublier dans un script
   - Log explicite en mode dry-run

4. **Type-safe** :
   - Interface `ImportStats` réutilisée (existante)
   - Interface `NotifyOptions` pour les paramètres optionnels
   - TypeScript strict mode

---

## Implémentation

### Pattern d'appel standard

```typescript
import { notifyETLComplete } from '../../src/lib/server/etl/notifications.js';

const stats = await runETL(config);

await notifyETLComplete('nom-script', stats, {
	dryRun: process.argv.includes('--dry-run'),
	legislature: config.legislature, // optionnel
	additionalInfo: { key: value } // optionnel
});
```

### Scripts multi-étapes

Pour les ETL combinant plusieurs opérations (ex: import-scrutins = scrutins + votes) :

```typescript
const scrutinsStats = await importScrutins(config);
const votesStats = await importVotes(config);

const combinedStats = {
	total: scrutinsStats.total + votesStats.total,
	inserted: scrutinsStats.inserted + votesStats.inserted,
	updated: scrutinsStats.updated + votesStats.updated,
	skipped: scrutinsStats.skipped + votesStats.skipped,
	errors: scrutinsStats.errors + votesStats.errors
};

await notifyETLComplete('import-scrutins', combinedStats, {
	dryRun: process.argv.includes('--dry-run'),
	legislature: config.legislature,
	additionalInfo: {
		scrutins: scrutinsStats.inserted,
		votes: votesStats.inserted
	}
});
```

---

## Portée

**31 scripts ETL intégrés** :

### Assemblée Nationale (9)

- import-actors.ts, import-scrutins.ts, import-laws.ts
- import-nosdeputes.ts, import-nosdeputes-stats.ts
- import-dossiers-an.ts, import-amendements.ts
- import-an.ts (multi-flags), import-all.ts (orchestrateur)

### Sénat (5)

- import-senat-laws.ts, import-senat-senators.ts
- import-senat-activity-stats.ts, import-senat-mandates-history.ts
- import-nossenateurs-stats.ts

### Parlement Européen (6)

- import-europarl-laws.ts, import-europarl-votes.ts
- import-europarl-meps.ts, import-europarl-activity-stats.ts
- import-europarl-historical.ts, enrich-pe-group-names.ts

### Utilitaires (11)

- classify-scrutins.ts, link-scrutins-by-title.ts
- analyze-laws.ts, import-law-texts-piste.ts
- enrich-europarl-law-texts.ts
- import-external-colors.ts, import-groupes-colors.ts, sync-group-colors.ts
- seed-pe-positions.ts, import-political-positions.ts
- download-data.ts

---

## Format des Messages

### Logique des emojis

```typescript
function getStatusEmoji(stats: ImportStats): string {
	if (stats.errors === 0) return '✅'; // 100% succès
	const errorRate = stats.errors / stats.total;
	return errorRate < 0.1 ? '⚠️' : '❌'; // <10% = partiel, ≥10% = échec
}
```

### Exemple de message (HTML)

```html
✅ ETL Terminé: import-scrutins (AN-17) 📊 Résultats: • Total: 1250 • Insérés: 1180 • Mis à jour: 50
• Ignorés: 10 • Erreurs: 10 • Taux de succès: 99.2%
```

---

## Configuration

### Variables d'environnement

```bash
# .env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

**Obtention** :

- Token : @BotFather sur Telegram (`/newbot`)
- Chat ID : @userinfobot sur Telegram (`/start`)

### Détection des credentials

```typescript
function loadTelegramEnv(): { token: string; chatId: string } | null {
	// Charge .env manuellement (pattern existant du projet)
	// Regex robuste : /^(TELEGRAM_\w+)=["']?(.+?)["']?$/
	// Supporte TELEGRAM_BOT_TOKEN=value ET TELEGRAM_BOT_TOKEN="value"

	if (!token || !chatId) {
		console.warn('⚠️  Telegram credentials not configured.');
		console.warn('   ETL notifications will be skipped.');
		return null;
	}
	return { token, chatId };
}
```

---

## Leçons Apprises

### Code Review (4 suggestions appliquées)

1. **Regex .env** : Ajouter support des valeurs quotées

   ```typescript
   // Avant : /^(TELEGRAM_\w+)=(.+)$/
   // Après : /^(TELEGRAM_\w+)=["']?(.+?)["']?$/
   ```

2. **Compteur d'erreurs** : download-data.ts hardcodait `errors: 0`
   - Implémenté tracking avec `let errors = 0` et `recovered` flag
   - Incrémente uniquement si échec sur toutes les URLs alternatives

3. **Flag --dry-run** : 18 scripts manquaient le paramètre
   - Ajouté `dryRun: process.argv.includes('--dry-run')` partout
   - Garantit cohérence : simulation = pas de notification

4. **Consistency** : Tous les scripts suivent maintenant le même pattern
   - Stats standard ou combinés
   - Options structurées identiques
   - Logs explicites en dry-run

### Patterns découverts

1. **Singleton lazy avec guard** :

   ```typescript
   let telegramLogger: FemtoLogger | null | undefined;
   // null = credentials manquants, undefined = pas encore initialisé

   function getLogger(): FemtoLogger | null {
   	if (telegramLogger !== undefined) return telegramLogger;
   	// ... initialisation ...
   }
   ```

2. **Graceful error handling** :

   ```typescript
   try {
   	await logger.telegram(message);
   	console.log('✅ Telegram notification sent');
   } catch (error) {
   	console.warn('⚠️  Failed to send notification:', error.message);
   	// Script continue normalement
   }
   ```

3. **Stats combinés multi-étapes** :
   - Array.reduce() pour agréger les statistiques
   - additionalInfo pour détailler les sous-totaux
   - Permet notifications riches sans polling

---

## Alternatives Envisagées (Futures)

Si besoin d'évolution :

1. **Discord** : FemtoLogger supporte aussi Discord (même package)
2. **Slack** : Besoin d'un transport custom ou alternative
3. **Base de données** : Ajouter une table `etl_runs` pour historique
4. **Dashboards** : Exposer endpoint `/api/etl/status` pour monitoring web

---

## Références

- **Package** : [@frederictriquet/femtologger v0.1.4](https://www.npmjs.com/package/@frederictriquet/femtologger)
- **GitHub** : https://github.com/frederictriquet/femtologger
- **Documentation** : `docs/features/telegram-notifications.md` (492 lignes)
- **Telegram Bot API** : https://core.telegram.org/bots/api

---

## Tags

`#etl` `#notifications` `#telegram` `#monitoring` `#infrastructure` `#adr`
