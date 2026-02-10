# Page d'Administration

Documentation complète de l'interface d'administration de NosElus.

## Vue d'ensemble

La page d'administration (`/admin`) permet de gérer manuellement les positions politiques des groupes parlementaires sur l'échiquier gauche-droite, et de contrôler la protection contre l'écrasement automatique des positions par l'ETL ParlGov.

## Accès et Authentification

### Configuration

L'accès à la page admin est protégé par un mot de passe simple configuré via la variable d'environnement :

```bash
ADMIN_PASSWORD=votre-mot-de-passe-securise
```

**Important** :

- Utilisez un mot de passe fort en production
- La variable doit être définie au démarrage du serveur
- Pas de longueur minimale imposée (utile pour les environnements de développement)

### Mécanisme d'authentification

L'authentification utilise un cookie de session signé avec HMAC-SHA256 :

- **Cookie** : `noselus-admin-session`
- **Format** : `{timestamp}.{signature}`
- **Durée** : 24 heures
- **Sécurité** : `httpOnly`, `sameSite=lax`, `secure` en production
- **Signature** : HMAC-SHA256 basé sur `ADMIN_PASSWORD`

Avantages :

- Pas de dépendance externe (utilise `crypto` natif Node.js)
- Pas besoin de JWT_SECRET séparé
- Validation timing-safe du mot de passe

## Fonctionnalités

### 1. Édition des Positions Politiques

Interface de gestion des positions pour les trois chambres parlementaires :

#### Assemblée nationale (AN)

- **Filtre** : Par législature (12e à 17e)
- **Groupes** : ~94 groupes parlementaires
- **Positions** : 0.0 (extrême gauche) à 10.0 (extrême droite), 999 (non-inscrits)

#### Parlement européen (PE)

- **Filtre** : Par terme (6e à 10e)
- **Groupes** : ~49 groupes parlementaires européens
- **Positions** : Même échelle que l'AN

#### Sénat

- **Filtre** : "Groupes actuels" vs "Groupes historiques"
- **Groupes** : ~28 groupes sénatoriaux
- **Note** : Le Sénat n'utilise pas de législatures numériques mais des renouvellements

### 2. Protection ETL

Chaque chambre possède un switch de protection individuel :

```
✅ Protégé : Les positions ne seront PAS écrasées par l'import automatique ParlGov
⚠️  Non protégé : Les positions PEUVENT être écrasées par l'import automatique
```

**Cas d'usage** :

- Activer la protection après avoir défini manuellement des positions pour une chambre
- Désactiver pour réimporter les positions automatiquement depuis ParlGov

**Persistance** : Les switches sont stockés dans la table `admin_settings` avec les clés :

- `etl_protect_an`
- `etl_protect_pe`
- `etl_protect_senat`

### 3. Gestion des Doublons

L'interface déduplique automatiquement les groupes qui partagent le même sigle dans la même chambre/législature :

- **Critère** : Garde le groupe avec la `start_date` la plus récente
- **Raison** : Gère les cas de dissolution/reconstitution (ex: AN 17e législature)

## Utilisation

### Se connecter

1. Accéder à `/admin`
2. Entrer le mot de passe configuré dans `ADMIN_PASSWORD`
3. Cliquer sur "Se connecter"

Si `ADMIN_PASSWORD` n'est pas configuré, un message d'erreur s'affiche.

### Modifier une position

1. Sélectionner la chambre (onglets en haut)
2. Optionnel : Filtrer par mandature
3. Modifier la valeur de position (input numérique)
4. Cliquer sur "Sauvegarder" (activé uniquement si la valeur a changé)

**Validation** :

- Position entre 0 et 999
- Pas de décimale (arrondi au 0.1 près)
- Retourne une erreur 404 si le groupe n'existe plus

### Activer/désactiver la protection ETL

1. Sélectionner la chambre
2. Cocher/décocher la case "Protéger les positions contre l'ETL automatique"
3. Le changement est immédiat (pas de bouton de sauvegarde)

## Architecture Technique

### Fichiers clés

