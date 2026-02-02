# Standard : Security Headers HTTP

## Catégorie
Security

## Règle

**Toute application web DOIT implémenter les 4 headers de sécurité HTTP essentiels** :

1. `X-Frame-Options: DENY` (anti-clickjacking)
2. `X-Content-Type-Options: nosniff` (anti-MIME sniffing)
3. `Referrer-Policy: strict-origin-when-cross-origin` (vie privée)
4. `Content-Security-Policy` (anti-XSS, injection de contenu)

## Justification

### Menaces protégées

| Header | Protection | Impact sans |
|--------|-----------|-------------|
| X-Frame-Options | **Clickjacking** : Empêche l'app d'être embarquée dans une iframe malveillante | Utilisateurs trompés, actions non intentionnelles |
| X-Content-Type-Options | **MIME sniffing** : Force le respect du Content-Type déclaré | Scripts malveillants exécutés via fichiers déguisés |
| Referrer-Policy | **Fuite d'info** : Contrôle les URLs envoyées aux sites externes | URLs complètes avec tokens/IDs exposées |
| Content-Security-Policy | **XSS, injection** : Contrôle strict des sources de contenu autorisées | Scripts malveillants, vol de données |

### Score de sécurité

- **Sans headers** : ~5/10 (vulnérabilités critiques)
- **Avec headers** : ~8.5/10 (protection robuste)

## Exemples

### ✅ Correct - SvelteKit

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  
  // Headers de sécurité essentiels
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CSP configurée dans svelte.config.js (voir pattern-sveltekit-csp-nonces.md)
  
  return response;
};
```

```javascript
// svelte.config.js
const config = {
  kit: {
    csp: {
      directives: {
        'default-src': ['self'],
        'script-src': ['self'], // Nonces automatiques
        'style-src': ['self', 'unsafe-inline'], // Requis Svelte
        'img-src': ['self', 'data:', /* sources officielles */],
        'frame-ancestors': ['none']
      }
    }
  }
};
```

### ✅ Correct - Express.js

```javascript
// app.js
const helmet = require('helmet');

app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.noSniff());
app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", "data:"],
    frameAncestors: ["'none'"]
  }
}));
```

### ❌ Incorrect - Headers manquants

```typescript
// ❌ INCORRECT - Aucun header de sécurité
export const handle: Handle = async ({ event, resolve }) => {
  return await resolve(event);
};
```

### ❌ Incorrect - CSP permissive

```typescript
// ❌ INCORRECT - CSP trop permissive
response.headers.set('Content-Security-Policy', 
  "default-src *; script-src * 'unsafe-inline' 'unsafe-eval';"
);
// → Permet tout, ne protège contre rien
```

## Configuration par Framework

### SvelteKit

- **Headers standards** : `src/hooks.server.ts`
- **CSP avec nonces** : `svelte.config.js` (pattern-sveltekit-csp-nonces.md)

### Next.js

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; ..." }
      ]
    }];
  }
};
```

### Nuxt.js

```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  }
});
```

## Directives CSP Recommandées

### Base minimale (restrictive)

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
frame-ancestors 'none';
```

### Avec sources externes (exemple)

```
default-src 'self';
script-src 'self' 'nonce-{random}';
style-src 'self' 'unsafe-inline'; // Si framework CSS-in-JS
img-src 'self' data: https://trusted-cdn.com;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://api.example.com;
frame-ancestors 'none';
```

## Exceptions

### Cas où X-Frame-Options peut être SAMEORIGIN

Si l'application doit être embarquée dans une iframe **du même domaine** :

```typescript
response.headers.set('X-Frame-Options', 'SAMEORIGIN');
// ET
csp: { directives: { 'frame-ancestors': ['self'] } }
```

**Exemple** : Dashboard admin embarqué dans une autre page admin du même site.

### Cas où unsafe-inline est acceptable

- **style-src 'unsafe-inline'** : Frameworks avec styles scopés (Svelte, Vue, styled-components)
- **script-src 'unsafe-inline'** : ❌ **JAMAIS acceptable** (utiliser nonces ou hashes)

## Vérification

### 1. Tests automatisés

```typescript
// src/hooks.server.test.ts
describe('Security Headers', () => {
  it('should set X-Frame-Options', async () => {
    const response = await handle({ event, resolve });
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });
  
  it('should set X-Content-Type-Options', async () => {
    const response = await handle({ event, resolve });
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
  
  it('should set Referrer-Policy', async () => {
    const response = await handle({ event, resolve });
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
  
  // CSP testée en E2E (voir pattern-sveltekit-csp-nonces.md)
});
```

### 2. Vérification manuelle

**DevTools** (Chrome/Firefox) :
1. Network > sélectionner requête HTML
2. Onglet Headers
3. Vérifier présence des 4 headers

**Console** :
- Aucune erreur "CSP violation"
- Toutes les ressources se chargent

### 3. Outils externes

- [SecurityHeaders.com](https://securityheaders.com) - Scanner en ligne
- [CSP Evaluator](https://csp-evaluator.withgoogle.com) - Validation CSP
- [Mozilla Observatory](https://observatory.mozilla.org) - Audit complet

## Checklist de Review

Lors de la revue de code, vérifier :

- [ ] Les 4 headers essentiels sont présents
- [ ] CSP configurée (pas de wildcard `*` ni `unsafe-inline` pour scripts)
- [ ] Tests automatisés pour les headers standards
- [ ] Documentation des sources externes whitelistées avec justification
- [ ] Aucune erreur CSP en console lors des tests manuels

## Date d'adoption
2026-02-02

## Impact sur les Projets Existants

### Nouveau projet
✅ Implémenter dès le début (coût : ~1h)

### Projet existant
⚠️ Tester en staging avant prod :
1. Implémenter les headers
2. Tester toutes les pages/features
3. Vérifier analytics/CDN externes fonctionnent
4. Ajuster whitelist CSP si nécessaire
5. Déployer en prod

**Risque** : Fonctionnalités cassées si CSP trop stricte (ex: analytics bloqués)

## Références

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- Pattern : `pattern-sveltekit-csp-nonces.md`
- Audit projet : `docs/security-audit-2026-02-02.md`
- Documentation : `docs/security-headers.md`

## Historique

| Date | Modification |
|------|--------------|
| 2026-02-02 | Création standard (implémentation NosElus) |
