# Product

## Register

product

## Users

Citoyens français souhaitant vérifier les votes et positions de leurs élus,
militants et chercheurs en quête de données parlementaires fiables, grand public
qui fact-checke des affirmations politiques sur les réseaux sociaux. Contexte
d'utilisation : souvent depuis un lien partagé, avec une question précise en
tête.

## Product Purpose

NosElus permet de consulter les votes, l'activité et les positions des élus
des trois chambres françaises (Assemblée nationale, Sénat, Parlement européen).
Promesse : comprendre concrètement comment ses représentants ont voté, sans
expertise parlementaire préalable. Succès = l'utilisateur repart avec une
réponse factuelle à sa question.

## Brand Personality

Clair, honnête, digne de confiance. Ton sobre et direct, sans affect partisan.
NosElus ne prend pas de position — il donne les faits.

## Anti-references

- Sites gouvernementaux français : trop austères, froids, institutionnels
- Dashboards BI corporate : trop de chrome, tableaux surchargés, jargon métier
- Applications politiques partisanes : couleurs trop vives, biais visuels,
  mise en scène éditoriale

## Design Principles

1. **La confiance se gagne par la rigueur.** Données sourcées, logique visible,
   aucune mise en scène éditoriale. La crédibilité vient de la précision, pas
   du marketing.
2. **Neutre par conception.** Les choix visuels ne doivent jamais suggérer
   d'orientation politique. Les couleurs portent du sens de données
   (pour/contre/abstention), jamais une identité partisane.
3. **L'interface sert la donnée.** Aucun élément décoratif qui ne serve pas
   à trouver ou comprendre une information. Moins de chrome, plus de clarté.
4. **Accessibilité structurelle.** Pas une couche ajoutée après coup — chaque
   composant est conçu accessible dès le départ. WCAG AA minimum sur toutes
   les surfaces.
5. **Clarté avant élégance.** Si un choix rend les données plus difficiles à
   lire, il est mauvais quelle que soit son esthétique.

## Accessibility & Inclusion

Accessibilité très importante. Thème high-contrast déjà implémenté. Cible :
WCAG AA sur toutes les surfaces, AAA sur les éléments critiques (données de
vote, navigation principale). Support reduced-motion. Attention particulière
aux contrastes des couleurs sémantiques (vert/rouge/amber).
