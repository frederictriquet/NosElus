# Standard : Dépendances entre Svelte Stores

## Catégorie
Architecture / Svelte

## Date d'adoption
2026-02-05

## Règle

**Éviter les dépendances circulaires et les imports croisés entre stores Svelte.**

Si un store A importe un store B, tout composant important A hérite des dépendances de B et de ses erreurs potentielles.

## Justification

Les imports entre stores créent des **cascades d'erreurs** difficiles à diagnostiquer :
- Une erreur runtime dans store B casse tous les composants important store A
- Les erreurs de chargement/parsing se propagent
- Le debugging est complexe (l'erreur apparaît loin de sa source)

## Architecture recommandée

### ✅ Pattern correct : Stores indépendants

```typescript
// stores/user.ts
export const userStore = writable<User | null>(null);

// stores/preferences.ts  
export const preferencesStore = writable<Preferences>({});

// components/MyComponent.svelte
<script>
  import { userStore } from '$lib/stores/user';
  import { preferencesStore } from '$lib/stores/preferences';
  // Les stores sont indépendants, pas de cascade d'erreurs
</script>
```

### ✅ Pattern correct : Derived store

Si une relation est nécessaire, utiliser un `derived` store :

```typescript
// stores/user.ts
export const userStore = writable<User | null>(null);

// stores/user-preferences.ts
import { derived } from 'svelte/store';
import { userStore } from './user';
import { preferencesStore } from './preferences';

export const userPreferences = derived(
  [userStore, preferencesStore],
  ([$user, $prefs]) => {
    // Combine les données sans import circulaire
    return $user ? { ...$prefs, userId: $user.id } : null;
  }
);
```

### ❌ Anti-pattern : Import croisé

```typescript
// stores/chamber-period.ts
import { cookieConsent } from './cookie-consent'; // ❌

export const chamberPeriodStore = writable({
  setCookie(name, value) {
    if (!cookieConsent.hasConsent()) return; // ❌
    // Si cookie-consent.ts a une erreur, chamberPeriodStore casse
  }
});

// components/CookieBanner.svelte
import { chamberPeriodStore } from '$lib/stores/chamber-period'; // ❌
// Si chamberPeriodStore casse → CookieBanner casse aussi !
```

## Solution aux imports croisés

### Option 1 : Déplacer la logique dans le composant

```typescript
// stores/chamber-period.ts
export const chamberPeriodStore = writable({
  // Fonction pure, pas de dépendance
  setCookie(name, value) {
    document.cookie = `${name}=${value}`;
  }
});

// components/MyComponent.svelte
<script>
  import { chamberPeriodStore } from '$lib/stores/chamber-period';
  import { cookieConsent } from '$lib/stores/cookie-consent';
  
  function updatePeriod(value) {
    if ($cookieConsent.hasConsent()) { // Check dans le composant
      chamberPeriodStore.setCookie('period', value);
    }
  }
</script>
```

### Option 2 : Event-driven avec custom events

```typescript
// stores/cookie-consent.ts
export const cookieConsent = writable({
  accepted: false,
  events: new EventTarget()
});

// stores/chamber-period.ts
import { get } from 'svelte/store';
// Pas d'import du store cookie-consent !

export function initChamberPeriod() {
  // Écoute les événements au lieu d'importer
  window.addEventListener('cookie-consent-granted', () => {
    // Logique post-consentement
  });
}
```

## Vérification

### Code review checklist
- [ ] Les stores sont-ils indépendants ?
- [ ] Y a-t-il des imports croisés entre stores ?
- [ ] Un `derived` store serait-il plus approprié ?

### Détection automatique
```bash
# Trouver les imports entre stores
grep -r "from '\$lib/stores" src/lib/stores/*.ts
```

## Exceptions

Les `derived` stores peuvent importer d'autres stores de manière unidirectionnelle (pas de cycle).

## Origine

Session EU Compliance 2026-02-05 : Import `cookieConsent` dans `chamber-period.ts` a cassé à la fois CookieBanner et la sélection de période. Debug complexe (erreur apparaissait dans un composant non lié).

## Voir aussi

- Svelte documentation : [Derived stores](https://svelte.dev/docs/svelte-store#derived)
- `lessons-learned-2026-02-05-eu-compliance.md`
