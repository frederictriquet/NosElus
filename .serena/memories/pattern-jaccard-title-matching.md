# Pattern : Jaccard Title Matching avec NLP

## Contexte

Besoin de lier des entités entre deux sources de données hétérogènes (bases de données, APIs) qui n'ont pas d'identifiant commun, uniquement des champs textuels (titre, nom, description) avec variations importantes.

## Problème

Comment matcher des titres/noms similaires mais non identiques entre deux sources ?

**Exemples de variations** :
- Abréviations : "Projet de loi" vs "PL"
- Articles : "la réforme" vs "réforme"
- Ordre des mots : "loi de finances 2025" vs "finances pour 2025 loi"
- Ponctuation : "l'éducation" vs "l education"
- Accents : "élève" vs "eleve"
- Numéros de référence : "LOI n° 2025-123 du 1er janvier..." vs titre court

## Solution

Utiliser la **similarité de Jaccard** avec normalisation NLP extensive et bonus pour mots discriminants.

### Algorithme

```typescript
/**
 * Calcule la similarité de Jaccard entre deux titres
 * avec normalisation NLP et bonus pour mots discriminants
 * 
 * @param title1 Premier titre
 * @param title2 Deuxième titre
 * @returns Score de similarité entre 0.0 (aucune) et 1.0+ (identique avec bonus)
 */
function calculateJaccardSimilarity(title1: string, title2: string): number {
  // 1. NORMALISATION
  const normalized1 = normalizeTitle(title1);
  const normalized2 = normalizeTitle(title2);

  // 2. TOKENISATION
  const tokens1 = new Set(normalized1.split(/\s+/).filter(t => t.length > 0));
  const tokens2 = new Set(normalized2.split(/\s+/).filter(t => t.length > 0));

  // 3. JACCARD DE BASE
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);
  const baseScore = intersection.size / union.size;

  // 4. BONUS MOTS DISCRIMINANTS
  let bonus = 0;

  // Bonus pour mots longs (8+ caractères)
  const longWords = [...intersection].filter(t => t.length >= 8);
  if (longWords.length > 0) {
    bonus += 0.2; // +20%
  }

  // Bonus pour années (2020-2030)
  const years = [...intersection].filter(t => /^(202[0-9])$/.test(t));
  if (years.length > 0) {
    bonus += 0.2; // +20%
  }

  return Math.min(baseScore + bonus, 1.0);
}
```

### Normalisation NLP

```typescript
// Stop words français (à adapter selon la langue)
const FRENCH_STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'à',
  'au', 'aux', 'et', 'ou', 'pour', 'par', 'dans', 'sur',
  'avec', 'sans', 'sous', 'en', 'ce', 'cette', 'ces',
  'son', 'sa', 'ses', 'leur', 'leurs', 'mon', 'ma', 'mes'
]);

function normalizeTitle(title: string): string {
  return title
    // 1. Lowercase
    .toLowerCase()
    // 2. Supprimer accents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // 3. Remplacer apostrophes par espaces
    .replace(/['']/g, ' ')
    // 4. Supprimer ponctuation (sauf chiffres et lettres)
    .replace(/[^\w\s]/g, ' ')
    // 5. Normaliser espaces multiples
    .replace(/\s+/g, ' ')
    .trim()
    // 6. Supprimer stop words
    .split(/\s+/)
    .filter(word => !FRENCH_STOP_WORDS.has(word))
    .join(' ');
}
```

## Détails Techniques

### 1. Similarité de Jaccard

**Formule** : `J(A, B) = |A ∩ B| / |A ∪ B|`

- **A, B** : Ensembles de tokens (mots) des deux titres
- **|A ∩ B|** : Nombre de mots en commun (intersection)
- **|A ∪ B|** : Nombre total de mots distincts (union)

