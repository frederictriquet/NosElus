import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '$env/dynamic/private';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 heures

/**
 * Vérifie si le mot de passe admin est configuré.
 *
 * @returns `true` si la variable d'environnement `ADMIN_PASSWORD` est définie et non vide
 *
 * @example
 * ```typescript
 * if (!isAdminPasswordConfigured()) {
 *   return { error: 'Admin non configuré' };
 * }
 * ```
 */
export function isAdminPasswordConfigured(): boolean {
	return !!env.ADMIN_PASSWORD;
}

/**
 * Vérifie si le mot de passe fourni correspond au mot de passe admin.
 *
 * Utilise une comparaison timing-safe via `timingSafeEqual` pour éviter
 * les attaques par timing.
 *
 * @param password - Le mot de passe à vérifier
 * @returns `true` si le mot de passe correspond, `false` sinon
 *
 * @example
 * ```typescript
 * if (verifyAdminPassword(userInput)) {
 *   // Authentification réussie
 * }
 * ```
 */
export function verifyAdminPassword(password: string): boolean {
	const adminPassword = env.ADMIN_PASSWORD;
	if (!adminPassword) return false;

	// Comparaison timing-safe
	const providedBuffer = Buffer.from(password, 'utf-8');
	const expectedBuffer = Buffer.from(adminPassword, 'utf-8');

	if (providedBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Génère un token de session admin signé avec HMAC-SHA256.
 *
 * Le token a le format `{timestamp}.{signature}` où :
 * - `timestamp` : Date.now() en millisecondes
 * - `signature` : HMAC-SHA256 du timestamp avec ADMIN_PASSWORD comme clé
 *
 * @returns Le token de session au format `timestamp.signature`
 * @throws {Error} Si ADMIN_PASSWORD n'est pas configuré
 *
 * @example
 * ```typescript
 * const token = generateAdminSessionToken();
 * cookies.set('admin-session', token, { httpOnly: true, maxAge: 86400 });
 * ```
 */
export function generateAdminSessionToken(): string {
	const adminPassword = env.ADMIN_PASSWORD;
	if (!adminPassword) throw new Error('ADMIN_PASSWORD not configured');

	const timestamp = Date.now().toString();
	const hmac = createHmac('sha256', adminPassword);
	hmac.update(timestamp);
	const signature = hmac.digest('hex');

	return `${timestamp}.${signature}`;
}

/**
 * Vérifie la validité d'un token de session admin.
 *
 * Valide :
 * - Le format du token (`timestamp.signature`)
 * - L'expiration (24h depuis le timestamp)
 * - La signature HMAC avec comparaison timing-safe
 *
 * @param token - Le token de session à vérifier
 * @returns `true` si le token est valide et non expiré, `false` sinon
 *
 * @example
 * ```typescript
 * const token = cookies.get('admin-session');
 * if (verifyAdminSessionToken(token)) {
 *   // Session valide
 * }
 * ```
 */
export function verifyAdminSessionToken(token: string): boolean {
	const adminPassword = env.ADMIN_PASSWORD;
	if (!adminPassword) return false;
	if (!token || typeof token !== 'string') return false;

	const parts = token.split('.');
	if (parts.length !== 2) return false;

	const [timestamp, signature] = parts;
	const timestampNum = parseInt(timestamp, 10);

	// Vérifier l'expiration
	if (Date.now() - timestampNum > SESSION_DURATION_MS) {
		return false;
	}

	// Vérifier la signature
	const hmac = createHmac('sha256', adminPassword);
	hmac.update(timestamp);
	const expectedSignature = hmac.digest('hex');

	const signatureBuffer = Buffer.from(signature, 'utf-8');
	const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

	if (signatureBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return timingSafeEqual(signatureBuffer, expectedBuffer);
}
