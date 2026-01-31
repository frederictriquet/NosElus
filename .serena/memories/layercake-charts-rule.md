# Règle pour les graphiques - LayerCake

## Règle obligatoire

**Toujours utiliser LayerCake** pour tous les graphiques et visualisations de données dans ce projet.

### Instructions

1. **Utiliser les composants existants** dans `src/lib/components/charts/` :
   - `Line.svelte` - Ligne de graphique
   - `AxisX.svelte` - Axe horizontal
   - `AxisY.svelte` - Axe vertical
   - `HorizontalLine.svelte` - Ligne horizontale (moyenne, seuil)
   - `Scatter.svelte` - Points de données
   - `ColumnStacked.svelte` - Barres empilées (stacked bar chart)

2. **Ne PAS réimplémenter** de composants de graphe si LayerCake ou les composants existants peuvent le faire

3. **Demander l'autorisation** à l'utilisateur AVANT d'implémenter un nouveau composant de graphe custom

### Exemple d'utilisation

```svelte
<script>
  import { LayerCake, Svg } from 'layercake';
  import { scalePoint } from 'd3-scale';
  import Line from '$lib/components/charts/Line.svelte';
  import AxisX from '$lib/components/charts/AxisX.svelte';
  import AxisY from '$lib/components/charts/AxisY.svelte';
</script>

<div class="chart-container" style="height: 200px;">
  <LayerCake
    padding={{ top: 10, right: 10, bottom: 40, left: 35 }}
    x="xKey"
    y="yKey"
    xScale={scalePoint().padding(0.5)}
    {xDomain}
    {yDomain}
    {data}
  >
    <Svg>
      <AxisY />
      <AxisX />
      <Line />
    </Svg>
  </LayerCake>
</div>
```

### Composants non encore implémentés

Si un type de graphique n'est pas disponible (bar chart, pie chart, etc.), **demander à l'utilisateur** avant de l'implémenter.
