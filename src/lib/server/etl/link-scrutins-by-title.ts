/**
 * ETL MVP : Lier les scrutins aux textes de loi en parsant les titres
 *
 * Approche : Extraire le nom du texte depuis le titre du scrutin,
 * créer des "dossiers virtuels" et lier les scrutins.
 */

import { db, scrutins, laws } from '../db';
import { eq, sql } from 'drizzle-orm';
import type { NewLaw } from '../db';

/**
 * Patterns pour extraire le nom du texte depuis un titre de scrutin
 */
const TEXT_PATTERNS = [
	// "l'ensemble du/de la [texte] (lecture)"
	/l'ensemble (?:du |de la |de l')(.+?)\s*\([^)]*lecture[^)]*\)/i,
	// "l'article XX du/de la [texte] (lecture)"
	/l'article\s+[\w\s]+(?:du |de la |de l')(.+?)\s*\([^)]*lecture[^)]*\)/i,
	// "l'amendement n° XXX ... du/de la [texte] (lecture)"
	/(?:du |de la |de l')(.+?)\s*\([^)]*lecture[^)]*\)\s*\.?\s*$/i,
	// "projet de loi [nom]" ou "proposition de loi [nom]"
	/((?:projet|proposition) de loi[^(]+)/i
];

/**
 * Types de textes identifiables
 */
const TEXT_TYPES: Record<string, string> = {
	'projet de loi de finances': 'PLF',
	'projet de loi de financement de la sécurité sociale': 'PLFSS',
	'projet de loi de règlement': 'PLR',
	'projet de loi': 'PJL',
	'proposition de loi organique': 'PPLO',
	'proposition de loi': 'PPL',
	'proposition de résolution': 'PRES'
};

/**
 * Extrait le nom du texte depuis un titre de scrutin
 */
export function extractTextName(title: string): string | null {
	for (const pattern of TEXT_PATTERNS) {
		const match = title.match(pattern);
		if (match && match[1]) {
			return normalizeTextName(match[1]);
		}
	}
	return null;
}

/**
 * Normalise le nom d'un texte pour regroupement
 */
function normalizeTextName(name: string): string {
	return (
		name
			.toLowerCase()
			.trim()
			// Supprimer les articles initiaux
			.replace(/^(le |la |l'|les |du |de la |de l')/, '')
			// Normaliser les espaces
			.replace(/\s+/g, ' ')
			// Supprimer la ponctuation finale
			.replace(/[.,;:]+$/, '')
			.trim()
	);
}

/**
 * Détermine le type de texte
 */
function detectTextType(name: string): string {
	const lowerName = name.toLowerCase();
	for (const [pattern, type] of Object.entries(TEXT_TYPES)) {
		if (lowerName.includes(pattern)) {
			return type;
		}
	}
	return 'AUTRE';
}

/**
 * Génère un ID stable pour un texte basé sur son nom normalisé
 */
function generateTextId(name: string, legislature: string): string {
	// Hash simple du nom pour créer un ID court
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		const char = name.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	const hashStr = Math.abs(hash).toString(36).substring(0, 8);
	return `TXT${legislature}${hashStr.toUpperCase()}`;
}

/**
 * Extrait un titre court depuis le nom complet
 */
function extractShortTitle(name: string): string {
	// Prendre les 100 premiers caractères
	if (name.length <= 100) return name;
	return name.substring(0, 97) + '...';
}

export interface LinkStats {
	scrutinsProcessed: number;
	scrutinsLinked: number;
	textsCreated: number;
	errors: number;
}

/**
 * Lie les scrutins aux textes en parsant leurs titres
 */
export async function linkScrutinsByTitle(legislature: string): Promise<LinkStats> {
	const stats: LinkStats = {
		scrutinsProcessed: 0,
		scrutinsLinked: 0,
		textsCreated: 0,
		errors: 0
	};

	console.log(`[Link by Title] Starting for legislature ${legislature}...`);

	// Récupérer tous les scrutins sans lawId
	const unlinkedScrutins = await db
		.select({
			id: scrutins.id,
			title: scrutins.title,
			date: scrutins.date
		})
		.from(scrutins)
		.where(eq(scrutins.legislature, legislature));

	console.log(`[Link by Title] Found ${unlinkedScrutins.length} scrutins to process`);

	// Grouper par nom de texte
	const textGroups = new Map<
		string,
		{
			name: string;
			type: string;
			scrutinIds: string[];
			firstDate: string;
		}
	>();

	for (const scrutin of unlinkedScrutins) {
		stats.scrutinsProcessed++;

		const textName = extractTextName(scrutin.title);
		if (!textName) continue;

		if (!textGroups.has(textName)) {
			textGroups.set(textName, {
				name: textName,
				type: detectTextType(textName),
				scrutinIds: [],
				firstDate: scrutin.date
			});
		}

		const group = textGroups.get(textName)!;
		group.scrutinIds.push(scrutin.id);
		if (scrutin.date < group.firstDate) {
			group.firstDate = scrutin.date;
		}
	}

	console.log(`[Link by Title] Found ${textGroups.size} distinct texts`);

	// Créer les textes et lier les scrutins
	for (const [normalizedName, group] of textGroups) {
		const textId = generateTextId(normalizedName, legislature);

		try {
			// Créer ou mettre à jour le texte dans la table laws
			const newLaw: NewLaw = {
				id: textId,
				legislature,
				title: group.name,
				shortTitle: extractShortTitle(group.name),
				type: group.type,
				status: null,
				depositDate: group.firstDate,
				initiator:
					group.type.startsWith('P') && group.type !== 'PPL' && group.type !== 'PPLO'
						? 'gouvernement'
						: 'assemblée'
			};

			await db
				.insert(laws)
				.values(newLaw)
				.onConflictDoUpdate({
					target: laws.id,
					set: {
						title: sql`excluded.title`,
						updatedAt: sql`now()`
					}
				});

			stats.textsCreated++;

			// Lier les scrutins
			for (const scrutinId of group.scrutinIds) {
				await db
					.update(scrutins)
					.set({ lawId: textId, updatedAt: new Date() })
					.where(eq(scrutins.id, scrutinId));

				stats.scrutinsLinked++;
			}
		} catch (error) {
			console.error(`[Link by Title] Error processing text "${normalizedName}":`, error);
			stats.errors++;
		}

		// Log progress
		if (stats.textsCreated % 50 === 0) {
			console.log(
				`[Link by Title] Progress: ${stats.textsCreated} texts, ${stats.scrutinsLinked} scrutins linked`
			);
		}
	}

	console.log(`[Link by Title] Done!`);
	console.log(`  Scrutins processed: ${stats.scrutinsProcessed}`);
	console.log(`  Scrutins linked: ${stats.scrutinsLinked}`);
	console.log(`  Texts created: ${stats.textsCreated}`);
	console.log(`  Errors: ${stats.errors}`);

	return stats;
}
