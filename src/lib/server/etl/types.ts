export interface ETLResult<T> {
	success: boolean;
	data?: T;
	error?: string;
	count?: number;
}

export interface ETLConfig {
	legislature: string;
	batchSize: number;
	dataDir?: string;
}

export interface ImportStats {
	total: number;
	inserted: number;
	updated: number;
	skipped: number;
	errors: number;
}

export function createImportStats(): ImportStats {
	return {
		total: 0,
		inserted: 0,
		updated: 0,
		skipped: 0,
		errors: 0
	};
}

export function getETLConfig(): ETLConfig {
	return {
		legislature: process.env.ETL_ASSEMBLEE_LEGISLATURE || '17',
		batchSize: parseInt(process.env.ETL_BATCH_SIZE || '100', 10),
		dataDir: process.env.ETL_DATA_DIR
	};
}