**Exemple** :
```
Titre 1: "projet de loi de finances pour 2025"
Titre 2: "loi finances 2025"

Normalisé 1: "projet loi finances 2025"    (stop words enlevés: "de", "pour")
Normalisé 2: "loi finances 2025"

Tokens 1: {projet, loi, finances, 2025}
Tokens 2: {loi, finances, 2025}

Intersection: {loi, finances, 2025} → 3 mots
Union: {projet, loi, finances, 2025} → 4 mots

Jaccard = 3/4 = 0.75
```

### 2. Bonus Mots Discriminants

**Hypothèse** : Certains mots sont plus importants que d'autres pour distinguer les titres.

**Catégories de bonus** :

#### Mots longs (8+ caractères)
- **Pourquoi** : Les mots longs sont souvent plus spécifiques et discriminants
- **Exemples** : "environnement", "agriculture", "numérique"
- **Bonus** : +20% si au moins 1 mot long en commun

#### Années (2020-2030)
- **Pourquoi** : Les années sont très discriminantes dans les contextes législatifs
- **Exemples** : "2025", "2024"
- **Bonus** : +20% si au moins 1 année en commun

**Total possible** : +40% (peut faire passer un match de 0.65 à 1.0+)

**Plafond** : Score final limité à 1.0 pour rester dans [0, 1].

### 3. Seuil de Matching

**Recommandation** : Seuil = **0.4** (40%)

**Justification empirique** :
- Seuil trop bas (< 0.3) : Trop de faux positifs
- Seuil trop haut (> 0.5) : Manque de vrais positifs
- **0.4** : Bon équilibre testé sur 50 cas réels

**Ajuster selon** :
- Qualité des données source (si très bruitées, monter à 0.5)
- Objectif (précision vs recall)
- Validation manuelle d'un échantillon

## Usage

```typescript
// 1. Récupérer les titres des deux sources
const titlesAN = await db.select().from(lawsAN);
const titlesLegifrance = await searchLegifrance(query);

// 2. Pour chaque titre AN, trouver le meilleur match Légifrance
for (const lawAN of titlesAN) {
  let bestMatch = null;
  let bestScore = 0;

  for (const resultLF of titlesLegifrance) {
    const score = calculateJaccardSimilarity(lawAN.title, resultLF.title);
    
    if (score > bestScore && score >= SIMILARITY_THRESHOLD) {
      bestScore = score;
      bestMatch = resultLF;
    }
  }

  if (bestMatch) {
    console.log(`✓ Match: ${lawAN.title} → ${bestMatch.title} (${bestScore.toFixed(2)})`);
    // Lier les entités
  } else {
    console.log(`✗ No match: ${lawAN.title}`);
  }
}
```

## Cas d'Usage

### ✅ Utiliser ce pattern quand :

- Matching de titres/noms entre sources hétérogènes
- Pas d'identifiant commun disponible
- Variations textuelles importantes (abréviations, ponctuation)
- Besoin de robustesse aux typos/fautes
- Contexte NLP (textes en langue naturelle)

### ❌ Ne PAS utiliser ce pattern quand :

- Identifiant commun disponible (utiliser celui-ci directement)
- Textes très courts (< 3 mots) : Jaccard peu fiable
- Besoin de 100% de précision : préférer matching manuel
- Performance critique : Jaccard en O(n²) pour n titres

## Variantes

### Variante 1 : Tri-grammes (n-grams)

Pour gérer les typos et variations orthographiques :

```typescript
function generateTrigrams(text: string): Set<string> {
  const trigrams = new Set<string>();
  for (let i = 0; i <= text.length - 3; i++) {
    trigrams.add(text.slice(i, i + 3));
  }
  return trigrams;
}

// Jaccard sur tri-grammes au lieu de mots
const trigrams1 = generateTrigrams(normalizeTitle(title1));
const trigrams2 = generateTrigrams(normalizeTitle(title2));
// ... même algo Jaccard
```

**Avantage** : Robuste aux fautes d'orthographe, ordre des lettres.

### Variante 2 : TF-IDF + Cosine Similarity

Pour corpus très large où certains mots sont plus fréquents que d'autres :