| Fichier                                      | Rôle                                    |
| -------------------------------------------- | --------------------------------------- |
| `src/lib/server/auth.ts`                     | Fonctions d'authentification HMAC       |
| `src/routes/admin/+layout.server.ts`         | Guard d'authentification                |
| `src/routes/admin/+page.server.ts`           | Chargement des données + form actions   |
| `src/routes/admin/+page.svelte`              | Interface utilisateur (login + éditeur) |
| `src/lib/server/db/schema/admin-settings.ts` | Schéma DB pour les settings             |
| `scripts/etl/import-political-positions.ts`  | ETL avec respect des protections        |

### Form Actions

Le serveur expose 4 actions :

#### `?/login`

```typescript
POST /admin?/login
Body: { password: string }
Response: redirect 303 /admin (avec cookie)
Errors: 400 (missing), 401 (incorrect)
```

#### `?/logout`

```typescript
POST /admin?/logout
Response: redirect 303 /admin (sans cookie)
```

#### `?/updatePosition`

```typescript
POST /admin?/updatePosition
Body: { organId: string, position: number }
Response: { success: true }
Errors: 401 (non auth), 400 (invalid), 404 (not found), 500 (db error)
```

#### `?/toggleEtlProtection`

```typescript
POST /admin?/toggleEtlProtection
Body: { chamber: 'AN'|'PE'|'SENAT', enabled: 'true'|'false' }
Response: { success: true }
Errors: 401 (non auth), 400 (invalid chamber), 500 (db error)
```

**Note** : `toggleEtlProtection` utilise un upsert atomique (`onConflictDoUpdate`) pour éviter les race conditions.

### Base de données

#### Table `admin_settings`

```sql
CREATE TABLE admin_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
```

**Entrées** :

- `etl_protect_an` → `'true'` | `'false'`
- `etl_protect_pe` → `'true'` | `'false'`
- `etl_protect_senat` → `'true'` | `'false'`

### Déduplication des groupes

Logique dans `+page.server.ts` :

```typescript
const key = `${chamber}|${legislature || ''}|${shortName || id}`;
if (
	!existing ||
	(group.startDate && (!existing.startDate || group.startDate > existing.startDate))
) {
	deduped.set(key, group);
}
```

### Filtres par chambre

**AN/PE** : Législatures/termes numériques triés par ordre décroissant

```typescript
legislatures.AN.sort((a, b) => Number(b.value) - Number(a.value));
```

**Sénat** : Labels métier remplaçant les valeurs brutes

```typescript
legislaturesPerChamber.SENAT = [
	{ value: 'SENAT', label: 'Groupes actuels' },
	{ value: '__none__', label: 'Groupes historiques' }
];
```

Filtrage côté client avec `$derived.by` (Svelte 5) :

```typescript
const filteredGroups = $derived.by(() => {
	if (leg === '__none__') return groups.filter((g) => !g.legislature);
	return groups.filter((g) => g.legislature === leg);
});
```

## Sécurité

### Mesures implémentées

| Mesure                              | Implémentation                                             |
| ----------------------------------- | ---------------------------------------------------------- |
| **Timing-safe password comparison** | `timingSafeEqual()` dans `verifyAdminPassword()`           |
| **Signature HMAC des sessions**     | `createHmac('sha256', ADMIN_PASSWORD)`                     |
| **Cookie sécurisé**                 | `httpOnly=true`, `sameSite=lax`, `secure` en prod          |
| **Validation des entrées**          | Whitelist des chambres, validation numérique des positions |
| **Vérification d'authentification** | Middleware dans `hooks.server.ts`                          |
| **Protection CSRF**                 | SvelteKit `use:enhance` gère automatiquement               |

### Limitations

- **Mot de passe unique** : Pas de multi-utilisateurs
- **Pas de rate limiting** : Ajouter un middleware si exposition publique
- **Pas de logs d'audit** : Les modifications ne sont pas tracées

### Recommandations production

1. Utiliser un mot de passe fort (16+ caractères, mixte)
2. Activer HTTPS (automatique si reverse proxy configuré)
3. Considérer l'ajout de rate limiting (ex: 5 tentatives/minute)
4. Implémenter des logs d'audit si requis par la conformité
5. Restreindre l'accès réseau si possible (VPN, IP whitelist)

