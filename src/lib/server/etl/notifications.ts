/**
 * Module de notifications Telegram pour les scripts ETL.
 *
 * Ce module fournit une fonction centralisée `notifyETLComplete()` pour notifier
 * la fin d'exécution de n'importe quel script ETL sur Telegram via FemtoLogger.
 *
 * Fonctionnalités clés :
 * - Singleton lazy : Logger initialisé une seule fois au premier appel
 * - Graceful degradation : Credentials manquants → warning, pas crash
 * - Respect --dry-run : Aucune notification envoyée en mode dry-run
 * - Error handling : Échec de notification ne crashe pas l'ETL
 * - Formatage riche HTML : Emojis contextuels + stats détaillées
 *
 * @example
 * ```typescript
 * import { notifyETLComplete } from './notifications.js';
 *
 * const stats = await importActors(config);
 * await notifyETLComplete('import-actors', stats, {
 *   dryRun: config.dryRun,
 *   legislature: config.legislature
 * });
 * ```
 *
 * @see {@link https://github.com/frederictriquet/FemtoLogger} FemtoLogger
 * @see {@link file://./.serena/memories/adr-2026-02-07-femtologger-etl-notifications.md} ADR-008
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ImportStats } from './types.js';
import { FemtoLogger, TelegramTransport } from '@frederictriquet/femtologger';

/**
 * Charge les variables Telegram depuis .env si elles ne sont pas déjà dans l'environnement.
 * Parsing minimal : supporte KEY=VALUE et ignore les commentaires (#) et lignes vides.
 */
function loadTelegramEnv(): void {
	if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) return;

	try {
		const envPath = resolve(process.cwd(), '.env');
		const content = readFileSync(envPath, 'utf-8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const match = trimmed.match(/^(TELEGRAM_\w+)=["']?(.+?)["']?$/);
			if (match) {
				const [, key, value] = match;
				if (!process.env[key]) {
					process.env[key] = value;
				}
			}
		}
	} catch {
		// .env non trouvé ou illisible → pas grave, on continue
	}
}

/**
 * Instance singleton du logger Telegram.
 * Utilise undefined pour différencier "non initialisé" de "initialisé à null".
 */
let loggerInstance: FemtoLogger | null | undefined = undefined;

/**
 * Initialise et retourne le logger Telegram (singleton lazy).
 *
 * Le logger est créé au premier appel et réutilisé ensuite.
 * Si les credentials sont absents, retourne null et log un warning.
 *
 * @returns Logger Telegram ou null si credentials manquants
 *
 * @example
 * ```typescript
 * const logger = getLogger();
 * if (logger) {
 *   await logger.info('Message', { data });
 * }
 * ```
 */
function getLogger(): FemtoLogger | null {
	// Si déjà initialisé (null ou instance), retourner directement
	if (loggerInstance !== undefined) {
		return loggerInstance;
	}

	// Charger .env si nécessaire, puis lire les credentials
	loadTelegramEnv();
	const token = process.env.TELEGRAM_BOT_TOKEN;
	const chatId = process.env.TELEGRAM_CHAT_ID;

	// Credentials manquants → warning, pas d'erreur
	if (!token || !chatId) {
		console.warn(
			'⚠️  Telegram credentials not configured (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing).'
		);
		console.warn('   ETL notifications will be skipped. See .env.example for setup instructions.');
		loggerInstance = null;
		return null;
	}

	// Initialiser le logger Telegram
	try {
		loggerInstance = new FemtoLogger({
			transports: [
				new TelegramTransport({
					token,
					chatId,
					parseMode: 'HTML'
				})
			]
		});
		return loggerInstance;
	} catch (err) {
		console.error('❌ Failed to initialize Telegram logger:', err);
		loggerInstance = null;
		return null;
	}
}

/**
 * Options pour la notification ETL.
 */
interface NotifyOptions {
	/** Si true, simule l'envoi sans envoyer réellement (mode dry-run) */
	dryRun?: boolean;
	/** Legislature concernée (ex: "AN-17", "PE-10") pour contexte */
	legislature?: string;
	/** Informations additionnelles à inclure dans les métadonnées */
	additionalInfo?: Record<string, unknown>;
}

