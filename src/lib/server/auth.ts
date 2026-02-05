import { createHmac, timingSafeEqual } from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 heures

/**
 * Vérifie si le mot de passe admin est configuré
 */
export function isAdminPasswordConfigured(): boolean {
	return !!ADMIN_PASSWORD && ADMIN_PASSWORD.length >= 8;
}

/**
 * Vérifie si le mot de passe fourni correspond au mot de passe admin
 */
export function verifyAdminPassword(password: string): boolean {
	if (!ADMIN_PASSWORD) return false;

	// Comparaison timing-safe
	const providedBuffer = Buffer.from(password, 'utf-8');
	const expectedBuffer = Buffer.from(ADMIN_PASSWORD, 'utf-8');

	if (providedBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Génère un token de session admin signé
 */
export function generateAdminSessionToken(): string {
	if (!ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD not configured');

	const timestamp = Date.now().toString();
	const hmac = createHmac('sha256', ADMIN_PASSWORD);
	hmac.update(timestamp);
	const signature = hmac.digest('hex');

	return `${timestamp}.${signature}`;
}

/**
 * Vérifie la validité d'un token de session admin
 */
export function verifyAdminSessionToken(token: string): boolean {
	if (!ADMIN_PASSWORD) return false;
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
	const hmac = createHmac('sha256', ADMIN_PASSWORD);
	hmac.update(timestamp);
	const expectedSignature = hmac.digest('hex');

	const signatureBuffer = Buffer.from(signature, 'utf-8');
	const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

	if (signatureBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return timingSafeEqual(signatureBuffer, expectedBuffer);
}
