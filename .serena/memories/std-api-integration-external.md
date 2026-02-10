# Standard : Intégration d'API Externes

## Objectif

Définir les standards et bonnes pratiques pour toute intégration d'API externe dans le projet NosElus.

## Checklist Complète

### Phase 1 : Évaluation et Décision

**Avant d'intégrer une API externe, documenter :**

- [ ] **ADR créé** : Décision technique documentée avec alternatives évaluées
- [ ] **Prérequis identifiés** : Inscription, credentials, validation manuelle, coûts
- [ ] **Quotas et limites** : Rate limits, quotas journaliers/mensuels, tarification
- [ ] **SLA et disponibilité** : Uptime garanti, support, maintenance
- [ ] **Trade-offs explicites** : Coûts vs bénéfices, couverture vs qualité

**Exemple** : ADR-003 pour API Légifrance PISTE

### Phase 2 : Architecture Client

**Le client API DOIT implémenter :**

#### 2.1 Configuration

- [ ] **Variables d'environnement** : Credentials dans `.env`, jamais en dur
- [ ] **Support sandbox + production** : Env configurable (`sandbox` / `production`)
- [ ] **Base URL configurable** : Éviter hardcoding
- [ ] **Timeouts configurables** : Default raisonnable (30s)

```typescript
interface ApiClientConfig {
  clientId: string;        // PISTE_CLIENT_ID
  clientSecret: string;    // PISTE_CLIENT_SECRET
  environment: 'sandbox' | 'production';
  timeout?: number;        // Default: 30000ms
}

export class ApiClient {
  private readonly baseUrl: string;
  
  constructor(private config: ApiClientConfig) {
    this.baseUrl = config.environment === 'production'
      ? 'https://api.piste.gouv.fr'
      : 'https://sandbox-api.piste.gouv.fr';
  }
}
```

#### 2.2 Authentification

- [ ] **OAuth 2.0 token caching** : Si applicable (voir `pattern-oauth-token-caching.md`)
- [ ] **Retry sur 401** : Invalidation cache + 1 retry
- [ ] **Gestion expiration** : Marge de sécurité (60s avant expiration)

```typescript
private tokenCache: { token: string; expiresAt: number } | null = null;

private async getAccessToken(): Promise<string> {
  if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
    return this.tokenCache.token;
  }

  // Fetch new token...
  this.tokenCache = {
    token: accessToken,
    expiresAt: Date.now() + expiresIn * 1000 - 60000 // -60s margin
  };

  return accessToken;
}
```

#### 2.3 Rate Limiting

- [ ] **Délai entre requêtes** : 200-300ms aléatoire pour simuler comportement humain
- [ ] **Respect des quotas** : Vérifier headers `X-RateLimit-*` si disponibles
- [ ] **Backoff exponentiel** : Sur 429 (Too Many Requests)

```typescript
async function makeRequest(url: string): Promise<Response> {
  // Rate limiting
  const delay = 200 + Math.random() * 100; // 200-300ms
  await new Promise(r => setTimeout(r, delay));

  const response = await fetch(url);

  // Handle 429
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    await sleep(retryAfter ? parseInt(retryAfter) * 1000 : 5000);
    return makeRequest(url); // Retry once
  }

  return response;
}
```

#### 2.3.5 Validation Sémantique des Paramètres API

- [ ] **Vérifier la signification réelle des paramètres** : Lire la doc API, ne pas deviner
- [ ] **Tester avec/sans filtres** : Comparer résultats pour valider intention
- [ ] **Documenter l'intention** : Commenter pourquoi ce paramètre est utilisé
- [ ] **Valider sur données réelles** : Vérifier que filtrage produit résultats attendus

**Problème courant** : Mauvaise interprétation d'un paramètre API.

**Exemple réel (leçon apprise)** :
```typescript
// ❌ MAUVAIS : Assumption incorrecte
// Intention: Filtrer votes des MEPs français
// Réalité: Filtre votes dont le SUJET géographique concerne la France
fetchHTV('/votes?geo_areas=FRA')
// → Retourne 9 votes (votes ABOUT France, pas votes BY French MEPs)

// ✅ BON : Pas de filtre géographique, filtrage fait côté applicatif
fetchHTV('/votes')
// → Retourne 2204 votes (tous les votes PE)
// Le filtrage par MEPs français se fait via les votes individuels
```

**Pattern de validation** :
```typescript
// 1. Tester SANS le filtre
const allResults = await api.fetch('/endpoint');
console.log(`Without filter: ${allResults.length} results`);

// 2. Tester AVEC le filtre
const filteredResults = await api.fetch('/endpoint?filter=value');
console.log(`With filter: ${filteredResults.length} results`);

// 3. Vérifier manuellement quelques résultats
const sample = filteredResults.slice(0, 3);
console.log('Sample results:', sample);

// 4. Valider que le filtre fait ce qu'on pense
// Ex: Si geo_areas=FRA, vérifier que les résultats concernent la France
```

