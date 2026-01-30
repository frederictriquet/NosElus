/**
 * Transform a photo URL to use our proxy for caching and reliability.
 * Only transforms assemblee-nationale.fr URLs.
 */
export function getProxiedPhotoUrl(photoUrl: string | null | undefined): string | null {
	if (!photoUrl) return null;

	// Only proxy assemblee-nationale.fr URLs
	const anPrefix = 'https://www.assemblee-nationale.fr/';
	if (photoUrl.startsWith(anPrefix)) {
		const path = photoUrl.slice(anPrefix.length);
		return `/api/photo/${path}`;
	}

	// Return other URLs as-is (e.g., Sénat)
	return photoUrl;
}
