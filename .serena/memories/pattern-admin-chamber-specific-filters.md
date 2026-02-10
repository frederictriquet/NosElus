# Pattern : Filtres par Chambre avec Données Spécifiques

## Problème

Certaines chambres (AN, PE, SENAT) utilisent des concepts différents pour organiser leurs groupes parlementaires :

- AN/PE : législatures numériques (15, 16, 17 ou 8, 9, 10)
- SENAT : pas de législatures, mais "SENAT" pour actuels ou NULL pour historiques

Afficher des valeurs brutes comme "SENAT" ou "—" n'est pas clair pour l'utilisateur.

## Contexte

Utiliser ce pattern quand :

- Une interface affiche des données de multiples chambres avec des onglets
- Chaque chambre a son propre système de classification
- Les valeurs brutes de la DB ne sont pas user-friendly

## Solution

Séparer la **valeur** (pour le filtrage) du **label** (pour l'affichage) :

1. **Côté serveur** : retourner `{value, label}[]` au lieu de `string[]`
2. **Côté client** : fonction de mapping spécifique par chambre pour l'affichage dans les tableaux

## Code

### Serveur (`+page.server.ts`)

```typescript
// Structure avec value/label
const legislaturesPerChamber: Record<string, { value: string; label: string }[]> = {
	AN: [],
	PE: [],
	SENAT: []
};

// Extraire les législatures de AN/PE
for (const group of groups) {
	if (chamber === 'AN' || chamber === 'PE') {
		legislaturesPerChamber[chamber].push({ value: leg, label: leg });
	}
}

// Cas spécial Sénat : remplacer par labels métier
legislaturesPerChamber.SENAT = [
	{ value: 'SENAT', label: 'Groupes actuels' },
	{ value: '__none__', label: 'Groupes historiques' }
];
```

### Client (`+page.svelte`)

```typescript
// Filtre avec gestion du cas '__none__'
const filteredGroups = $derived(() => {
	const groups = data.groups[activeChamber] ?? [];
	const leg = selectedLegislature[activeChamber];
	if (!leg) return groups;
	if (leg === '__none__') return groups.filter((g) => !g.legislature);
	return groups.filter((g) => g.legislature === leg);
});

// Fonction de display pour la colonne du tableau
function getLegislatureDisplay(chamber: string, leg: string | null): string {
	if (!leg) return '—';
	if (chamber === 'SENAT') return leg === 'SENAT' ? 'Actuel' : leg;
	return leg;
}
```

```svelte
<!-- Select dropdown -->
<select bind:value={selectedLegislature[activeChamber]}>
	<option value="">Tous</option>
	{#each data.legislatures[activeChamber] as leg}
		<option value={leg.value}>
			{chamber === 'SENAT' ? leg.label : legislatureLabels[chamber](leg.value)}
		</option>
	{/each}
</select>

<!-- Colonne du tableau -->
<td>{getLegislatureDisplay(activeChamber, group.legislature)}</td>
```

## Avantages

- Labels clairs et compréhensibles pour l'utilisateur
- Logique métier centralisée côté serveur
- Filtre fonctionnel malgré les différences de données
- Facilite l'ajout de nouvelles chambres avec leurs propres règles

## Inconvénients

- Complexité accrue vs simple array de strings
- Nécessite une fonction de mapping par contexte d'affichage

## Exemples d'utilisation

- `src/routes/admin/+page.server.ts:48-70` - Construction des filtres par chambre
- `src/routes/admin/+page.svelte:18-26` - Filtrage avec gestion `__none__`
- `src/routes/admin/+page.svelte:48-53` - Fonction getLegislatureDisplay

## Voir aussi

- Pattern : Component avec onglets multi-chambres
- Standard : Toujours séparer value/label dans les dropdowns
