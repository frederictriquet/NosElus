# Pattern : CSP avec Nonces Automatiques (SvelteKit)

## Problème

Lors de l'implémentation d'une Content Security Policy (CSP) stricte dans une application SvelteKit, les scripts inline nécessaires à l'hydratation de l'application sont bloqués par la directive `script-src 'self'`.

**Symptômes** :

- Console browser : "Content-Security-Policy : Les paramètres de la page ont empêché l'exécution d'un script intégré"
- L'application ne s'hydrate pas correctement
- Les composants Svelte ne sont pas interactifs

**Mauvaise solution** : Ajouter `'unsafe-inline'` à `script-src` (compromet la sécurité)

## Contexte

Utiliser ce pattern quand :

- Vous implémentez des security headers HTTP dans une app SvelteKit
- Vous voulez une CSP stricte sans `'unsafe-inline'`
- Vous devez permettre les scripts d'hydratation de Svelte tout en bloquant les scripts malveillants

**Framework requis** : SvelteKit (adapter-node ou autres)

## Solution

Configurer la CSP directement dans `svelte.config.js` pour bénéficier de la génération automatique de nonces par SvelteKit.

### Architecture

```
svelte.config.js
  ├─ kit.csp.directives → Configuration CSP
  └─ SvelteKit génère automatiquement :
      ├─ Un nonce unique par requête
      ├─ L'ajoute à tous les scripts d'hydratation
      └─ L'inclut dans le header CSP
```

## Code

### svelte.config.js

```javascript
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),

		// Content Security Policy avec nonces automatiques
		csp: {
			directives: {
				'default-src': ['self'],
				'img-src': [
					'self',
					'https://www.assemblee-nationale.fr',
					'https://www.nosdeputes.fr',
					'https://www.senat.fr',
					'https://www.europarl.europa.eu',
					'data:'
				],
				'style-src': ['self', 'unsafe-inline'], // Requis pour Svelte scoped styles
				'script-src': ['self'], // Nonces ajoutés automatiquement par SvelteKit
				'connect-src': ['self'],
				'font-src': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
```

### Ce qui se passe automatiquement

1. **À chaque requête**, SvelteKit génère un nonce unique (ex: `nonce-abc123xyz`)
2. **Tous les scripts d'hydratation** reçoivent automatiquement cet attribut : `<script nonce="abc123xyz">`
3. **Le header CSP** inclut automatiquement : `script-src 'self' 'nonce-abc123xyz'`

### Autres headers de sécurité (hooks.server.ts)

Les headers non-CSP restent dans `src/hooks.server.ts` :

```typescript
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Headers de sécurité (CSP gérée par svelte.config.js)
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	return response;
};
```

## Avantages

- ✅ **Sécurité maximale** : Pas de `'unsafe-inline'` pour les scripts
- ✅ **Automatique** : Nonces générés et injectés par SvelteKit sans code custom
- ✅ **Unique par requête** : Chaque nonce est régénéré, impossible à deviner
- ✅ **Transparent** : Pas de code à ajouter dans les composants Svelte
- ✅ **Compatible** : Fonctionne avec tous les adapters SvelteKit

## Inconvénients

- ⚠️ `'unsafe-inline'` toujours requis pour `style-src` (limitation Svelte scoped styles)
- ⚠️ Configuration dans svelte.config.js (pas dans hooks.server.ts)
- ⚠️ Tests E2E requis pour valider (tests unitaires ne voient pas les nonces)

## Exemples d'utilisation

- `svelte.config.js:17-34` - Configuration CSP NosElus avec sources d'images officielles
- `src/hooks.server.ts:52-56` - Headers complémentaires (hors CSP)

## Testing

### Tests d'intégration (hooks.server.test.ts)

Les tests unitaires ne peuvent pas tester la CSP (gérée par SvelteKit au runtime) :

```typescript
/**
 * Note: CSP is configured in svelte.config.js with automatic nonce generation.
 * Testing CSP requires E2E tests with the full SvelteKit server running.
 * See tests/e2e/ for CSP verification in a real browser context.
 */
```

### Vérification manuelle

1. Lancer `npm run dev`
2. Ouvrir DevTools > Network > sélectionner une requête HTML
3. Vérifier le header `Content-Security-Policy` contient `script-src 'self' 'nonce-xxx'`
4. Inspecter une balise `<script>` dans le HTML, elle doit avoir `nonce="xxx"`
5. Vérifier l'absence d'erreurs CSP dans la console

## Pièges à éviter

❌ **Ne pas configurer la CSP manuellement dans hooks.server.ts**

```typescript
// ❌ INCORRECT - Conflits avec svelte.config.js
response.headers.set('Content-Security-Policy', '...');
```

❌ **Ne pas utiliser 'unsafe-inline' pour script-src**

```javascript
// ❌ INCORRECT - Compromet la sécurité
'script-src': ['self', 'unsafe-inline']
```

✅ **Laisser SvelteKit gérer les nonces**

```javascript
// ✅ CORRECT
'script-src': ['self'] // Nonces ajoutés automatiquement
```

## Voir aussi

- [SvelteKit CSP Documentation](https://kit.svelte.dev/docs/configuration#csp)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- Standard : `std-security-headers.md` (à créer)
- Documentation projet : `docs/security-headers.md`

## Références externes

- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [CSP Evaluator (Google)](https://csp-evaluator.withgoogle.com/)

## Historique

| Date       | Modification                               |
| ---------- | ------------------------------------------ |
| 2026-02-02 | Création initiale (implémentation NosElus) |
