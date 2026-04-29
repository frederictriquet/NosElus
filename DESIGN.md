---
name: NosElus
description: Plateforme de transparence parlementaire française — données civiques sans détour
colors:
  primary: '#2563eb'
  primary-dark: '#1d4ed8'
  success: '#22c55e'
  danger: '#ef4444'
  warning: '#f59e0b'
  neutral-absent: '#94a3b8'
  neutral-bg: '#f8fafc'
  neutral-surface: '#ffffff'
  neutral-text: '#1e293b'
  neutral-text-muted: '#64748b'
  neutral-border: '#e2e8f0'
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: '2rem'
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: '1.25rem'
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: '0.75rem'
    fontWeight: 400
    lineHeight: 1.4
rounded:
  default: '0.5rem'
  lg: '0.75rem'
  full: '9999px'
spacing:
  xs: '0.25rem'
  sm: '0.5rem'
  md: '1rem'
  lg: '1.5rem'
  xl: '2rem'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '#ffffff'
    rounded: '{rounded.default}'
    padding: '0.5rem 1rem'
    typography: 'label'
  button-primary-hover:
    backgroundColor: '{colors.primary-dark}'
    textColor: '#ffffff'
    rounded: '{rounded.default}'
    padding: '0.5rem 1rem'
    typography: 'label'
  button-secondary:
    backgroundColor: '{colors.neutral-surface}'
    textColor: '{colors.neutral-text}'
    rounded: '{rounded.default}'
    padding: '0.5rem 1rem'
    typography: 'label'
  button-secondary-hover:
    backgroundColor: '{colors.neutral-bg}'
    textColor: '{colors.neutral-text}'
    rounded: '{rounded.default}'
    padding: '0.5rem 1rem'
    typography: 'label'
  input:
    backgroundColor: '{colors.neutral-surface}'
    textColor: '{colors.neutral-text}'
    rounded: '{rounded.default}'
    padding: '0.5rem 1rem'
    typography: 'body'
  badge:
    backgroundColor: '{colors.neutral-bg}'
    textColor: '{colors.neutral-text}'
    rounded: '{rounded.full}'
    padding: '0.125rem 0.5rem'
    typography: 'caption'
  badge-group:
    backgroundColor: '{colors.primary}'
    textColor: '#ffffff'
    rounded: '{rounded.full}'
    padding: '0.125rem 0.5rem'
    typography: 'caption'
---

# Design System: NosElus

## 1. Overview

**Creative North Star: "Le Bureau du Citoyen"**

NosElus est un espace de travail civique : sobre, rangé, efficace. L'utilisateur arrive avec une question précise — qui a voté quoi, quel groupe s'est positionné comment — et l'interface lui répond sans détour. Aucun geste éditorial ne s'interpose entre l'élu et la donnée. La confiance se construit par la précision, pas par la mise en scène.

Le système visuel est **Restrained** : des neutres teintés d'ardoise, un seul accent primaire utilisé avec parcimonie. Les couleurs sémantiques (vert/rouge/ambre) portent le sens des votes, elles ne décorent pas. Les surfaces sont plates au repos ; les ombres répondent à l'interaction. Toute couleur qui ne transporte pas d'information est supprimée.

Ce que ce système refuse : l'austérité froide des sites gouvernementaux français, le chrome surchargé des dashboards corporate, les palettes saturées des applications politiques partisanes. NosElus n'a pas de parti pris visuel — la neutralité est structurelle.

**Key Characteristics:**

- Densité modérée : les données respirent sans générosité excessive
- Plat au repos, réactif aux états — les ombres signalent l'interaction, pas la hiérarchie
- Hiérarchie typographique par taille et poids uniquement, jamais par couleur d'accentuation
- Couleurs sémantiques (vert/rouge/ambre) strictement réservées aux résultats de vote
- Accessibilité structurelle : WCAG AA sur toutes les surfaces, thème high-contrast natif

## 2. Colors: La Palette Ardoise

Neutrals teintés de bleu-ardoise pour le fond et la structure. Un seul accent primaire. Une triade sémantique réservée aux données de vote.

### Primary

- **Bleu République** (`#2563eb`): L'unique accent. Boutons d'action primaire, liens actifs, indicateurs d'état sélectionné, bordure de focus. Jamais comme fond de surface étendue.
- **Bleu République Profond** (`#1d4ed8`): État hover et actif du primaire exclusivement.

### Neutral

