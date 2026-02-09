# Bonnes pratiques UI - NosElus

## Chargement progressif avec AsyncCard

**Toujours privilégier l'utilisation du composant `AsyncCard`** pour les pages avec des requêtes lentes.

### Composant
`src/lib/components/AsyncCard.svelte`

### Utilisation
```svelte
<AsyncCard title="Titre" subtitle="Sous-titre optionnel" promise={data.myPromise} minHeight="200px">
  {#snippet children(myData)}
    <!-- Contenu avec myData typé -->
  {/snippet}
</AsyncCard>
```

### Côté serveur
Retourner des promises **non résolues** depuis le `load` pour activer le streaming SvelteKit :

```typescript
export const load: PageServerLoad = async ({ url }) => {
  const loadMyData = async () => {
    // requête lente
    return await db.select()...;
  };

  return {
    // Données synchrones (rapides)
    filters: { ... },
    // Promises streamées (chaque panel charge indépendamment)
    myData: loadMyData(),  // PAS de await ici !
  };
};
```

### Avantages
- TTFB quasi-instantané (~0.17s)
- Chaque panel se charge indépendamment avec spinner
- Meilleure UX perçue
- Le composant gère automatiquement loading/error states

### Pages migrées avec AsyncCard

**Assemblée nationale (`/an/`)**
- `/an/stats` ✅ - Tous les panels (totaux, distribution, activité, etc.)
- `/an/carte` ✅ - Hémicycle et liste des députés par groupe
- `/an/groupes/[id]` ✅ - Distribution des votes, membres actifs, évolution mensuelle
- `/an/deputes/[id]` ✅ - Stats de votes, votes récents, évolution, milestones, amendements
- `/an/compare` ✅ - Données de comparaison (streamées après sélection)
- `/an/scrutins/[id]` ✅ - Détail des votes par position

**Parlement européen (`/pe/`)**
- `/pe/eurodeputes/[id]` ✅ - Stats de votes, votes récents
- `/pe/eurodeputes/compare` ✅ - Comparateur d'eurodéputés

**Sénat (`/senat/`)**
- À venir

**Stats (`/stats/`)**
- `/stats/data-quality` ✅ - 3 sections (KPI globaux, couverture élus, tableau mandatures)

### Pages non candidates
- `/an/deputes` - Liste paginée avec recherche, pas de panels indépendants
- `/an/scrutins` - Liste avec filtres, architecture différente
- `/pe/eurodeputes` - Liste paginée
- `/senat/senateurs` - Liste paginée
