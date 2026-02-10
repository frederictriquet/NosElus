# Pattern : API Fallback Multi-Endpoint

## Problème

Lors de l'intégration d'APIs externes, certaines ressources peuvent être accessibles via plusieurs endpoints avec des formats/paramètres différents :

- Endpoint principal peut échouer pour un sous-ensemble de ressources
- Endpoint alternatif offre les mêmes données sous un format compatible
- Besoin de transparence pour les appelants (pas de gestion d'erreur explicite partout)

**Exemple concret** : Légifrance API PISTE

- `/consult/legiPart` (version LEGI consolidée) → Ne fonctionne pas pour toutes les lois
- `/consult/jorf` (version Journal Officiel) → Fonctionne pour toutes les lois publiées

## Contexte

Utiliser ce pattern quand :

- ✅ Plusieurs endpoints API retournent des données équivalentes
- ✅ Un endpoint est plus complet mais peut échouer pour certains cas
- ✅ Un fallback existe qui couvre les cas d'échec
- ✅ Les réponses des deux endpoints sont structurellement compatibles
- ✅ Le fallback ne nécessite qu'un identifiant alternatif (CID, slug, etc.)

**Ne PAS utiliser** si :

- ❌ Les réponses ont des structures incompatibles
- ❌ Le fallback nécessite une logique métier complexe
- ❌ Les erreurs doivent être exposées aux appelants

## Solution

Implémenter un **fallback transparent** au niveau du client API :

### Architecture

```typescript
// 1. Types de réponse compatibles
interface ResourceResponse {
	id: string;
	cid: string; // Identifiant alternatif pour fallback
	content: string;
	// ... autres champs communs
}

// 2. Méthode avec fallback intégré
class APIClient {
	async getResource(
		primaryId: string,
		options?: { fallbackId?: string }
	): Promise<ResourceResponse> {
		try {
			// Tentative endpoint principal
			return await this.request('/primary/endpoint', {
				id: primaryId
			});
		} catch (error) {
			// Fallback si erreur spécifique ET identifiant alternatif fourni
			if (options?.fallbackId && error instanceof Error && this.shouldFallback(error)) {
				return await this.request('/fallback/endpoint', {
					alternativeId: options.fallbackId
				});
			}
			// Propager l'erreur si fallback impossible
			throw error;
		}
	}

	private shouldFallback(error: Error): boolean {
		// Logique pour déterminer si fallback approprié
		return error.message.includes('400') || error.message.includes('NOT_FOUND');
	}
}
```

### Appelants

```typescript
// Les appelants passent l'ID alternatif en option
const resource = await client.getResource(primaryId, {
	fallbackId: alternativeId
});
// Pas besoin de gérer le fallback explicitement
```

## Implémentation Légifrance

### Client API

```typescript
// src/lib/server/etl/sources/legifrance/client.ts
async getTexteComplet(
  textId: string,
  options?: { date?: string; cid?: string }
): Promise<LegiTexteResponse> {
  const consultDate = options?.date || new Date().toISOString().split('T')[0];
  try {
    return await this.request<LegiTexteResponse>('/consult/legiPart', {
      textId,
      date: consultDate
    });
  } catch (error) {
    if (options?.cid && error instanceof Error && error.message.includes('400')) {
      return this.request<LegiTexteResponse>('/consult/jorf', {
        textCid: options.cid
      });
    }
    throw error;
  }
}
```

### Propagation de l'identifiant alternatif

```typescript
// scripts/etl/import-law-texts-piste.ts

// 1. Structure de résultat avec les deux IDs
interface MatchResult {
	textId?: string; // ID principal (LEGITEXT)
	cid?: string; // ID alternatif (JORFTEXT)
	// ...
}

// 2. Récupération des deux IDs lors de la recherche
const match = {
	textId: result.id, // LEGITEXT000...
	cid: result.cid // JORFTEXT000...
};

// 3. Passage au client
const texte = await client.getTexteComplet(match.textId, {
	cid: match.cid
});
```

## Avantages

- ✅ **Transparence** : Les appelants n'ont pas à gérer le fallback
- ✅ **Fiabilité** : Taux de succès accru sans complexité ajoutée
- ✅ **Maintenabilité** : Logique centralisée dans le client
- ✅ **Performance** : Pas de double appel si le principal fonctionne
- ✅ **Évolutivité** : Facile d'ajouter d'autres fallbacks

## Inconvénients

- ⚠️ **Dépendance** : Nécessite que les réponses soient compatibles
- ⚠️ **Latence** : Double temps de réponse en cas d'échec du principal
- ⚠️ **Debugging** : Les erreurs du principal peuvent être masquées
- ⚠️ **Identifiants multiples** : Les appelants doivent récupérer et passer les IDs alternatifs

## Variantes

### Fallback avec transformation

Si les structures diffèrent légèrement :

```typescript
try {
	return await this.getPrimary(id);
} catch (error) {
	if (this.shouldFallback(error) && fallbackId) {
		const fallbackData = await this.getFallback(fallbackId);
		return this.transformFallbackToPrimary(fallbackData);
	}
	throw error;
}
```

### Fallback avec cache

Pour éviter les doubles appels répétés :

```typescript
const cacheKey = `${primaryId}:${fallbackId}`;
const cached = this.cache.get(cacheKey);
if (cached) return cached;

try {
	const result = await this.getPrimary(primaryId);
	this.cache.set(cacheKey, result);
	return result;
} catch (error) {
	if (this.shouldFallback(error) && fallbackId) {
		const result = await this.getFallback(fallbackId);
		this.cache.set(cacheKey, result);
		return result;
	}
	throw error;
}
```

### Fallback avec retry

Si le principal peut avoir des erreurs transitoires :

```typescript
async getWithFallback(id: string, options: Options): Promise<Response> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await this.getPrimary(id);
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) break;
      await sleep(RETRY_DELAY * Math.pow(2, attempt));
    }
  }

  // Fallback après échec des retries
  if (options.fallbackId) {
    return await this.getFallback(options.fallbackId);
  }
  throw new Error('All attempts failed');
}
```

## Exemples d'utilisation

### Projet NosElus

- **Fichier** : `src/lib/server/etl/sources/legifrance/client.ts:164-183`
- **Cas** : Récupération texte de loi via legiPart → fallback JORF
- **Impact** : Taux de succès enrichissement lois de ~70% à ~100%

### Cas d'usage généraux

1. **APIs avec versions multiples** : v2 → fallback v1
2. **Services géo-distribués** : région primaire → fallback autre région
3. **Formats de données** : JSON → fallback XML
4. **Résolutions d'images** : haute qualité → fallback standard

## Considérations de sécurité

- ⚠️ **Authentification** : Vérifier que le fallback utilise les mêmes credentials
- ⚠️ **Rate limiting** : Le fallback compte dans les quotas
- ⚠️ **Données sensibles** : S'assurer que le fallback a les mêmes garanties de confidentialité

## Tests

### Test du path principal

```typescript
test('should use primary endpoint when available', async () => {
	const result = await client.getResource(primaryId, { fallbackId });
	expect(mockPrimary).toHaveBeenCalledWith(primaryId);
	expect(mockFallback).not.toHaveBeenCalled();
});
```

### Test du fallback

```typescript
test('should fallback on 400 error', async () => {
	mockPrimary.mockRejectedValue(new Error('400: Bad Request'));
	const result = await client.getResource(primaryId, { fallbackId });
	expect(mockFallback).toHaveBeenCalledWith(fallbackId);
});
```

### Test sans fallbackId

```typescript
test('should throw when fallback unavailable', async () => {
	mockPrimary.mockRejectedValue(new Error('400: Bad Request'));
	await expect(
		client.getResource(primaryId) // Pas de fallbackId
	).rejects.toThrow('400');
});
```

## Voir aussi

- `bug-2026-02-10-legifrance-legipart-400.md` - Cas concret d'implémentation
- `pattern-oauth-token-caching.md` - Autre pattern client API
- `std-api-integration-external.md` - Standards intégration API externes

## Références

- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Retry Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/retry)
- [Fallback Pattern](https://resilience4j.readme.io/docs/fallback)
