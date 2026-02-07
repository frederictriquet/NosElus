# Lessons Learned : ETL Web Scraping avec Rate Limiting

## Date
2026-02-07

## Contexte

**Projet** : NosElus - Quiz PE  
**Tâche** : Enrichissement des descriptions de lois PE via scraping de sources web (OEIL, Press releases)  
**Fichier** : `src/lib/server/etl/sources/europarl/law-texts.ts`

## Problème

Les lois PE importées depuis HowTheyVote.eu API n'avaient que des descriptions minimales (~30 chars). Pour générer des résumés LLM de qualité, nous devions enrichir ces descriptions en fetchant le contenu complet des pages liées (OEIL Summary, Press releases, Reports).

**Contraintes** :
- Respecter les serveurs cibles (pas de DDoS accidentel)
- Gérer les timeouts et erreurs réseau
- Nettoyer le HTML récupéré
- Limiter la taille des descriptions (50KB max)

## Ce qui a bien fonctionné ✅

### 1. Rate Limiting explicite

```typescript
const RATE_LIMIT_MS = 500;

await fetch(url);
// ...
await new Promise(r => setTimeout(r, RATE_LIMIT_MS)); // ← Attente 500ms
```

**Pourquoi** : Évite de surcharger les serveurs cibles. 500ms entre requêtes = 2 req/s max = bon citoyen.

### 2. Timeout avec AbortController

```typescript
const FETCH_TIMEOUT_MS = 30000;

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

const response = await fetch(url, { signal: controller.signal });
clearTimeout(timeout);
```

**Pourquoi** : Évite les hangs infinis sur pages lentes. 30s = raisonnable pour pages HTML.

### 3. User-Agent explicite

```typescript
headers: {
  'User-Agent': 'NosElus/1.0 (https://noselus.fr)',
  'Accept': 'text/html'
}
```

**Pourquoi** :
- Identifie le bot (transparence)
- Fournit un contact si problème
- Évite d'être bloqué par anti-scraping basique

### 4. Nettoyage HTML robuste

```typescript
function cleanHtml(html: string): string {
  return html
    // Balises de structure → newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    // Entités HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Nettoyage final
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

**Pourquoi** :
- Gère entités HTML nommées ET numériques
- Préserve la structure (newlines)
- Élimine whitespace excessif

### 5. Stratégie de sources par priorité

```typescript
// Priority 1: OEIL Summary (officiel)
if (summaryLink) {
  sources.summaryText = await fetchPageText(summaryLink.url);
}

// Priority 2: Press release (accessible)
if (pressLink) {
  sources.pressText = await fetchPageText(pressLink.url);
}

// Priority 3: Report (fallback, souvent long)
if (!sources.summaryText && !sources.pressText) {
  sources.reportText = await fetchPageText(reportLink.url);
}
```

**Pourquoi** :
- Optimise qualité (OEIL > Press > Report)
- Évite fetch inutiles (skip Report si Summary existe)
- Réduit la charge réseau

### 6. Limite de taille

```typescript
const MAX_DESCRIPTION_LENGTH = 50000;

await db.update(laws).set({
  description: description.slice(0, MAX_DESCRIPTION_LENGTH)
});
```

**Pourquoi** :
- Évite descriptions gigantesques (Reports PE peuvent faire 100KB+)
- Limite la charge DB
- 50KB = suffisant pour LLM (Claude supporte jusqu'à 200K tokens)

### 7. Options CLI --dry-run, --verbose

```typescript
if (config.dryRun) {
  console.log("→ [DRY RUN] N'écrit pas en base");
  stats.updated++;
  continue;
}

