# Guide de contribution

Merci de votre intérêt pour contribuer à NosElus ! 🎉

---

## 📋 Table des matières

- [Code de conduite](#code-de-conduite)
- [Comment contribuer](#comment-contribuer)
- [Workflow de développement](#workflow-de-développement)
- [Convention des commits](#convention-des-commits)
- [Standards de code](#standards-de-code)
- [Tests](#tests)
- [Documentation](#documentation)

---

## 🤝 Code de conduite

En participant à ce projet, vous acceptez de maintenir un environnement respectueux et inclusif pour tous.

---

## 💡 Comment contribuer

### Signaler un bug

1. Vérifiez que le bug n'a pas déjà été signalé dans [Issues](https://github.com/frederictriquet/NosElus/issues)
2. Créez une nouvelle issue avec le template "Bug Report"
3. Décrivez clairement :
   - Le comportement attendu
   - Le comportement actuel
   - Les étapes pour reproduire
   - Votre environnement (OS, Node version, etc.)

### Proposer une feature

1. Vérifiez dans [Issues](https://github.com/frederictriquet/NosElus/issues) et [Discussions](https://github.com/frederictriquet/NosElus/discussions)
2. Créez une issue ou discussion pour discuter de la feature
3. Attendez les retours avant de commencer le développement

### Soumettre une Pull Request

1. Forkez le repository
2. Créez une branche depuis `master`
3. Développez votre feature/fix
4. Ajoutez/mettez à jour les tests
5. Assurez-vous que tous les tests passent
6. Soumettez votre PR

---

## 🔧 Workflow de développement

### 1. Setup initial

```bash
# Forker le repo sur GitHub, puis :
git clone https://github.com/<votre-username>/NosElus.git
cd NosElus

# Installer les dépendances
npm install

# Créer une branche
git checkout -b feat/ma-feature
```

### 2. Développement

```bash
# Lancer le serveur de développement
npm run dev

# Dans un autre terminal, lancer les tests en mode watch
npm run test:watch
```

### 3. Avant de committer

```bash
# Vérifier le type checking
npm run check

# Lancer tous les tests
npm run test
npm run test:e2e

# Vérifier le build
npm run build
```

### 4. Commit et push

```bash
# Les hooks Husky vont automatiquement :
# - Vérifier les types
# - Formater le code
# - Valider le message de commit

git add .
git commit -m "feat: add my new feature"
git push origin feat/ma-feature
```

### 5. Pull Request

1. Allez sur GitHub et créez une PR vers `master`
2. Remplissez le template de PR
3. Attendez la review
4. Effectuez les changements demandés si nécessaire
5. Mergez quand approuvé

---

## 📝 Convention des commits

Ce projet utilise [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <subject>

[body optionnel]

[footer optionnel]
```

### Types autorisés

- `feat`: Nouvelle fonctionnalité
- `fix`: Correction de bug
- `docs`: Documentation
- `style`: Formatage, point-virgules manquants, etc.
- `refactor`: Refactoring
- `perf`: Amélioration de performance
- `test`: Ajout ou correction de tests
- `build`: Changements du build
- `ci`: Changements de la CI
- `chore`: Tâches de maintenance
- `revert`: Revert d'un commit précédent

### Exemples

✅ **Bons exemples :**

```bash
feat: add dark mode toggle
fix: resolve navigation bug on mobile devices
docs: update installation instructions
feat(api): add user authentication endpoint
test: add unit tests for utils functions
ci: update GitHub Actions to Node 20
```

❌ **Mauvais exemples :**

```bash
Add feature              # Pas de type
feat:add feature         # Pas d'espace après :
Feat: add feature        # Type en majuscule
feature: add feature     # Type invalide
```

### Breaking changes

Pour un changement breaking, ajoutez `!` après le type :

```bash
feat!: redesign authentication API

BREAKING CHANGE: The authentication endpoints have been completely redesigned.
Old tokens are no longer valid.
```

---

## 🎨 Standards de code

### TypeScript

- Typer toutes les variables et fonctions
- Utiliser des interfaces pour les objets
- Éviter `any`, préférer `unknown`
- Documenter les types complexes

```typescript
// ✅ Bon
interface User {
	id: string;
	name: string;
	email: string;
}

function getUser(id: string): Promise<User> {
	// ...
}

// ❌ Mauvais
function getUser(id) {
	// ...
}
```

### Svelte

- Un composant par fichier
- Props typés
- Événements typés
- Commenter les composants complexes

```svelte
<script lang="ts">
	// ✅ Bon
	interface Props {
		title: string;
		count?: number;
	}

	let { title, count = 0 }: Props = $props();
</script>

<h1>{title}</h1><p>Count: {count}</p>
```

### Formatage

- Prettier est configuré et s'exécute automatiquement
- Tabs pour l'indentation
- Single quotes
- 100 caractères max par ligne

---

## 🧪 Tests

### Tests unitaires (Vitest)

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myFile';

describe('myFunction', () => {
	it('should return expected value', () => {
		const result = myFunction('input');
		expect(result).toBe('expected');
	});

	it('should handle edge cases', () => {
		expect(myFunction('')).toBe('');
		expect(myFunction(null)).toBe(null);
	});
});
```

### Tests e2e (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('homepage displays correctly', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toContainText('Welcome');
});
```

### Coverage

Visez au moins 80% de coverage pour les nouvelles features :

```bash
npm run test:coverage
```

### Tests de mutation

Optionnel mais recommandé :

```bash
npm run test:mutation:incremental
```

---

## 📚 Documentation

### Code

- Commenter le "pourquoi", pas le "quoi"
- Documenter les fonctions complexes
- Utiliser JSDoc pour les fonctions publiques

```typescript
/**
 * Formate une date selon le format spécifié
 * @param date - La date à formater
 * @param format - Le format de sortie (default: 'YYYY-MM-DD')
 * @returns La date formatée
 */
export function formatDate(date: Date, format = 'YYYY-MM-DD'): string {
	// ...
}
```

### README

Si vous ajoutez une feature majeure, mettez à jour :

- README.md
- docs/ARCHITECTURE.md si l'architecture change
- .github/TEMPLATE_SETUP.md si la config change

---

## ✅ Checklist avant PR

- [ ] Le code compile sans erreur (`npm run check`)
- [ ] Tous les tests passent (`npm run test && npm run test:e2e`)
- [ ] Le code est formaté (`prettier` automatique via hook)
- [ ] Les nouveaux fichiers ont des tests
- [ ] La documentation est à jour
- [ ] Le message de commit respecte la convention
- [ ] Pas de `console.log` ou code de debug
- [ ] Pas de TODO non résolus
- [ ] Les changements sont documentés dans la PR

---

## 🤔 Questions ?

- Ouvrez une [Discussion](https://github.com/frederictriquet/NosElus/discussions)
- Consultez les [Issues existantes](https://github.com/frederictriquet/NosElus/issues)
- Lisez la [documentation](docs/)

---

## 🙏 Merci !

Votre contribution, qu'elle soit grande ou petite, est appréciée ! ❤️