**Checklist de validation** :
- [ ] Documentation API lue et comprise
- [ ] Test avec/sans filtre effectué
- [ ] Résultats comparés et validés
- [ ] Intention du filtre documentée en commentaire
- [ ] Cas limites testés (ex: filtre qui retourne 0 résultats)

**Voir aussi** :
- `lessons-learned-2026-02-07-pe-laws-expansion.md` (leçon #1)
- `adr-2026-02-07-pe-laws-expansion.md` (cas réel geo_areas=FRA)

#### 2.4 Error Handling

- [ ] **Erreurs typées** : Pas de `any`, utiliser types spécifiques
- [ ] **Messages d'erreur clairs** : Inclure status code, endpoint, contexte
- [ ] **Retry strategy** : Retry sur erreurs réseau (ECONNRESET, etc.)
- [ ] **Logging exhaustif** : Toutes les erreurs loggées avec contexte

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
    public response?: any
  ) {
    super(`API Error [${statusCode}] ${endpoint}: ${message}`);
    this.name = 'ApiError';
  }
}

async function apiRequest(endpoint: string): Promise<any> {
  try {
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      throw new ApiError(
        await response.text(),
        response.status,
        endpoint,
        response
      );
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('API Error:', error);
      throw error;
    }
    // Network errors, etc.
    console.error('Network Error:', error);
    throw new Error(`Network error calling ${endpoint}`);
  }
}
```

#### 2.5 Mode Test

- [ ] **`--test-connection`** : Valider credentials et connectivité
- [ ] **Minimal viable request** : 1 requête simple pour tester end-to-end
- [ ] **Clear success/failure** : Output explicite pour l'utilisateur

```typescript
async function testConnection(): Promise<void> {
  console.log('Testing API connection...');
  
  try {
    const token = await this.getAccessToken();
    console.log('✓ OAuth authentication successful');
    
    const result = await this.search('test');
    console.log(`✓ API endpoint accessible (${result.length} results)`);
    
    console.log('\n✓ All tests passed!');
  } catch (error) {
    console.error('\n✗ Connection test failed:', error.message);
    process.exit(1);
  }
}
```

### Phase 3 : Script ETL/Import

**Si l'API sert à importer des données :**

#### 3.1 Flags CLI

- [ ] **`--test-connection`** : Test de connexion uniquement
- [ ] **`--dry-run`** : Simulation sans écriture en DB
- [ ] **`--verbose`** : Logs détaillés
- [ ] **`--limit N`** : Limiter le nombre d'entités traitées
- [ ] **`--with-X`** : Filtres métier (ex: `--with-scrutins`)

```typescript
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    'test-connection': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'verbose': { type: 'boolean', default: false },
    'limit': { type: 'string', default: '100' },
    'with-scrutins': { type: 'boolean', default: false }
  }
});

const config = {
  testConnection: values['test-connection'],
  dryRun: values['dry-run'],
  verbose: values['verbose'],
  limit: parseInt(values.limit as string, 10),
  withScrutins: values['with-scrutins']
};
```

#### 3.2 Logging et Statistiques

- [ ] **Progress indicator** : `[1/100] Processing...`
- [ ] **Stats finales** : Total, succès, erreurs, taux de succès
- [ ] **Logs des échecs** : ID + raison pour investigation
- [ ] **Temps d'exécution** : Début, fin, durée totale

```typescript
const stats = {
  total: 0,
  success: 0,
  errors: 0,
  startTime: Date.now()
};

for (const [index, item] of items.entries()) {
  console.log(`[${index + 1}/${items.length}] Processing ${item.id}...`);
  stats.total++;
  
  try {
    await processItem(item);
    stats.success++;
  } catch (error) {
    stats.errors++;
    console.error(`  ✗ Error: ${error.message}`);
  }
}

const duration = ((Date.now() - stats.startTime) / 1000).toFixed(1);
console.log('\n' + '='.repeat(60));
console.log(`Results:`);
console.log(`  Total: ${stats.total}`);
console.log(`  Success: ${stats.success}`);
console.log(`  Errors: ${stats.errors}`);
console.log(`  Success rate: ${(stats.success / stats.total * 100).toFixed(1)}%`);
console.log(`  Duration: ${duration}s`);
console.log('='.repeat(60));
```

#### 3.3 Transactions et Rollback

- [ ] **Transaction DB** : Rollback si erreur fatale
- [ ] **Idempotence** : Ré-exécution safe (upsert, pas insert)
- [ ] **Validation avant commit** : Vérifier cohérence des données

```typescript
import { db } from '$lib/server/db';

async function importData(items: Item[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const item of items) {
      // Upsert pour idempotence
      await tx.insert(table)
        .values(item)
        .onConflictDoUpdate({
          target: table.id,
          set: item
        });
    }
    
    // Validation finale
    const count = await tx.select().from(table);
    if (count.length === 0) {
      throw new Error('No data imported, rolling back');
    }
  });
}
```

#### 3.4 Cache des Résultats

- [ ] **Cache fichier local** : Éviter re-fetch si script échoue
- [ ] **Invalidation intelligente** : TTL ou détection changements
- [ ] **Option `--no-cache`** : Forcer re-fetch

```typescript
import fs from 'fs';