## Intégration ETL

Le script `scripts/etl/import-political-positions.ts` vérifie les protections avant d'écraser les positions :

```typescript
// Étape 4 : Charger les settings de protection
const protectSettings = await db
	.select()
	.from(adminSettings)
	.where(like(adminSettings.key, 'etl_protect_%'));

const protectedChambers = new Set(
	protectSettings
		.filter((s) => s.value === 'true')
		.map((s) => s.key.replace('etl_protect_', '').toUpperCase())
);

// Filtrer les résultats
const updatableResults = results.filter((r) => {
	if (protectedChambers.has(r.organ.chamber)) {
		// Skipper ce groupe
		return false;
	}
	return true;
});
```

**Comportement** :

- Chambre protégée : Les groupes sont skippés (comptés comme "not matched")
- Chambre non protégée : Les positions sont mises à jour normalement
- Mode `--dry-run` : Affiche ce qui serait fait sans modifier la DB

## Dépannage

### Le mot de passe ne fonctionne pas

1. Vérifier que `ADMIN_PASSWORD` est défini dans `.env`
2. Redémarrer le serveur Node.js (les variables d'env sont chargées au démarrage)
3. Vérifier qu'il n'y a pas d'espace avant/après le mot de passe

### Page blanche après login

1. Vérifier les logs serveur pour les erreurs
2. Ouvrir la console navigateur (F12)
3. Vérifier que le cookie `noselus-admin-session` est bien défini

### Les modifications ne sont pas sauvegardées

1. Vérifier l'authentification (bouton "Déconnexion" visible ?)
2. Vérifier que le bouton "Sauvegarder" est activé (bleu, pas grisé)
3. Vérifier les logs serveur pour les erreurs DB

### Le switch ETL ne fonctionne pas

1. Vérifier la connexion DB (table `admin_settings` existe ?)
2. Exécuter la migration : `npm run db:migrate`
3. Vérifier les permissions DB (INSERT/UPDATE sur `admin_settings`)

### Les groupes sont dupliqués

Ce n'est pas un bug : l'interface affiche tous les groupes (actuels + historiques) quand le filtre "Tous" est sélectionné. Utiliser le filtre par mandature pour voir uniquement une période.

## Migration et Déploiement

### Migration initiale

La migration `drizzle/migrations/0010_*.sql` crée la table `admin_settings`. Elle est vide initialement, les valeurs par défaut sont `false` (non protégé).

### Déploiement

1. S'assurer que `ADMIN_PASSWORD` est défini dans l'environnement
2. Exécuter les migrations : `npm run db:migrate`
3. Redémarrer l'application
4. Tester l'accès à `/admin`

### Rollback

Si besoin de revenir en arrière :

```sql
DROP TABLE admin_settings;
-- Puis réexécuter les migrations précédentes
```

Les fonctionnalités de positionnement politique existaient avant, seule la page admin et la protection ETL sont nouvelles.

## Développement

### Ajouter une nouvelle chambre

1. Ajouter la clé dans `chamberLabels` (`+page.svelte`)
2. Ajouter le filtre dans `legislaturesPerChamber` (`+page.server.ts`)
3. Ajouter la logique de déduplication si nécessaire
4. Ajouter le setting ETL dans `admin_settings`
5. Mettre à jour le script ETL

### Tester en local

```bash
# Définir le mot de passe
export ADMIN_PASSWORD=admin

# Lancer le serveur
npm run dev

# Tester l'authentification
curl -X POST http://localhost:5173/admin?/login \
  -d "password=admin" \
  -c cookies.txt

# Tester l'update de position
curl -X POST http://localhost:5173/admin?/updatePosition \
  -b cookies.txt \
  -d "organId=PO845419&position=2.5"
```

## Références

- [Pattern : Admin Chamber-Specific Filters](../.serena/memories/pattern-admin-chamber-specific-filters.md)
- [Lessons Learned : Admin Party Ordering](../.serena/memories/lessons-learned-2026-02-05-admin-party-ordering.md)
- [SvelteKit Form Actions](https://kit.svelte.dev/docs/form-actions)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/$derived)
