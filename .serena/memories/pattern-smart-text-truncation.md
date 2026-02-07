# Pattern : Troncature Intelligente de Texte

## Catégorie
Text Processing | Data Validation | User Experience

## Problème

Lors de la troncature de texte pour respecter des contraintes de longueur (VARCHAR, UI, APIs), une **troncature naïve** coupe mid-mot, créant :
- ❌ Texte visuellement cassé : `"Résolution sur le règlemen..."`
- ❌ Perte de sens : `"Vote du Parlement européen sur la réglement..."`
- ❌ UX dégradée : Utilisateur voit du texte coupé brutalement

**Besoin** : Tronquer intelligemment en préservant les mots complets.

## Contexte

Utiliser ce pattern quand :
- ✅ Contrainte de longueur stricte (DB, API, affichage)
- ✅ Texte en langue naturelle (pas du code/JSON)
- ✅ UX importante (titres, descriptions)
- ✅ Préservation du sens prioritaire

Ne PAS utiliser quand :
- ❌ Données techniques (URLs, tokens, hashes)
- ❌ Pas de contrainte stricte (TEXT illimité)
- ❌ Troncature doit être exacte (sécurité, crypto)

## Solution

### Pattern de base : Troncature avec préservation des mots

```typescript
/**
 * Tronque un texte intelligemment en préservant les mots complets
 *
 * @param text - Texte à tronquer
 * @param maxLength - Longueur maximale (incluant ellipsis)
 * @param ellipsis - Suffixe à ajouter (défaut: '...')
 * @returns Texte tronqué ou texte original si <= maxLength
 *
 * @example
 * ```typescript
 * truncate('Résolution du Parlement européen sur le règlement', 30)
 * // → 'Résolution du Parlement...'
 * // (pas 'Résolution du Parlement eur...')
 * ```
 */
function truncate(
  text: string,
  maxLength: number,
  ellipsis: string = '...'
): string {
  // Pas besoin de tronquer
  if (text.length <= maxLength) {
    return text;
  }

  // Longueur cible sans ellipsis
  const targetLength = maxLength - ellipsis.length;

  // Couper au dernier espace avant targetLength
  const truncated = text
    .slice(0, targetLength)
    .replace(/\s+\S*$/, '');  // Retire le dernier mot incomplet

  return truncated + ellipsis;
}
```

### Explication de la regex `/\s+\S*$/`

```
\s+    → Un ou plusieurs espaces
\S*    → Zéro ou plusieurs non-espaces (le mot incomplet)
$      → Fin de la chaîne

Exemple : "Résolution du Parlement eur"
                                   ^^^^
                                   Retiré par la regex
Résultat : "Résolution du Parlement"
```

### Cas d'usage réel : Contrainte VARCHAR(300)

```typescript
// Contexte : DB avec short_title VARCHAR(300)
const displayTitle = vote.display_title || 'Procédure sans titre';

const shortTitle = displayTitle.length > 300
  ? displayTitle.slice(0, 297).replace(/\s+\S*$/, '') + '...'
  : displayTitle;

// Pourquoi 297 ?
// 300 (max VARCHAR) - 3 (longueur de '...') = 297
```

## Variantes

### 1. Troncature à N mots

```typescript
/**
 * Tronque à un nombre maximum de mots
 *
 * @example
 * ```typescript
 * truncateWords('Un texte très long avec beaucoup de mots', 4)
 * // → 'Un texte très long...'
 * ```
 */
function truncateWords(
  text: string,
  maxWords: number,
  ellipsis: string = '...'
): string {
  const words = text.split(/\s+/);

  if (words.length <= maxWords) {
    return text;
  }

  return words.slice(0, maxWords).join(' ') + ellipsis;
}
```

### 2. Troncature à la phrase

