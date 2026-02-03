# Pattern : OAuth Token Caching

## Contexte

Les APIs utilisant OAuth 2.0 Client Credentials flow retournent des access tokens avec une durée de vie limitée (typiquement 3600s = 1h). Demander un nouveau token à chaque requête API est inefficace et peut conduire à des rate limits sur l'endpoint OAuth.

## Problème

Comment gérer efficacement les access tokens OAuth pour minimiser les requêtes OAuth tout en garantissant que le token reste valide ?

## Solution

Implémenter un cache de token en mémoire avec gestion automatique de l'expiration.

### Code Pattern (TypeScript)

```typescript
class ApiClient {
  private tokenCache: {
    token: string;
    expiresAt: number; // timestamp en millisecondes
  } | null = null;

  /**
   * Récupère un access token valide, depuis le cache si possible,
   * sinon via l'endpoint OAuth
   */
  private async getAccessToken(): Promise<string> {
    // 1. Vérifier si le cache existe et est encore valide
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    // 2. Requête OAuth pour obtenir un nouveau token
    const response = await fetch(this.oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: this.scope || ''
      })
    });

    if (!response.ok) {
      throw new Error(`OAuth failed: ${response.status}`);
    }

    const data = await response.json();
    const accessToken = data.access_token;
    const expiresIn = data.expires_in; // en secondes

    // 3. Mettre en cache avec marge de sécurité (60s avant expiration)
    this.tokenCache = {
      token: accessToken,
      expiresAt: Date.now() + (expiresIn * 1000) - 60000
    };

    return accessToken;
  }

  /**
   * Requête API utilisant le token OAuth
   */
  public async apiRequest(endpoint: string): Promise<any> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      // Token invalide/expiré malgré le cache
      // Invalider le cache et réessayer une fois
      this.tokenCache = null;
      return this.apiRequest(endpoint);
    }

    return response.json();
  }
}
```

## Détails Techniques

### 1. Marge de Sécurité

**Pourquoi** : Soustraire 60 secondes (`- 60000` ms) de l'expiration nominale.

**Raison** : 
- Éviter les race conditions (requête lancée juste avant expiration)
- Compenser les délais réseau
- Prévenir les échecs 401 en production

**Trade-off** : Token "périmé" 60s avant son expiration réelle, mais garantit 0 échec.

### 2. Cache en Mémoire

**Avantages** :
- Simple à implémenter
- Pas de dépendance externe (Redis, etc.)
- Performant (accès instantané)

**Limites** :
- Cache perdu au redémarrage du process
- Non partagé entre instances (scaling horizontal)

**Quand c'est OK** :
- Scripts ETL (single-process)
- API peu sollicitée
- Développement/testing

**Quand ce n'est PAS OK** :
- Application multi-instance en production
- Load balancer avec plusieurs workers
→ Utiliser Redis ou autre cache distribué

### 3. Gestion 401 (Token Invalide)

**Stratégie** : Retry avec invalidation du cache.

```typescript
if (response.status === 401) {
  this.tokenCache = null; // Invalider
  return this.apiRequest(endpoint); // Réessayer UNE fois
}
```

**Important** : Réessayer UNE SEULE fois pour éviter les boucles infinies si le problème vient des credentials.

## Cas d'Usage

### ✅ Utiliser ce pattern quand :

- OAuth 2.0 Client Credentials flow
- Script ETL ou worker single-process
- API avec tokens expirables (1h typiquement)
- Besoin de performances (éviter OAuth à chaque call)

### ❌ Ne PAS utiliser ce pattern quand :

- OAuth 2.0 Authorization Code flow (tokens refresh différents)
- Application multi-instance en production (utiliser cache distribué)
- Tokens très courts (< 5 minutes) : overhead du cache faible

## Variantes

### Variante 1 : Cache Distribué (Redis)

Pour applications multi-instance :

```typescript
private async getAccessToken(): Promise<string> {
  // 1. Chercher dans Redis
  const cached = await redis.get('oauth:token:piste');
  if (cached) {
    return cached;
  }

  // 2. Requête OAuth (même code que ci-dessus)
  const accessToken = await this.fetchNewToken();
  const expiresIn = 3600;

  // 3. Stocker dans Redis avec TTL
  await redis.setex('oauth:token:piste', expiresIn - 60, accessToken);

  return accessToken;
}
```

### Variante 2 : Refresh Token

Pour OAuth Authorization Code flow :

```typescript
private tokenCache: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null = null;

private async getAccessToken(): Promise<string> {
  if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
    return this.tokenCache.accessToken;
  }

  // Utiliser refresh token si disponible
  if (this.tokenCache?.refreshToken) {
    return this.refreshAccessToken();
  }

  // Sinon, full OAuth flow
  return this.initiateOAuthFlow();
}
```

## Exemple Concret

**Projet** : NosElus - Intégration Légifrance PISTE API

**Code** : `src/lib/server/etl/sources/legifrance/client.ts`

**Résultats** :
- Avant : 1 requête OAuth par appel API (50 calls = 50 OAuth)
- Après : 1 requête OAuth par heure (50 calls = 1 OAuth)
- **Gain** : 98% de réduction des appels OAuth

## Best Practices

### ✅ DO

- Toujours soustraire une marge de sécurité (30-60s) de l'expiration
- Gérer le cas 401 avec invalidation + retry
- Logger les requêtes OAuth (monitoring, debugging)
- Tester l'expiration en local (réduire `expiresIn` à 10s)

### ❌ DON'T

- Ne PAS stocker le client_secret en dur dans le code (utiliser env vars)
- Ne PAS partager le même token entre utilisateurs (si user-specific OAuth)
- Ne PAS oublier de gérer le cas où l'API change son format de token
- Ne PAS faire retry infini sur 401 (limiter à 1-2 tentatives)

## Métriques

**Mesurer l'efficacité** :

```typescript
private oauthRequestCount = 0;
private apiRequestCount = 0;

private async getAccessToken(): Promise<string> {
  if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
    return this.tokenCache.token;
  }

  this.oauthRequestCount++;
  console.log(`OAuth requests: ${this.oauthRequestCount}/${this.apiRequestCount} API requests`);
  
  // ... fetch token ...
}

public async apiRequest(endpoint: string): Promise<any> {
  this.apiRequestCount++;
  // ... make request ...
}
```

**Objectif** : `oauthRequestCount / apiRequestCount < 0.01` (1 OAuth pour 100+ API calls).

## Références

- [OAuth 2.0 RFC 6749 - Client Credentials](https://datatracker.ietf.org/doc/html/rfc6749#section-4.4)
- [Best Practices for OAuth Token Management](https://oauth.net/2/token-management/)

## Tags

`oauth`, `cache`, `api-integration`, `performance`, `authentication`
