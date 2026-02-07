# Standard : ETL CLI Scripts

## Catégorie
ETL / Scripting / Developer Experience

## Règle

**Tous les scripts ETL doivent implémenter les options CLI standards suivantes** :

| Option | Flags | Type | Description | Requis |
|--------|-------|------|-------------|--------|
| `--dry-run` | `-n` | boolean | Simulation (pas d'écriture en base) | ✅ Obligatoire |
| `--limit` | `-l` | number | Nombre max d'entités à traiter | ✅ Obligatoire |
| `--verbose` | `-v` | boolean | Logs détaillés | ✅ Obligatoire |
| `--help` | `-h` | boolean | Affiche l'aide | ✅ Obligatoire |

Options additionnelles recommandées :
- `--force` : Ignore les checks de sécurité (avec avertissement)
- `--incremental` : Mode incrémental (seulement nouvelles données)
- `--resume` : Reprendre après échec (avec checkpoint)

## Justification

### Pourquoi `--dry-run` ?

**Problème** : ETL modifie la base de données. Erreur = données corrompues.

**Solution** : Mode simulation pour tester sans side-effects.

**Avantages** :
- Validation du script avant exécution réelle
- Debugging sans risque
- Estimation du nombre de modifications

### Pourquoi `--limit` ?

**Problème** : ETL peut traiter des millions d'entités. Test = attendre 3h.

**Solution** : Limiter le nombre d'entités pour tester rapidement.

**Avantages** :
- Tests rapides sur échantillon (ex: --limit 10)
- Validation incrémentale (ex: --limit 100, puis 1000, puis all)
- Économie de ressources (CPU, RAM, API calls)

### Pourquoi `--verbose` ?

**Problème** : ETL échoue. Logs insuffisants pour diagnostiquer.

**Solution** : Mode verbose pour logs détaillés.

**Avantages** :
- Debugging facilité (voir requêtes SQL, fetches HTTP, etc.)
- Traçabilité (savoir exactement ce qui a été fait)
- Monitoring (voir progression en temps réel)

### Pourquoi `--help` ?

**Problème** : Développeur ne sait pas quelles options sont disponibles.

**Solution** : Afficher l'aide avec `-h` ou `--help`.

**Avantages** :
- Self-documenting (pas besoin d'aller lire le code)
- UX standard (convention Unix)
- Exemples d'utilisation

## Exemples

### ✅ Script conforme

```typescript
// scripts/etl/enrich-europarl-law-texts.ts
import { parseArgs } from 'util';

interface Args {
  dryRun: boolean;
  limit: number;
  verbose: boolean;
  help: boolean;
}

function parseCliArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    limit: 100,
    verbose: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--dry-run':
      case '-n':
        args.dryRun = true;
        break;
      case '--limit':
      case '-l':
        args.limit = parseInt(argv[++i], 10) || 100;
        break;
      case '--verbose':
      case '-v':
        args.verbose = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage: npm run etl:europarl-law-texts [options]

Options:
  --dry-run, -n     Simulation (pas d'écriture en base)
  --limit N, -l N   Nombre max de lois à traiter (défaut: 100)
  --verbose, -v     Logs détaillés
  --help, -h        Affiche cette aide

Examples:
  npm run etl:europarl-law-texts
  npm run etl:europarl-law-texts -- --dry-run --limit 5
  npm run etl:europarl-law-texts -- -n -l 10 -v
`);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('Configuration:');
  console.log(`  Limite: ${args.limit} lois`);
  if (args.dryRun) {
    console.log("  Mode: DRY RUN (pas d'écriture en base)");
  }
  if (args.verbose) {
    console.log('  Mode verbeux activé');
  }

  const config = {
    dryRun: args.dryRun,
    limit: args.limit,
    verbose: args.verbose
  };

  const stats = await enrichPELawTexts(config);

  console.log('RÉSUMÉ');
  console.log(`  Lois traitées:   ${stats.total}`);
  console.log(`  Enrichies:       ${stats.updated}`);
  console.log(`  Ignorées:        ${stats.skipped}`);
  console.log(`  Erreurs:         ${stats.errors}`);
}

main();
```

### ❌ Script non conforme

```typescript
// ❌ MAUVAIS : Pas d'options CLI
async function main() {
  const laws = await db.select().from(laws);  // Traite TOUTES les lois
  
  for (const law of laws) {
    await enrichLaw(law);  // Écrit directement en base
    // Pas de logs, impossible de debugger
  }
}

main();
```

## Utilisation

### Exemples d'appel

```bash
# Test rapide (10 lois, dry-run)
npm run etl:europarl-law-texts -- --dry-run --limit 10

# Debugging (verbose)
npm run etl:europarl-law-texts -- --limit 5 --verbose

# Production (toutes les lois)
npm run etl:europarl-law-texts

# Aide
npm run etl:europarl-law-texts -- --help
```

### Workflow recommandé

```
1. Test dry-run minimal  : --dry-run --limit 1
   → Valide syntaxe, requêtes, API calls

2. Test dry-run élargi   : --dry-run --limit 10
   → Valide logique, edge cases