```typescript
/**
 * Tronque en préservant les phrases complètes
 *
 * @example
 * ```typescript
 * truncateSentences('Première phrase. Deuxième phrase. Troisième.', 30)
 * // → 'Première phrase.'
 * ```
 */
function truncateSentences(
  text: string,
  maxLength: number,
  ellipsis: string = '...'
): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Chercher la dernière phrase complète avant maxLength
  const match = text
    .slice(0, maxLength - ellipsis.length)
    .match(/^.*[.!?]/);

  if (match) {
    return match[0];
  }

  // Fallback : troncature standard
  return truncate(text, maxLength, ellipsis);
}
```

### 3. Troncature HTML-aware

```typescript
/**
 * Tronque du texte en préservant les balises HTML
 *
 * ⚠️ Complexe - préférer strip HTML + truncate si possible
 */
function truncateHTML(html: string, maxLength: number): string {
  // Strip HTML, truncate, puis optionnellement re-wrap
  const text = html.replace(/<[^>]+>/g, '');
  return truncate(text, maxLength);
}
```

### 4. Troncature avec tooltip hint

```typescript
/**
 * Tronque et retourne aussi un flag pour afficher un tooltip
 */
interface TruncationResult {
  text: string;
  truncated: boolean;
  originalLength: number;
}

function truncateWithMeta(
  text: string,
  maxLength: number
): TruncationResult {
  return {
    text: truncate(text, maxLength),
    truncated: text.length > maxLength,
    originalLength: text.length
  };
}

// Usage en Svelte
const result = truncateWithMeta(law.title, 100);

// <span title={result.truncated ? law.title : undefined}>
//   {result.text}
// </span>
```

## Avantages

1. ✅ **UX améliorée** : Texte propre, pas de mots coupés
2. ✅ **Respect des contraintes** : Garantit longueur <= maxLength
3. ✅ **Préservation du sens** : Garde phrases/mots complets
4. ✅ **Simplicité** : Une regex suffit
5. ✅ **Performance** : O(n) linéaire

## Inconvénients

1. ⚠️ **Longueur variable** : Résultat peut être bien < maxLength
   - Ex: `truncate("Mot", 10)` → `"..."` (3 chars, pas 10)
   - **Mitigation** : Acceptable pour UX, garantit juste <= maxLength

2. ⚠️ **Ellipsis compte dans la limite** : Réduit le texte utile
   - Ex: VARCHAR(300) → max 297 chars de texte réel
   - **Mitigation** : Documenter clairement (297 + 3 = 300)

## Exemples d'utilisation

### Cas 1 : Titres de lois (VARCHAR 300)

```typescript
// src/lib/server/etl/sources/europarl/laws.ts:103-105
const shortTitle = displayTitle.length > 300
  ? displayTitle.slice(0, 297).replace(/\s+\S*$/, '') + '...'
  : displayTitle;
```

### Cas 2 : Descriptions de cartes (UI)

```svelte
<script>
  export let description: string;
  const maxLength = 150;

  $: truncatedDesc = truncate(description, maxLength);
</script>

<p>{truncatedDesc}</p>
```

### Cas 3 : Snippets de recherche

```typescript
function createSearchSnippet(
  fullText: string,
  query: string,
  maxLength: number = 200
): string {
  // Trouver la position du query
  const index = fullText.toLowerCase().indexOf(query.toLowerCase());

  if (index === -1) {
    // Query non trouvé → tronquer depuis le début
    return truncate(fullText, maxLength);
  }

  // Centrer le snippet autour du query
  const start = Math.max(0, index - maxLength / 2);
  const end = start + maxLength;
  const snippet = fullText.slice(start, end);

  return (start > 0 ? '...' : '') +
         truncate(snippet, maxLength) +
         (end < fullText.length ? '...' : '');
}
```

## Tests