if (config.verbose) {
  console.log(`→ Fetch: ${url}`);
  console.log(`→ Récupéré: ${text.length} chars`);
}
```

**Pourquoi** :
- `--dry-run` permet de tester sans side-effects
- `--verbose` aide au debugging
- Standard pour scripts ETL

## Ce qui n'a pas bien fonctionné ❌

### 1. Seuil de skip trop bas (200 chars)

**Problème initial** :
```typescript
if (law.description && law.description.length > 200) {
  // Skip déjà enrichi
}
```

Certaines lois avaient des descriptions de l'API HTV de ~200 chars (juste le snippet), et étaient skippées alors qu'elles méritaient d'être enrichies.

**Correction** :
```typescript
if (law.description && law.description.length > 500) {
  // Skip seulement si vraiment substantiel
}
```

**Leçon** : Seuil de "description substantielle" doit être calibré empiriquement.

### 2. Log tronqué trompeur

**Problème initial** :
```typescript
console.log(`Traitement de ${law.title.slice(0, 60)}...`);
```

Pour titres < 60 chars, affichait `...` alors que le titre était complet.

**Correction** :
```typescript
console.log(`Traitement de ${law.title.length > 60 ? law.title.slice(0, 60) + '...' : law.title}`);
```

**Leçon** : Logs doivent être précis, pas trompeurs.

## Métriques

**Performance** :
- 9 lois enrichies en ~45 secondes
- ~5s par loi (fetch + nettoyage)
- Taux de succès : 9/9 (100%)

**Résultats** :
- Descriptions avant : 30-200 chars (minimales)
- Descriptions après : 211-69 540 chars (substantielles)
- Taille moyenne : ~23KB par loi

## Bonnes pratiques à généraliser

### Checklist Web Scraping ETL

- [ ] **Rate limiting** : Attente explicite entre requêtes (≥500ms)
- [ ] **Timeout** : AbortController avec timeout raisonnable (30s)
- [ ] **User-Agent** : Identifier le bot avec contact
- [ ] **Headers** : Accept header approprié (`text/html`)
- [ ] **Retry logic** : Si échec, ne pas retry immédiatement (ou limiter retries)
- [ ] **Error handling** : Catch + log, ne pas crash sur une page
- [ ] **HTML cleaning** : Fonction robuste pour entités + balises
- [ ] **Size limit** : Cap sur taille des contenus fetchés
- [ ] **Dry-run mode** : Tester sans side-effects
- [ ] **Verbose logging** : Debuggable facilement
- [ ] **Cache** : Si possible, mettre en cache (éviter re-fetch)

### Code template

```typescript
const RATE_LIMIT_MS = 500;
const FETCH_TIMEOUT_MS = 30000;
const MAX_CONTENT_LENGTH = 50000;

async function fetchPageText(url: string): Promise<string | null> {
  try {
    // Timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    // Fetch
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MyBot/1.0 (https://example.com)',
        'Accept': 'text/html'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const text = cleanHtml(html);

    // Rate limiting
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

    return text.slice(0, MAX_CONTENT_LENGTH);
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error.message);
    return null;
  }
}
```

## Alternatives considérées

| Approche | Avantages | Inconvénients | Verdict |
|----------|-----------|---------------|---------|
| **Puppeteer/Playwright** | JS rendering, anti-bot bypass | Lourd, lent, overhead | ❌ Rejeté (overkill) |
| **Cheerio parsing** | DOM-like parsing | Dépendance supplémentaire | ⚠️ Optionnel |
| **Regex simple** | Rapide, pas de dépendance | Fragile sur HTML complexe | ✅ Retenu (suffisant) |
| **API officielle** | Fiable, structuré | Pas d'API pour OEIL/Press | ❌ Non disponible |

## Références

- **Fichier** : `src/lib/server/etl/sources/europarl/law-texts.ts`
- **Script** : `scripts/etl/enrich-europarl-law-texts.ts`
- **Pattern similaire** : `import-law-texts-piste.ts` (Légifrance scraping)

## Tags

- `etl`
- `web-scraping`
- `rate-limiting`
- `html-cleaning`
- `europarl`

## Date de capitalisation

2026-02-07
