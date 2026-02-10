# Pattern : Déduplication d'actions SvelteKit avec Transaction DB

## Problème

Lorsque plusieurs actions SvelteKit partagent la même logique métier (ex: `approve` et `associate` qui ne diffèrent que par le contexte), on se retrouve avec du code dupliqué. Si cette logique implique plusieurs opérations DB, l'absence de transaction peut créer des états incohérents.

## Contexte

- Actions SvelteKit (`+page.server.ts`) avec logique partagée
- Multiple opérations DB (UPDATE + DELETE, INSERT + UPDATE, etc.)
- Besoin d'atomicité (tout ou rien)

## Symptômes de code smell

```typescript
// ❌ Duplication + pas de transaction
export const actions = {
  approve: async ({ request }) => {
    // ... 30 lignes de logique
    await db.update(table1).set(...);
    await db.delete(table2).where(...);
    return { success: true, action: 'approve' };
  },

  associate: async ({ request }) => {
    // ... 30 lignes identiques !
    await db.update(table1).set(...);
    await db.delete(table2).where(...);
    return { success: true, action: 'associate' };
  }
}
```

**Problèmes** :

- Duplication → risque de divergence lors des corrections
- Pas de transaction → si DELETE échoue, UPDATE déjà commité (état incohérent)

## Solution

Extraire la logique partagée dans une fonction avec transaction atomique :

```typescript
// ✅ Fonction partagée avec transaction
async function fetchAndAssociateText(lawId: string, textId: string) {
	const client = createLegifranceClient();
	const texte = await client.getTexteComplet(textId);
	const fullText = extractTextFromResponse(texte);

	if (fullText.length < 100) {
		return fail(400, { error: 'Texte trop court pour etre associe' });
	}

	// Transaction atomique : tout ou rien
	await db.transaction(async (tx) => {
		await tx
			.update(laws)
			.set({
				description: fullText.slice(0, MAX_DESCRIPTION_LENGTH),
				updatedAt: new Date()
			})
			.where(eq(laws.id, lawId));

		await tx.delete(lawTextSkipList).where(eq(lawTextSkipList.lawId, lawId));
	});

	return null; // null = succès, sinon ActionFailure
}

// Actions concises
export const actions = {
	approve: async ({ request, locals }) => {
		if (!locals.adminAuthenticated) {
			return fail(401, { error: 'Non authentifie' });
		}

		const data = await request.formData();
		const lawId = data.get('lawId')?.toString();
		const textId = data.get('textId')?.toString();

		if (!lawId || !textId) {
			return fail(400, { error: 'lawId et textId requis' });
		}

		try {
			const result = await fetchAndAssociateText(lawId, textId);
			if (result) return result; // Erreur de validation
			return { success: true, action: 'approve' };
		} catch (err) {
			console.error('Erreur approbation:', err);
			return fail(500, { error: 'Erreur lors de la recuperation du texte Legifrance' });
		}
	},

	associate: async ({ request, locals }) => {
		// Identique à approve, sauf le nom d'action retourné
		// ... (même code avec action: 'associate')
	}
};
```

## Avantages

- **DRY** : Logique partagée factoriseé → 1 seul endroit à corriger
- **Atomicité** : `db.transaction()` garantit que UPDATE + DELETE réussissent ensemble ou échouent ensemble
- **Testabilité** : La fonction partagée peut être testée isolément
- **Lisibilité** : Actions concises (7 lignes vs 30 lignes)

## Inconvénients

- Légère indirection (1 niveau de fonction supplémentaire)

## Pattern de contrat

La fonction partagée retourne :

- `null` en cas de succès → l'action retourne `{ success: true }`
- `ActionFailure` (via `fail()`) en cas d'erreur validée → l'action la propage

```typescript
const result = await sharedFunction(...);
if (result) return result; // Propagation erreur validée
return { success: true, action: 'xxx' }; // Succès
```

## Exemples d'utilisation

- `src/routes/admin/law-text-review/+page.server.ts:14-36` - fetchAndAssociateText()
  - Logique : fetch API Légifrance → validate length → UPDATE + DELETE atomique
  - Utilisé par : `approve` et `associate`

## Quand utiliser ce pattern

- [ ] 2+ actions partagent >50% de logique
- [ ] Logique implique multiple opérations DB
- [ ] Besoin d'atomicité (état DB cohérent)

## Voir aussi

- Drizzle ORM transactions : https://orm.drizzle.team/docs/transactions
- SvelteKit form actions : https://svelte.dev/docs/kit/form-actions
- Pattern extraction de fonction : `pattern-critical-id-factorization.md`
