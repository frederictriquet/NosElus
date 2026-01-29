import { pgTable, varchar, timestamp, integer, text, jsonb } from 'drizzle-orm/pg-core';

/**
 * Table pour tracker les synchronisations ETL
 * Permet les imports incrémentaux en stockant la dernière date de sync
 */
export const syncMetadata = pgTable('sync_metadata', {
	// Clé composite: source + type d'entité + législature (optionnel)
	id: varchar('id', { length: 100 }).primaryKey(), // ex: "assemblee:actors", "assemblee:scrutins:17"
	source: varchar('source', { length: 50 }).notNull(), // "assemblee", "nosdeputes"
	entityType: varchar('entity_type', { length: 50 }).notNull(), // "actors", "scrutins", "votes", etc.
	legislature: varchar('legislature', { length: 10 }), // null si tous
	lastSyncAt: timestamp('last_sync_at').notNull(),
	lastSyncStatus: varchar('last_sync_status', { length: 20 }).notNull(), // "success", "partial", "failed"
	recordsProcessed: integer('records_processed').default(0),
	recordsInserted: integer('records_inserted').default(0),
	recordsUpdated: integer('records_updated').default(0),
	recordsSkipped: integer('records_skipped').default(0),
	recordsErrored: integer('records_errored').default(0),
	// Pour les APIs qui supportent la pagination ou les filtres par date
	lastModifiedFilter: timestamp('last_modified_filter'), // Date utilisée comme filtre "modifié depuis"
	lastCursor: text('last_cursor'), // Cursor/offset pour reprendre une sync interrompue
	metadata: jsonb('metadata'), // Données supplémentaires (ex: version API, checksums)
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type SyncMetadata = typeof syncMetadata.$inferSelect;
export type NewSyncMetadata = typeof syncMetadata.$inferInsert;
