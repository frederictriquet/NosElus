#!/usr/bin/env node

/**
 * Post-processing des migrations Drizzle pour les rendre idempotentes.
 *
 * Transforme automatiquement le SQL généré par drizzle-kit generate :
 * - CREATE TABLE → CREATE TABLE IF NOT EXISTS
 * - CREATE INDEX → CREATE INDEX IF NOT EXISTS
 * - CREATE UNIQUE INDEX → CREATE UNIQUE INDEX IF NOT EXISTS
 * - ALTER TABLE ADD COLUMN → ADD COLUMN IF NOT EXISTS
 * - DROP TABLE → DROP TABLE IF EXISTS
 * - DROP INDEX → DROP INDEX IF EXISTS
 * - DROP COLUMN → DROP COLUMN IF EXISTS
 *
 * Les cas suivants nécessitent une intervention manuelle :
 * - ALTER TABLE ADD CONSTRAINT → Wrapper PL/pgSQL (voir pattern-idempotent-migrations.md)
 * - INSERT → Ajouter ON CONFLICT DO NOTHING
 *
 * Voir ADR-005 : adr-2026-02-06-idempotent-migrations.md
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'drizzle', 'migrations');

function getLatestMigration() {
	const files = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith('.sql'))
		.sort();
	return files.length > 0 ? files[files.length - 1] : null;
}

function makeIdempotent(sql) {
	let result = sql;
	const warnings = [];

	// CREATE TABLE → CREATE TABLE IF NOT EXISTS
	result = result.replace(/CREATE TABLE "(\w+)"/g, 'CREATE TABLE IF NOT EXISTS "$1"');

	// CREATE INDEX → CREATE INDEX IF NOT EXISTS
	result = result.replace(/CREATE INDEX "(\w+)"/g, 'CREATE INDEX IF NOT EXISTS "$1"');

	// CREATE UNIQUE INDEX → CREATE UNIQUE INDEX IF NOT EXISTS
	result = result.replace(/CREATE UNIQUE INDEX "(\w+)"/g, 'CREATE UNIQUE INDEX IF NOT EXISTS "$1"');

	// ALTER TABLE ... ADD COLUMN → ADD COLUMN IF NOT EXISTS
	result = result.replace(
		/ALTER TABLE "(\w+)" ADD COLUMN "(\w+)"/g,
		'ALTER TABLE "$1" ADD COLUMN IF NOT EXISTS "$2"'
	);

	// DROP TABLE → DROP TABLE IF EXISTS
	result = result.replace(/DROP TABLE "(\w+)"/g, 'DROP TABLE IF EXISTS "$1"');

	// DROP INDEX → DROP INDEX IF EXISTS
	result = result.replace(/DROP INDEX "(\w+)"/g, 'DROP INDEX IF EXISTS "$1"');

	// ALTER TABLE ... DROP COLUMN → DROP COLUMN IF EXISTS
	result = result.replace(
		/ALTER TABLE "(\w+)" DROP COLUMN "(\w+)"/g,
		'ALTER TABLE "$1" DROP COLUMN IF EXISTS "$2"'
	);

	// Détection des cas nécessitant intervention manuelle
	const constraintMatches = result.match(/ADD CONSTRAINT/g);
	if (constraintMatches) {
		warnings.push(
			`⚠️  ${constraintMatches.length} ADD CONSTRAINT trouvé(s) — nécessite review manuelle (PL/pgSQL IF NOT EXISTS)`
		);
	}

	const insertMatches = result.match(/INSERT INTO/g);
	if (insertMatches) {
		// Vérifier si ON CONFLICT est déjà présent
		const insertWithoutConflict = result.match(/INSERT INTO(?![\s\S]*?ON CONFLICT)/g);
		if (insertWithoutConflict && insertWithoutConflict.length > 0) {
			warnings.push(
				`⚠️  ${insertWithoutConflict.length} INSERT sans ON CONFLICT trouvé(s) — ajouter ON CONFLICT DO NOTHING`
			);
		}
	}

	return { result, warnings };
}

// Exécution
const latestFile = getLatestMigration();

if (!latestFile) {
	console.log('Aucune migration trouvée.');
	process.exit(0);
}

const filePath = join(MIGRATIONS_DIR, latestFile);
const originalSql = readFileSync(filePath, 'utf-8');
const { result: transformedSql, warnings } = makeIdempotent(originalSql);

if (transformedSql !== originalSql) {
	writeFileSync(filePath, transformedSql);
	console.log(`✅ Migration ${latestFile} rendue idempotente`);
} else {
	console.log(`ℹ️  Migration ${latestFile} — aucune transformation nécessaire`);
}

if (warnings.length > 0) {
	console.log('\n📋 Actions manuelles requises :');
	warnings.forEach((w) => console.log(`   ${w}`));
	console.log('   → Consulter : .serena/memories/pattern-idempotent-migrations.md');
}
