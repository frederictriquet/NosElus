import { pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Table pour les paramètres d'administration
 * Stocke les switches de protection ETL par chambre
 */
export const adminSettings = pgTable('admin_settings', {
	key: varchar('key', { length: 100 }).primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type AdminSetting = typeof adminSettings.$inferSelect;
export type NewAdminSetting = typeof adminSettings.$inferInsert;
