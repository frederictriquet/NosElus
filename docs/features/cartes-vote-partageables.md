# Fonctionnalité : Cartes de vote partageables

## Contexte

La désinformation politique circule principalement sur les réseaux sociaux, sous forme de posts texte ou d'images. Pour contrer ça à la source, NosElus doit produire des contenus dans le même format : des visuels compacts, lisibles sur mobile, faciles à copier-coller ou partager.

## Principe

Pour chaque scrutin parlementaire, générer automatiquement une "carte" :

- Titre en français simple (pas le titre juridique de la loi)
- Résultat du vote par groupe politique (✅/❌/🟡 pour, contre, abstention)
- Date et lien vers la source officielle (Assemblée Nationale)
- Design sobre, crédible, identifiable NosElus

## Formats cibles

### Format texte (copier-coller direct)

```
📊 VOTE : Augmentation du SMIC à 1500€ net
📅 20 juillet 2022 — Assemblée Nationale

✅ Pour : NFP (100%), PCF (100%)
❌ Contre : RN (94%), LR (87%), Ensemble (72%)
🟡 Abstention : —

Source officielle : nosElus.fr/scrutin/XXX
```

### Format image (OG card / PNG téléchargeable)

- Généré côté serveur (Sveltekit + canvas ou service externe)
- Dimensions : 1200×630px (standard Open Graph)
- Utilisable directement sur Twitter/X, Facebook, WhatsApp

### URL partageable avec preview riche

- `nosElus.fr/scrutin/[id]` → meta OG tags avec la carte en image
- Quand quelqu'un partage le lien, la carte apparaît en aperçu

## Approche technique

### Texte

- Trivial à implémenter : formatter les données existantes en markdown/texte
- Bouton "Copier" sur chaque page de scrutin

### Image (OG card dynamique)

- Option A : `@vercel/og` ou `satori` (génération SVG→PNG en edge function)
- Option B : route SvelteKit `/og/scrutin/[id].png` avec `canvas` Node.js
- Option C : service tiers (Cloudinary, Bannerbear) — plus simple mais coût

### Partage natif mobile

- Web Share API (`navigator.share()`) pour iOS/Android
- Fallback copie dans le presse-papier

## Ce qu'il faut résoudre

- **Titre en langage simple** : le titre juridique ("PPL visant à instituer...") doit être traduit. Peut être fait manuellement pour les scrutins majeurs, ou via LLM.
- **Crédibilité visuelle** : le design doit inspirer confiance (pas de couleurs partisanes, logo NosElus visible, lien source)

## Prochaines étapes suggérées

1. Ajouter un champ `title_simple` (nullable) sur la table `scrutins` pour les titres traduits
2. Implémenter le bouton "Copier le résumé" (format texte, 1 jour de dev)
3. Implémenter l'OG image dynamique (format image, 2-3 jours)
4. Tester la viralité sur quelques scrutins emblématiques