- **Brume Ardoise** (`#f8fafc`): Fond de page. La couche la plus basse du système.
- **Blanc Bureau** (`#ffffff`): Surface des cartes, inputs, dropdowns — tout ce qui s'élève au-dessus du fond.
- **Encre Profonde** (`#1e293b`): Texte principal. Dense sans être noir pur.
- **Ardoise Secondaire** (`#64748b`): Texte de support, métadonnées, labels de second plan.
- **Liséré Discret** (`#e2e8f0`): Bordures et séparateurs au repos. Remplace l'ombre sur les cartes statiques.

### Semantic (données de vote uniquement)

- **Vert Suffrage** (`#22c55e`): Votes "Pour". Réservé aux résultats de vote.
- **Rouge Opposition** (`#ef4444`): Votes "Contre". Réservé aux résultats de vote.
- **Ambre Réserve** (`#f59e0b`): Abstentions. Réservé aux résultats de vote.
- **Gris Absence** (`#94a3b8`): Non-votants. Silencieux par nature.

**The Neutrality Rule.** Les couleurs sémantiques (vert, rouge, ambre) sont réservées aux données de vote. Leur usage ailleurs — alerte UI, badge de statut, icône décorative — est interdit. Sur NosElus, rouge signifie "contre", pas "erreur".

**The One Voice Rule.** Le Bleu République occupe ≤10% d'une surface donnée. Sa rareté est le point.

## 3. Typography