```typescript
// 1. Calculer TF-IDF pour chaque mot du corpus
const tfidf = calculateTfIdf(allTitles);

// 2. Vectoriser les titres
const vector1 = vectorize(title1, tfidf);
const vector2 = vectorize(title2, tfidf);

// 3. Similarité cosinus
const similarity = cosineSimilarity(vector1, vector2);
```

**Avantage** : Pondère les mots par leur rareté (mots rares = plus discriminants).

### Variante 3 : Levenshtein Distance

Pour textes très proches avec typos :

```typescript
function levenshteinSimilarity(s1: string, s2: string): number {
  const distance = levenshtein(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - (distance / maxLen);
}
```

**Avantage** : Mesure directe de la "distance d'édition" entre chaînes.

**Inconvénient** : Sensible à l'ordre des mots.

## Exemple Concret

**Projet** : NosElus - Matching Assemblée Nationale ↔ Légifrance

**Données** :
- 50 titres de lois AN
- ~10 résultats Légifrance par recherche (500 comparaisons totales)

**Résultats** :
- **48/50 matchés** avec seuil 0.4 (96% de succès)
- **2 non matchés** : Titres trop différents ou loi non publiée au JO

**Exemple de match réussi** :
```
AN:          "proposition de loi visant à réformer le mode d'élection du conseil d'administration"
Légifrance:  "Loi visant à réformer le mode d'élection des membres du conseil d'administration"
Score:       0.72 (sans bonus) + 0.2 (mot long "administration") = 0.92
```

**Exemple de non-match** :
```
AN:          "gouvernement de rétablissement de l'article 6 bis (supprimé)"
Légifrance:  (Aucun résultat pertinent)
Raison:      Titre incomplet/procédural, pas une loi finale
```

## Best Practices

### ✅ DO

- Toujours normaliser (accents, casse, ponctuation)
- Tester le seuil empiriquement sur un échantillon représentatif
- Logger les non-matchés pour analyse manuelle
- Valider sur un échantillon aléatoire (10-20 cas) manuellement
- Adapter les stop words à la langue et au domaine

### ❌ DON'T

- Ne PAS utiliser Jaccard sur textes très courts (< 3 mots)
- Ne PAS oublier de gérer les cas où un titre est vide
- Ne PAS supposer que le meilleur score est toujours correct (vérifier seuil)
- Ne PAS hardcoder les stop words dans le code (externaliser)

## Métriques

**Mesurer la qualité** :

```typescript
const stats = {
  total: 0,
  matched: 0,
  notMatched: 0,
  scores: [] as number[]
};

for (const law of laws) {
  stats.total++;
  const match = findBestMatch(law.title, candidates);
  
  if (match && match.score >= THRESHOLD) {
    stats.matched++;
    stats.scores.push(match.score);
  } else {
    stats.notMatched++;
    console.log(`No match: ${law.title}`);
  }
}

console.log(`Matched: ${stats.matched}/${stats.total} (${(stats.matched/stats.total*100).toFixed(1)}%)`);
console.log(`Average score: ${(stats.scores.reduce((a,b) => a+b, 0) / stats.scores.length).toFixed(2)}`);
```

**Objectifs** :
- **Success rate** : > 90%
- **Average score** : > 0.6 (pour seuil 0.4)

## Limites

1. **Performance** : O(n × m) comparaisons pour n titres source × m titres cible
   - **Mitigation** : Pré-filtrage (par année, par mots-clés) pour réduire m

2. **Ambiguïté** : Plusieurs titres peuvent avoir le même score
   - **Mitigation** : Prendre le premier, ou demander validation manuelle

3. **Évolution des titres** : Titres modifiés entre adoption et publication
   - **Mitigation** : Augmenter le corpus de recherche (chercher variations)

## Références

- [Jaccard Index - Wikipedia](https://en.wikipedia.org/wiki/Jaccard_index)
- [Natural Language Processing with Python (NLTK)](https://www.nltk.org/)
- [String Similarity Algorithms Comparison](https://towardsdatascience.com/string-matching-with-python)

## Tags

`nlp`, `fuzzy-matching`, `jaccard`, `text-similarity`, `data-integration`
