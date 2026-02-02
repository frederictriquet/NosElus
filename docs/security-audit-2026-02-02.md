# Rapport d'Audit de Sécurité Statique - NosElus

**Date**: 2026-02-02
**Scope**: Analyse statique du code source
**Type**: Audit défensif (pas de pentest actif)

---

## Résumé Exécutif

| Catégorie | Sévérité | Findings |
|-----------|----------|----------|
| Dépendances | Moyenne | 11 vulnérabilités npm |
| Injection SQL | Faible | Aucune (Drizzle ORM protège) |
| XSS | Faible | Aucun @html/innerHTML détecté |
| Headers Sécurité | Moyenne | Absents |
| Validation Entrées | Faible | Quelques améliorations possibles |
| Secrets | OK | Pas d'exposition détectée |

---

## 1. Vulnérabilités des Dépendances (npm audit)

### Trouvées: 11 vulnérabilités

| Package | Sévérité | Problème |
|---------|----------|----------|
| cookie <0.7.0 | Moyenne | Accepte certains caractères invalides |
| esbuild <=0.24.2 | Moyenne | Vulnérabilités non spécifiées |

### Recommandation
Ces vulnérabilités sont dans des dépendances transitives (vite, esbuild). Une mise à jour pourrait nécessiter des changements breaking. À surveiller lors des mises à jour majeures.

---

## 2. Injection SQL

### Analyse

L'application utilise **Drizzle ORM** qui paramétrise automatiquement les requêtes via les template literals `sql\`...\``.

**Exemple de code sécurisé trouvé** (`src/routes/api/v1/search/+server.ts:33`):
```typescript
.where(or(ilike(actors.fullName, searchTerm), ilike(actors.lastName, searchTerm)))
```

### Points d'attention

1. **Template literals SQL** - Quelques utilisations de `sql\`...\`` avec interpolation:
   - `src/routes/an/compare/+page.server.ts:152`
   - `src/routes/pe/eurodeputes/compare/+page.server.ts:144`

   Ces utilisations sont sûres car les variables interpolées sont des IDs validés en amont.

2. **LIKE pattern escaping** (`src/routes/api/v1/search/+server.ts:16`):
   ```typescript
   const searchTerm = `%${query}%`;
   ```
   Les caractères `%` et `_` dans `query` ne sont pas échappés. Ce n'est pas une vulnérabilité SQL mais peut causer des résultats de recherche inattendus.

### Verdict: **Sécurisé** - Pas d'injection SQL possible

---

## 3. Cross-Site Scripting (XSS)

### Analyse

- Aucune utilisation de `@html` dans les composants Svelte
- Aucune utilisation de `innerHTML` dans le code
- SvelteKit échappe automatiquement les données affichées

### Verdict: **Sécurisé** - Protection XSS native de Svelte

---

## 4. Headers de Sécurité

### Analyse (`src/hooks.server.ts`)

Le hook handle ne configure **aucun header de sécurité**.

### Headers manquants recommandés

```typescript
// À ajouter dans hooks.server.ts
const response = await resolve(event);
response.headers.set('X-Frame-Options', 'DENY');
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
response.headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' https://www.assemblee-nationale.fr");
```

### Sévérité: **Moyenne** - À implémenter

---

## 5. Validation des Entrées

### URL Parameters

| Pattern | Fichiers | Status |
|---------|----------|--------|
| IDs (params.id) | 12 fichiers | OK - Utilisés dans requêtes paramétrées |
| page/limit | 8 fichiers | OK - parseInt + Math.min/max |
| dates | 5 fichiers | OK - Format string, pas d'exécution |
| search query | 4 fichiers | OK - Passé à ILIKE |

### Route Photo Proxy (`/api/photo/[...path]`)

**Protections en place**:
1. Whitelist de préfixes autorisés: `dyn/` et `tribun/`
2. Sanitisation du nom de fichier cache: `replace(/[^a-zA-Z0-9.-]/g, '_')`
3. Destination fixe: `https://www.assemblee-nationale.fr/`

### Verdict: **Acceptable** - Validation basique mais suffisante

---

## 6. Gestion des Secrets

### Variables d'environnement

| Variable | Usage | Exposition |
|----------|-------|------------|
| DATABASE_URL | Connexion DB | Côté serveur uniquement |
| ETL_* | Scripts d'import | Côté serveur uniquement |

### Fichiers de configuration

- `.env.example` existe avec des valeurs par défaut sûres
- `.gitignore` exclut correctement `.env`
- Pas de secrets hardcodés dans le code

### Verdict: **Sécurisé**

---

## 7. Authentification & CORS

### Authentification

L'application est **publique** (données ouvertes) - pas d'authentification utilisateur.

### CORS

- Pas de configuration CORS explicite
- SvelteKit applique par défaut une politique restrictive (same-origin)
- Les API `/api/v1/*` ne définissent pas de headers CORS → accès depuis le même domaine uniquement

### Verdict: **Acceptable** pour une application publique

---

## 8. Rate Limiting

### Analyse

**Aucun rate limiting détecté** sur les routes API.

### Routes exposées sans protection

- `/api/v1/search` - Recherche (potentiel abus)
- `/api/v1/actors` - Liste des acteurs
- `/api/v1/scrutins` - Liste des scrutins
- `/api/photo/*` - Proxy photos (pourrait être abusé)

### Recommandation

Implémenter un rate limiting basique, par exemple:
- 100 requêtes/minute pour la recherche
- 1000 requêtes/minute pour les API de lecture

### Sévérité: **Faible** - À considérer pour la production

---

## 9. Recommandations Prioritaires

### Priorité Haute

1. **Ajouter les security headers** dans `hooks.server.ts`

### Priorité Moyenne

2. **Surveiller les mises à jour npm** pour les vulnérabilités des dépendances
3. **Échapper les caractères LIKE** (`%`, `_`) dans les recherches

### Priorité Basse

4. **Implémenter un rate limiting** sur les API publiques
5. **Ajouter des logs de sécurité** pour détecter les abus

---

## Conclusion

L'application NosElus présente un **niveau de sécurité acceptable** pour une application de données publiques. Les principales protections sont en place grâce à:

- L'utilisation de Drizzle ORM (protection SQL injection)
- Le framework Svelte (protection XSS)
- Une validation basique des entrées

Les points d'amélioration concernent principalement:
- L'ajout de security headers HTTP
- La surveillance des dépendances vulnérables
- Un éventuel rate limiting en production

**Score global**: 7/10 - Bon niveau pour une app publique, quelques hardening à faire.