/**
 * Notifie la fin d'un ETL sur Telegram avec statistiques formatées.
 *
 * Cette fonction :
 * - Respecte le flag --dry-run (aucune notification envoyée si dryRun=true)
 * - Gère gracieusement les credentials manquants (warning, pas crash)
 * - Ne crashe PAS l'ETL en cas d'erreur d'envoi (log warning uniquement)
 * - Formate le message avec emoji contextuel selon le taux de succès
 * - Inclut les stats détaillées (total, inserted, updated, skipped, errors)
 *
 * @param scriptName - Nom du script ETL (ex: "import-actors")
 * @param stats - Statistiques d'import retournées par l'ETL
 * @param options - Options d'exécution (dryRun, legislature, etc.)
 *
 * @example
 * ```typescript
 * // Usage basique
 * await notifyETLComplete('import-actors', actorsStats);
 *
 * // Avec options
 * await notifyETLComplete('import-actors', actorsStats, {
 *   dryRun: process.argv.includes('--dry-run'),
 *   legislature: 'AN-17',
 *   additionalInfo: { duration: '45s' }
 * });
 * ```
 */
export async function notifyETLComplete(
	scriptName: string,
	stats: ImportStats,
	options: NotifyOptions = {}
): Promise<void> {
	// Respect du flag --dry-run : aucune notification envoyée
	if (options.dryRun) {
		console.log(`[DRY-RUN] Would send Telegram notification for: ${scriptName}`);
		console.log(`[DRY-RUN] Stats: ${JSON.stringify(stats)}`);
		return;
	}

	// Récupérer le logger (peut être null si credentials manquants)
	const logger = getLogger();
	if (!logger) {
		// Credentials non configurés → skip silencieusement
		// Warning déjà loggé par getLogger()
		return;
	}

	try {
		// Calcul du taux de succès
		const successRate =
			stats.total > 0 ? (((stats.total - stats.errors) / stats.total) * 100).toFixed(1) : '100.0';

		// Emoji contextuel selon taux de succès
		const emoji = getStatusEmoji(stats);

		// Legislature info (optionnel)
		const legislatureInfo = options.legislature ? ` (${options.legislature})` : '';

		// Formatage du message avec emojis (sans tableau HTML)
		const lines: string[] = [`${emoji} <b>ETL Terminé</b>: ${scriptName}${legislatureInfo}`];
		lines.push('');
		lines.push(`📊 <b>${stats.total}</b> traités`);
		if (stats.inserted > 0) lines.push(`  ✏️ ${stats.inserted} insérés`);
		if (stats.updated > 0) lines.push(`  🔄 ${stats.updated} mis à jour`);
		if (stats.skipped > 0) lines.push(`  ⏭️ ${stats.skipped} ignorés`);
		if (stats.errors > 0) lines.push(`  ❌ ${stats.errors} erreurs`);
		lines.push(`  📈 ${successRate}% succès`);

		const message = lines.join('\n');

		// Métadonnées pour le logger
		const metadata = {
			script: scriptName,
			legislature: options.legislature,
			...stats,
			...options.additionalInfo
		};

		// Envoi de la notification
		// await logger.info(message, metadata);
		await logger.info(message);

		console.log('✓ Telegram notification sent successfully');
	} catch (err) {
		// Échec de notification ne doit PAS crasher l'ETL
		console.warn('⚠️  Failed to send Telegram notification:', err);
		// On continue l'exécution du script normalement
	}
}

/**
 * Détermine l'emoji approprié selon le taux de succès.
 *
 * - ✅ Succès total (0 erreurs)
 * - ⚠️ Succès partiel (< 10% d'erreurs)
 * - ❌ Échec significatif (≥ 10% d'erreurs)
 *
 * @param stats - Statistiques d'import
 * @returns Emoji contextuel
 */
function getStatusEmoji(stats: ImportStats): string {
	if (stats.errors === 0) {
		return '✅'; // Succès total
	}

	const errorRate = stats.total > 0 ? stats.errors / stats.total : 0;

	if (errorRate < 0.1) {
		return '⚠️'; // Succès partiel (< 10% d'erreurs)
	}

	return '❌'; // Échec significatif (≥ 10% d'erreurs)
}
