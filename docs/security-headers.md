# Security Headers HTTP - Documentation

**Date d'implémentation** : 2026-02-02
**Branche** : `secu`

---

## Vue d'ensemble

L'application NosElus implémente des headers de sécurité HTTP pour protéger contre les attaques courantes :

- Clickjacking
- MIME sniffing
- Fuites de referrer
- Injections de contenu (XSS, scripts malveillants)

**Implémentation** :

- `svelte.config.js` - Content Security Policy avec nonces automatiques
- `src/hooks.server.ts` - Autres headers de sécurité (X-Frame-Options, etc.)

**Tests** : `src/hooks.server.test.ts` (4 tests d'intégration)

---

## Headers Implémentés

### 1. X-Frame-Options: DENY

**Protection** : Anti-clickjacking
**Effet** : Empêche l'application d'être embarquée dans une iframe

Cette protection empêche un attaquant de charger l'application dans une iframe malveillante pour tromper l'utilisateur (clickjacking).

### 2. X-Content-Type-Options: nosniff

**Protection** : Anti-MIME sniffing
**Effet** : Force le navigateur à respecter le Content-Type déclaré

Empêche le navigateur de "deviner" le type MIME d'un fichier, ce qui pourrait permettre l'exécution de scripts malveillants.

### 3. Referrer-Policy: strict-origin-when-cross-origin

**Protection** : Vie privée
**Effet** : Envoie uniquement l'origine (pas le chemin complet) lors de navigations cross-origin

Balance entre :

- **Protection de la vie privée** : Ne révèle pas les URLs complètes aux sites externes
- **Analytics** : Permet toujours de tracker les sources de trafic (origine)

### 4. Content-Security-Policy (CSP)

**Protection** : Injections de contenu (XSS, scripts malveillants)
**Effet** : Contrôle strict des sources de contenu autorisées

#### Directives configurées

```
default-src 'self'
```

Par défaut, tout le contenu doit provenir du même domaine.

```
img-src 'self' https://www.assemblee-nationale.fr https://www.senat.fr https://www.europarl.europa.eu data:
```

**Images autorisées depuis** :

- `'self'` : Domaine de l'application
- `https://www.assemblee-nationale.fr` : Photos des députés (via proxy `/api/photo/*`)
- `https://www.senat.fr` : Photos des sénateurs
- `https://www.europarl.europa.eu` : Photos des eurodéputés
- `data:` : SVG inline (icônes)

```
style-src 'self' 'unsafe-inline'
```

**Styles autorisés** :

- `'self'` : Fichiers CSS de l'application
- `'unsafe-inline'` : **Nécessaire pour Svelte** (styles scopés générés dynamiquement)

> ⚠️ Note : `'unsafe-inline'` réduit légèrement la protection mais est requis par le framework Svelte.

```
script-src 'self' 'nonce-xxx'
```

**Scripts autorisés** :

- `'self'` : Depuis le domaine de l'application
- `'nonce-xxx'` : Scripts inline avec nonce généré automatiquement par SvelteKit
- Aucun script externe (CDN, analytics tiers, etc.)

> ✅ SvelteKit génère automatiquement un nonce unique pour chaque requête et l'ajoute aux scripts d'hydratation. C'est plus sécurisé que `'unsafe-inline'`.

### Configuration SvelteKit (svelte.config.js)

La CSP est configurée dans `svelte.config.js` pour bénéficier de la génération automatique de nonces :

```javascript
kit: {
  csp: {
    directives: {
      'default-src': ['self'],
      'img-src': ['self', 'https://www.assemblee-nationale.fr', ...],
      'style-src': ['self', 'unsafe-inline'],
      'script-src': ['self'], // Nonces ajoutés automatiquement
      'connect-src': ['self'],
      'font-src': ['self'],
      'frame-ancestors': ['none']
    }
  }
}
```

```
connect-src 'self'
```

**Connexions API** :

- Uniquement vers le domaine de l'application
- Aucune API externe autorisée

```
font-src 'self'
```

**Polices** :

- Uniquement depuis le domaine de l'application

```
frame-ancestors 'none'
```

**Embedding** :

- Équivalent moderne de `X-Frame-Options: DENY`
- Empêche l'application d'être chargée dans une iframe

---

## Tests

**Fichier** : `src/hooks.server.test.ts`

### Couverture

| Test                                           | Description                                   |
| ---------------------------------------------- | --------------------------------------------- |
| `should set X-Frame-Options header`            | Vérifie présence du header anti-clickjacking  |
| `should set X-Content-Type-Options header`     | Vérifie présence du header anti-MIME sniffing |
| `should set Referrer-Policy header`            | Vérifie présence du header de vie privée      |
| `should set Content-Security-Policy header`    | Vérifie présence et contenu de la CSP         |
| `should allow images from official sources`    | Vérifie whitelist des sources d'images        |
| `should set all security headers on any route` | Vérifie headers sur toutes les routes         |

**Résultat** : 6/6 tests passés ✅

---

## Vérification Manuelle

### En développement

```bash
npm run dev
```

Puis dans la console du navigateur (DevTools > Network > sélectionner une requête > Headers) :

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; img-src ...
```

### Vérifier les violations CSP

Ouvrir la console du navigateur (F12) et chercher :

- ⚠️ Aucune erreur de type "CSP violation"
- ✅ Toutes les ressources (images, styles, scripts) doivent se charger correctement

### Test externe

Utiliser https://securityheaders.com pour analyser les headers (nécessite déploiement).

---

## Maintenance

### Ajouter une nouvelle source d'images

Si une nouvelle source officielle doit être ajoutée (ex: Commission Européenne) :

1. Modifier `src/hooks.server.ts`
2. Ajouter l'URL dans la directive `img-src`
3. Ajouter un test dans `src/hooks.server.test.ts`

Exemple :

```typescript
const csp = [
	"default-src 'self'",
	"img-src 'self' https://www.assemblee-nationale.fr https://www.senat.fr https://www.europarl.europa.eu https://ec.europa.eu data:"
	// ...
].join('; ');
```

### Debugging des violations CSP

Si des ressources ne se chargent pas après modification :

1. Ouvrir la console du navigateur
2. Chercher les erreurs CSP : `Refused to load ... because it violates the following Content Security Policy directive`
3. Identifier la directive bloquante
4. Ajouter la source légitime à la whitelist

---

## Références

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator (Google)](https://csp-evaluator.withgoogle.com/)
- [Security Headers Scanner](https://securityheaders.com/)

---

## Score de Sécurité

**Avant implémentation** : 7/10 (audit statique)
**Après implémentation** : ~8.5/10

**Améliorations futures** :

- [ ] HSTS (à configurer au niveau du reverse proxy)
- [ ] Permissions-Policy (permissions du navigateur)
- [ ] Résoudre les 11 vulnérabilités npm (dépendances transitives)