async function fetchWithCache(url: string, cacheFile: string): Promise<any> {
  // Check cache
  if (fs.existsSync(cacheFile) && !config.noCache) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const age = Date.now() - cached.timestamp;
    
    if (age < 3600 * 1000) { // 1h TTL
      console.log('  ↻ Using cached result');
      return cached.data;
    }
  }

  // Fetch
  const data = await fetch(url).then(r => r.json());
  
  // Save to cache
  fs.writeFileSync(cacheFile, JSON.stringify({
    timestamp: Date.now(),
    data
  }));
  
  return data;
}
```

### Phase 4 : Documentation

- [ ] **`.env.example` mis à jour** : Toutes les variables nécessaires
- [ ] **README ou doc dédiée** : Instructions d'inscription, configuration
- [ ] **Makefile/package.json** : Commandes npm/make pour lancer le script
- [ ] **ADR référencé** : Lien vers la décision technique

**Exemple `.env.example`** :
```bash
# Légifrance PISTE API
# Inscription: https://piste.gouv.fr/registration
PISTE_CLIENT_ID=your_client_id_here
PISTE_CLIENT_SECRET=your_client_secret_here
PISTE_ENV=production  # or 'sandbox' for testing
```

**Exemple Makefile** :
```makefile
# Import full law texts from Légifrance PISTE API
.PHONY: etl-law-texts
etl-an-law-texts:
	@echo "Importing law texts from Légifrance PISTE..."
	npm run etl:law-texts -- $(filter-out $@,$(MAKECMDGOALS))
```

### Phase 5 : Tests et Validation

- [ ] **Compilation TypeScript** : 0 erreurs
- [ ] **Build production** : Succès
- [ ] **Test manuel `--test-connection`** : OAuth + API OK
- [ ] **Test manuel `--dry-run`** : Simulation OK
- [ ] **Import réel sur échantillon** : 10-50 entités
- [ ] **Validation données importées** : Vérifier cohérence en DB

### Phase 6 : Code Review

- [ ] **Pas de credentials en dur** : Tout dans `.env`
- [ ] **Error handling exhaustif** : Tous les cas couverts
- [ ] **Rate limiting implémenté** : Pas de spam API
- [ ] **Logs clairs** : Facile de débugger en production
- [ ] **Documentation complète** : ADR + README + comments inline

## Anti-Patterns

### ❌ Ce qu'il ne faut JAMAIS faire :

1. **Credentials en dur dans le code**
   ```typescript
   // ❌ JAMAIS
   const clientId = 'abc123';
   
   // ✅ TOUJOURS
   const clientId = process.env.PISTE_CLIENT_ID;
   ```

2. **Pas de rate limiting**
   ```typescript
   // ❌ Spam API = ban
   for (const item of items) {
     await api.fetch(item);
   }
   
   // ✅ Rate limiting
   for (const item of items) {
     await api.fetch(item);
     await sleep(200 + Math.random() * 100);
   }
   ```

3. **Ignorer les erreurs**
   ```typescript
   // ❌ Erreurs silencieuses
   try {
     await api.fetch();
   } catch {}
   
   // ✅ Log + handle
   try {
     await api.fetch();
   } catch (error) {
     console.error('API Error:', error);
     stats.errors++;
   }
   ```

4. **Pas de dry-run**
   ```typescript
   // ❌ Directement en DB
   await db.insert(table).values(data);
   
   // ✅ Mode dry-run
   if (config.dryRun) {
     console.log('Would insert:', data);
   } else {
     await db.insert(table).values(data);
   }
   ```

5. **Oublier les timeouts**
   ```typescript
   // ❌ Peut hang indéfiniment
   await fetch(url);
   
   // ✅ Timeout explicite
   await fetch(url, { signal: AbortSignal.timeout(30000) });
   ```

## Exemple Complet

**Projet** : NosElus - Client Légifrance PISTE

**Fichiers** :
- `src/lib/server/etl/sources/legifrance/client.ts` (352 lignes)
- `scripts/etl/import-law-texts-piste.ts` (670 lignes)

**Fonctionnalités implémentées** :
- ✅ OAuth 2.0 avec cache
- ✅ Rate limiting (200-300ms)
- ✅ Modes test/dry-run/verbose
- ✅ Error handling exhaustif
- ✅ Stats finales
- ✅ Transaction DB avec rollback
- ✅ Documentation complète

**Résultats** :
- 32 lois importées
- 96% de success rate
- 0 erreur API
- Build TypeScript OK

## Références

- `pattern-oauth-token-caching.md` : Gestion tokens OAuth
- `pattern-rate-limiting-etl.md` : Rate limiting pour ETL
- `adr-2026-02-03-legifrance-piste.md` : Exemple ADR d'intégration API

## Tags

`api-integration`, `external-api`, `standard`, `best-practices`, `oauth`, `rate-limiting`