**Font unique:** Inter (avec fallback `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)

Système mono-familial. Inter est choisi pour sa lisibilité à toutes tailles et son registre neutre : fonctionnel sans être froid, adapté aux données tabulaires comme aux textes courants.

**Character:** Une seule voix, modulée par la taille et le poids. La hiérarchie est lisible d'un coup d'œil sans décoration ajoutée.

### Hierarchy

- **Display** (700, 2rem, lh 1.25): Titres de page. Un seul par vue.
- **Headline** (600, 1.25rem, lh 1.4): En-têtes de cartes et sections principales.
- **Title** (600, 1rem, lh 1.5): Sous-sections, labels de blocs de données.
- **Body** (400, 1rem, lh 1.6): Texte courant. Maximum 65-75ch de large.
- **Label** (500, 0.875rem, lh 1.4): Boutons, onglets, en-têtes de colonnes.
- **Caption** (400, 0.75rem, lh 1.4): Badges de vote, métadonnées de second plan.

**The Single Scale Rule.** Taille et poids uniquement pour la hiérarchie. Pas d'italique décoratif, pas de lettre-espacement modifié sur le body, pas de UPPERCASE sauf sur les badges de vote où la contrainte de densité l'exige.

## 4. Elevation

Les surfaces de NosElus sont **plates au repos**. Les ombres répondent à l'interaction — un dropdown qui s'ouvre, une carte au survol, un modal qui s'élève. L'absence d'ombre est l'état naturel. La bordure `Liséré Discret` remplace l'ombre sur les cartes et conteneurs statiques.

### Shadow Vocabulary

- **Ambient** (`0 1px 2px rgba(0,0,0,0.05)`): Hover léger sur une carte interactive.
- **Elevated** (`0 4px 6px rgba(0,0,0,0.1)`): Dropdowns et sélecteurs flottants ouverts.
- **Modal** (`0 4px 12px rgba(0,0,0,0.15)`): Couche modale au-dessus de tout.

**The Flat-By-Default Rule.** Une carte au repos n'a pas d'ombre — elle a une bordure. L'ombre apparaît uniquement quand un élément passe en état interactif ou flottant. Si tu t'apprêtes à ajouter `box-shadow` à un composant statique, utilise `border: 1px solid #e2e8f0` à la place.

## 5. Components

### Buttons

Direct et confiant. Arrondi discret (8px), compact, retour d'état immédiat.

- **Shape:** Gently rounded (0.5rem / 8px)
- **Primary:** Bleu République (#2563eb) fond, blanc texte, padding `0.5rem 1rem`, Label 500 0.875rem
- **Hover:** Bleu République Profond (#1d4ed8), transition `all 0.2s`
- **Focus ring:** `0 0 0 3px rgba(37,99,235,0.1)` — visible, jamais absent
- **Secondary:** Blanc Bureau fond, Encre Profonde texte, bordure Liséré Discret. Hover: fond Brume Ardoise, bordure Ardoise Secondaire.

### Chips / Badges

- **Neutre:** fond Brume Ardoise, texte Encre Profonde, pill (9999px), Caption 0.75rem
- **Groupe parlementaire:** fond Bleu République, blanc texte — identifie l'appartenance sans ambiguïté
- **Vote (pour/contre/abstention):** couleurs sémantiques strictes, fond teinté à 15% + texte foncé de même hue

### Cards / Containers

Compact et fonctionnel. Les cartes délimitent des unités de données, elles ne créent pas d'atmosphère.

- **Corner Style:** Gently rounded (0.75rem / 12px)
- **Background:** Blanc Bureau (#ffffff)
- **Shadow Strategy:** Plat par défaut. Bordure Liséré Discret (1px) au repos. Ombre Ambient uniquement au hover interactif.
- **Internal Padding:** 1.5rem

### Inputs / Fields

- **Style:** fond Blanc Bureau, bordure Liséré Discret (1px), rayon 0.5rem, Body 1rem
- **Focus:** bordure Bleu République + ring `0 0 0 3px rgba(37,99,235,0.1)`
- **Placeholder:** Ardoise Secondaire (#64748b)
- **Disabled:** opacité 0.5, curseur interdit

### Navigation

- **Header:** fond Blanc Bureau, bordure basse Liséré Discret (1px), hauteur 56px
- **Logo:** "NosElus", Title 600 1rem, Encre Profonde — texte seul, pas d'icône
- **Chamber tabs:** Label 500, Ardoise Secondaire au repos; Bleu République + underline 2px à l'actif. Pas de fond sur l'onglet actif.
- **Utility links:** icône + label, hauteur min 36px, padding `0.5rem 0.75rem`, hover: fond Brume Ardoise

### Vote Distribution Bar (composant signature)

La barre de répartition est le composant visuel le plus distinctif de NosElus.

- Barre horizontale segmentée : Vert Suffrage / Rouge Opposition / Ambre Réserve / Gris Absence
- Hauteur 8px, border-radius 4px, segments séparés par 1px de gap
- Labels de pourcentage en Caption 0.75rem, couleur foncée correspondant au segment
- Aucune ombre, aucune bordure extérieure — la couleur sémantique suffit
- Transition `width 0.3s cubic-bezier(0, 0, 0.2, 1)` sur les segments (chargement de données)

### Tabs

- Padding `0.75rem 1.5rem`, fond transparent, Label 500
- Ardoise Secondaire au repos, hover: Encre Profonde
- Actif: Bleu République texte + bordure basse 2px Bleu République
- Pas de fond sur l'onglet actif — la ligne suffit

## 6. Do's and Don'ts

### Do:

- **Do** utiliser le Bleu République uniquement pour signaler une action ou un état actif.
- **Do** réserver vert (#22c55e), rouge (#ef4444) et ambre (#f59e0b) aux seules données de vote. Pour un état de succès UI, utiliser une teinte d'ardoise ou du texte.
- **Do** laisser les surfaces plates au repos. Bordure Liséré Discret à la place d'une ombre permanente.
- **Do** exprimer la hiérarchie par la taille et le poids uniquement.
- **Do** respecter une largeur maximale de 65-75ch sur tout bloc de prose.
- **Do** viser WCAG AA sur toutes les surfaces, AAA sur les données de vote et la navigation.
- **Do** rendre le focus ring visible sur tous les éléments interactifs : `0 0 0 3px rgba(37,99,235,0.1)` minimum.

### Don't:

- **Don't** reproduire l'austérité froide des sites gouvernementaux français : pas de fond gris béton, pas de bleu marine institutionnel couvrant, pas de typographie condensée non aérée.
- **Don't** tomber dans le dashboard corporate : pas de hero-metric (grand nombre + petit label + gradient d'accent), pas de tableaux surchargés de chrome.
- **Don't** utiliser des couleurs vives ou partisanes. La palette ne doit jamais évoquer une couleur politique identifiable (bleu RN, rouge PS, vert EELV, etc.).
- **Don't** ajouter `border-left` ou `border-right` supérieur à 1px comme stripe coloré sur une carte ou un item de liste. Retravailler avec un fond teinté ou une bordure complète.
- **Don't** utiliser `background-clip: text` avec un gradient. Couleur solide uniquement.
- **Don't** dupliquer les couleurs sémantiques hors de leur contexte de vote — The Neutrality Rule s'applique partout.
- **Don't** ouvrir une modale comme première réponse à un besoin d'interaction. Épuiser les alternatives inline d'abord.
- **Don't** ajouter des ombres à des composants statiques. The Flat-By-Default Rule.
