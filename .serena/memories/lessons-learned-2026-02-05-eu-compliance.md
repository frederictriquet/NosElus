# Lessons Learned — Session EU Compliance (2026-02-05)

## Contexte
Ajout de pages légales (mentions légales, politique de confidentialité), marquage IA, liens footer.

## Leçons

### 1. TOUJOURS générer du français avec accents (UTF-8)
**Problème** : Les deux pages légales (155+ lignes chacune) ont été générées sans aucun accent français.
"Mentions legales", "donnees", "Frederic", "confidentialite" etc.
**Impact** : Blocker en code review — pages juridiques illisibles.
**Règle** : Lors de la génération de contenu textuel français, TOUJOURS utiliser les caractères accentués :
é, è, ê, ë, à, â, ù, û, ô, î, ï, ç, œ, æ.
Vérifier après écriture avec `grep -P '[éèêëàâùûôîïçœæ]'` pour confirmer leur présence.

### 2. Bandeau cookies : inutile pour cookies fonctionnels
**Problème** : Implémenté un bandeau cookie complet (store + composant + modification chamber-period.ts) qui n'a jamais fonctionné correctement (CSS invisible, imports cassés) et qui s'est avéré inutile.
**Raison** : La CNIL exempte les cookies strictement fonctionnels du consentement préalable.
Un bandeau purement informatif sans blocage n'a aucune utilité juridique.
**Règle** : Avant d'implémenter un mécanisme de consentement, vérifier si les cookies sont exemptés.

### 3. CSS partagé entre pages → app.css
**Problème** : CSS dupliqué identique (55 lignes) entre mentions-legales et politique-de-confidentialite.
**Solution** : Extraire dans `app.css` les classes `.legal-content` / `.legal-section` partagées.
Ne garder dans les composants que les styles spécifiques.

### 4. Imports entre stores Svelte : attention aux cascades
**Problème** : Importer `cookieConsent` dans `chamber-period.ts` a causé une erreur runtime côté client qui a cassé à la fois le CookieBanner et la sélection de période (car CookieBanner importait chamberPeriodStore).
**Règle** : Éviter les dépendances croisées entre stores. Si un store A importe un store B, tout composant important A hérite aussi de B et de ses erreurs potentielles.