3. Test réel minimal     : --limit 10
   → Valide écriture DB, transactions

4. Test réel élargi      : --limit 100
   → Valide performance, mémoire

5. Production complète   : (pas de limit)
   → Exécution finale
```

## Intégration Makefile

```makefile
etl-europarl-law-texts: ## Enrichit les textes des lois PE (caches HTV + web)
	@echo "$(CYAN)Enrichissement des textes de lois PE...$(RESET)"
	npm run etl:europarl-law-texts

etl-europarl-law-texts-dry: ## [DRY RUN] Test enrichissement PE
	@echo "$(YELLOW)[DRY RUN] Test enrichissement PE (10 lois)...$(RESET)"
	npm run etl:europarl-law-texts -- --dry-run --limit 10 --verbose
```

Usage :
```bash
make etl-europarl-law-texts-dry  # Test
make etl-europarl-law-texts      # Production
```

## Gestion des erreurs

```typescript
try {
  const stats = await enrichPELawTexts(config);
  
  if (stats.errors > 0) {
    console.error(`⚠️  ${stats.errors} erreur(s) rencontrée(s)`);
    process.exit(1);  // Exit code 1 = échec
  }
  
  process.exit(0);  // Exit code 0 = succès
} catch (error) {
  console.error('Erreur fatale:', error);
  process.exit(1);
}
```

**Pourquoi** : Exit codes permettent de chaîner scripts (`make etl-all` s'arrête si échec).

## Logs structurés

```typescript
if (config.verbose) {
  console.log(`[PE Law Texts] Traitement de ${reference}: ${law.title}`);
  console.log(`  → Fetch: ${url}`);
  console.log(`  → Récupéré: ${text.length} chars`);
}

// Toujours logger les actions importantes
console.log(`[PE Law Texts] ${peLaws.length} lois PE trouvées`);
console.log(`[PE Law Texts] ${cacheMap.size} caches HTV chargés`);

// Résumé final (toujours affiché)
console.log('='.repeat(60));
console.log('RÉSUMÉ');
console.log('='.repeat(60));
console.log(`  Lois traitées:   ${stats.total}`);
console.log(`  Enrichies:       ${stats.updated}`);
console.log(`  Ignorées:        ${stats.skipped}`);
console.log(`  Erreurs:         ${stats.errors}`);
console.log('='.repeat(60));
```

## Template de script ETL

```typescript
import { parseArgs } from 'util';

interface Args {
  dryRun: boolean;
  limit: number;
  verbose: boolean;
  help: boolean;
}

function parseCliArgs(argv: string[]): Args {
  // ... (voir exemple ci-dessus)
}

function printHelp() {
  // ... (voir exemple ci-dessus)
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('='.repeat(60));
  console.log('NosElus ETL - [Nom du script]');
  console.log('Source: [Description source]');
  console.log('='.repeat(60));
  console.log('');

  console.log('Configuration:');
  console.log(`  Limite: ${args.limit} entités`);
  if (args.dryRun) console.log("  Mode: DRY RUN");
  if (args.verbose) console.log('  Mode verbeux activé');
  console.log('');

  try {
    const config = {
      dryRun: args.dryRun,
      limit: args.limit,
      verbose: args.verbose
    };

    const stats = await runETL(config);

    console.log('');
    console.log('='.repeat(60));
    console.log('RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`  Total:     ${stats.total}`);
    console.log(`  Succès:    ${stats.inserted}`);
    console.log(`  Erreurs:   ${stats.errors}`);
    console.log('='.repeat(60));

    process.exit(stats.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error('Erreur fatale:', error);
    process.exit(1);
  }
}

main();
```

## Exceptions

**Quand peut-on déroger ?**

- Script one-shot (jamais réutilisé) → `--help` optionnel
- Script très simple (<50 lignes) → `--verbose` optionnel
- Import initial (jamais ré-exécuté) → `--incremental` non pertinent

**Mais** : `--dry-run` et `--limit` restent **toujours obligatoires** (sécurité).

## Vérification

### Checklist de review

- [ ] Script a `--dry-run` / `-n`
- [ ] Script a `--limit` / `-l` avec défaut raisonnable (< 1000)
- [ ] Script a `--verbose` / `-v`
- [ ] Script a `--help` / `-h` avec exemples
- [ ] Dry-run n'écrit jamais en base
- [ ] Verbose affiche logs utiles
- [ ] Help affiche toutes les options
- [ ] Exit codes corrects (0 = succès, 1 = échec)
- [ ] Résumé final affiché
- [ ] Intégré dans Makefile
- [ ] Documenté dans README ou docs/

## Date d'adoption

2026-02-07

## Références

- **Exemple conforme** : `scripts/etl/enrich-europarl-law-texts.ts`
- **Template** : `scripts/etl/import-europarl-laws.ts`
- **Makefile rule** : `etl-makefile-rule.md`

## Voir aussi

- `etl-makefile-rule.md` : Intégration Makefile des scripts ETL
- [POSIX Utility Conventions](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap12.html) : Standards CLI
