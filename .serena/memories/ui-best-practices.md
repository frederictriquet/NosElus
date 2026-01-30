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
- `/stats` ✅ - Tous les panels (totaux, distribution, activité, etc.)
- `/carte` ✅ - Hémicycle et liste des députés par groupe
- `/groupes/[id]` ✅ - Distribution des votes, membres actifs, évolution mensuelle
- `/deputes/[id]` ✅ - Stats de votes, votes récents, évolution, milestones, amendements
- `/compare` ✅ - Données de comparaison (streamées après sélection)
- `/scrutins/[id]` ✅ - Détail des votes par position

### Pages non candidates
- `/deputes` - Liste paginée avec recherche, pas de panels indépendants
- `/scrutins` - Liste avec filtres, architecture différente
