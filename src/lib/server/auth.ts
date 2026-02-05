import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '$env/dynamic/private';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 heures

/**
 * Vérifie si le mot de passe admin est configuré
 */
export function isAdminPasswordConfigured(): boolean {
	return !!env.ADMIN_PASSWORD;
}

/**
 * Vérifie si le mot de passe fourni correspond au mot de passe admin
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
 * Génère un token de session admin signé
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
 * Vérifie la validité d'un token de session admin
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