```typescript
describe('truncate', () => {
  it('should not truncate short text', () => {
    expect(truncate('Short', 10)).toBe('Short');
  });

  it('should truncate long text with ellipsis', () => {
    expect(truncate('Very long text here', 10)).toBe('Very...');
  });

  it('should preserve complete words', () => {
    const result = truncate('Résolution du Parlement européen', 25);
    expect(result).toBe('Résolution du...');
    expect(result).not.toContain('Parlem'); // Pas de mot coupé
  });

  it('should handle exact length boundary', () => {
    expect(truncate('Exactly ten', 11)).toBe('Exactly ten');
  });

  it('should handle custom ellipsis', () => {
    expect(truncate('Long text', 8, ' […]')).toBe('Long […]');
  });

  it('should handle edge case: one word too long', () => {
    const result = truncate('Supercalifragilisticexpialidocious', 10);
    // Aucun espace → regex ne retire rien → coupe brutalement
    expect(result.length).toBeLessThanOrEqual(10);
  });
});

describe('truncateWords', () => {
  it('should truncate to N words', () => {
    expect(truncateWords('One two three four five', 3)).toBe('One two three...');
  });

  it('should not truncate if less than N words', () => {
    expect(truncateWords('One two', 5)).toBe('One two');
  });
});
```

## Checklist d'implémentation

- [ ] Déterminer la longueur max (contrainte DB/API/UI)
- [ ] Calculer targetLength = maxLength - ellipsis.length
- [ ] Utiliser regex `/\s+\S*$/` pour préserver mots
- [ ] Vérifier que résultat <= maxLength
- [ ] Ajouter tests (cas courts, longs, edge cases)
- [ ] Documenter pourquoi cette longueur (ex: 297 = 300 - 3)

## Anti-Patterns

### ❌ Troncature naïve

```typescript
// ❌ MAUVAIS : Coupe mid-mot
text.slice(0, 300)
// → "Résolution du Parlement européen sur le règlemen..."
```

### ❌ Oublier l'ellipsis dans le calcul

```typescript
// ❌ MAUVAIS : Peut dépasser maxLength
text.slice(0, 300) + '...'  // → 303 chars si text.length > 300
// → Viole la contrainte VARCHAR(300)
```

### ❌ Troncature sans ellipsis

```typescript
// ❌ MAUVAIS : Pas d'indication de troncature
text.slice(0, 300)
// Utilisateur ne sait pas que le texte est incomplet
```

### ❌ Ellipsis non adapté à la langue

```typescript
// ⚠️ À éviter : '...' est universel, mais certains préfèrent
// '…' (caractère unique Unicode U+2026)
// ' [...]' (notation académique)
// ' (suite)' (français formel)
```

## Optimisations

### Performance pour grandes collections

Si vous tronquez des milliers de textes :

```typescript
// ✅ Memoize la fonction
import memoize from 'lodash/memoize';

const memoizedTruncate = memoize(
  (text: string, maxLength: number) => truncate(text, maxLength),
  (text, maxLength) => `${text.slice(0, 50)}-${maxLength}` // Cache key
);
```

### Précompilation de la regex

```typescript
const WORD_BOUNDARY_REGEX = /\s+\S*$/;

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const targetLength = maxLength - 3;
  return text.slice(0, targetLength).replace(WORD_BOUNDARY_REGEX, '') + '...';
}
```

## Voir aussi

- **Cas d'usage réel** : `src/lib/server/etl/sources/europarl/laws.ts:103` (shortTitle truncation)
- **Lessons learned** : `lessons-learned-2026-02-07-pe-laws-expansion.md` (leçon #3)
- **Standard lié** : `std-french-utf8-content.md` (gestion caractères spéciaux)
- **UI best practices** : `ui-best-practices.md` (affichage texte tronqué)

## Langues et caractères spéciaux

### UTF-8 safe

```typescript
// ✅ JavaScript slice() est UTF-8 safe
'Café ☕ résumé'.slice(0, 10)  // → 'Café ☕ ré'

// Pas de problème avec emojis, accents, etc.
```

### Gestion multi-langues

```typescript
// Français : espaces insécables avant :;!?
// Anglais : pas d'espaces avant ponctuation

function truncateMultilang(text: string, maxLength: number, lang: 'fr' | 'en' = 'fr'): string {
  // Logique similaire, mais aware des règles de ponctuation
  // Complexe → à implémenter seulement si nécessaire
  return truncate(text, maxLength);
}
```

## Date de création

2026-02-07

## Historique

| Date | Modification |
|------|--------------|
| 2026-02-07 | Création suite à implémentation shortTitle truncation |
