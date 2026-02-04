/**
 * Test fixtures for ParlGov matching
 */
import type { Organ } from '$lib/server/db';
import type { ParlGovParty } from '../types';

/**
 * Factory pour créer un Organ de test
 */
export function createTestOrgan(overrides?: Partial<Organ>): Organ {
	return {
		id: 'PO123456',
		uid: 'TEST-UID',
		name: 'Test Organ',
		shortName: 'TO',
		acronym: null,
		type: 'GP',
		chamber: 'AN',
		color: '#000000',
		legislature: 17,
		startDate: '2024-01-01',
		endDate: null,
		politicalPosition: null,
		...overrides
	};
}

/**
 * Factory pour créer un ParlGovParty de test
 */
export function createTestParlGovParty(overrides?: Partial<ParlGovParty>): ParlGovParty {
	return {
		partyId: 1,
		countryCode: 'FRA',
		nameShort: 'TEST',
		nameEnglish: 'Test Party',
		nameNative: 'Parti Test',
		shortName: 'TP',
		familyShort: 'soc',
		leftRight: 5.0,
		...overrides
	};
}

/**
 * Fixtures d'organes réels de l'Assemblée Nationale
 */
export const realOrgans = {
	lfi: createTestOrgan({
		id: 'PO800538',
		name: 'La France insoumise - Nouveau Front populaire',
		shortName: 'LFI-NFP',
		politicalPosition: null
	}),
	rn: createTestOrgan({
		id: 'PO800520',
		name: 'Rassemblement National',
		shortName: 'RN',
		politicalPosition: null
	}),
	ren: createTestOrgan({
		id: 'PO800532',
		name: 'Renaissance',
		shortName: 'RE',
		politicalPosition: null
	}),
	lr: createTestOrgan({
		id: 'PO800508',
		name: 'Les Républicains',
		shortName: 'LR',
		politicalPosition: null
	}),
	ni: createTestOrgan({
		id: 'PO419610',
		name: 'Non inscrit',
		shortName: 'NI',
		politicalPosition: null
	})
};

/**
 * Fixtures de partis ParlGov français
 */
export const parlGovParties = {
	lfi: createTestParlGovParty({
		partyId: 1709,
		countryCode: 'FRA',
		nameShort: 'LFI',
		nameEnglish: 'La France Insoumise',
		nameNative: 'La France Insoumise',
		shortName: 'LFI',
		familyShort: 'com',
		leftRight: 1.3
	}),
	rn: createTestParlGovParty({
		partyId: 1439,
		countryCode: 'FRA',
		nameShort: 'RN',
		nameEnglish: 'National Rally',
		nameNative: 'Rassemblement national',
		shortName: 'RN',
		familyShort: 'r_rad',
		leftRight: 8.8
	}),
	lrem: createTestParlGovParty({
		partyId: 1766,
		countryCode: 'FRA',
		nameShort: 'LREM',
		nameEnglish: 'The Republic on the Move',
		nameNative: 'La République en Marche',
		shortName: 'LREM',
		familyShort: 'lib',
		leftRight: 6.0
	}),
	lr: createTestParlGovParty({
		partyId: 1327,
		countryCode: 'FRA',
		nameShort: 'LR',
		nameEnglish: 'The Republicans',
		nameNative: 'Les Républicains',
		shortName: 'LR',
		familyShort: 'con',
		leftRight: 7.4
	}),
	ps: createTestParlGovParty({
		partyId: 1110,
		countryCode: 'FRA',
		nameShort: 'PS',
		nameEnglish: 'Socialist Party',
		nameNative: 'Parti socialiste',
		shortName: 'PS',
		familyShort: 'soc',
		leftRight: 3.8
	})
};

/**
 * Échantillon CSV pour tests de parsing
 */
export const csvSamples = {
	valid: `party_id,country_name_short,party_name_short,party_name_english,party_name,party_name_ascii,family_name_short,left_right
1709,FRA,LFI,La France Insoumise,La France Insoumise,La France Insoumise,com,1.3
1439,FRA,RN,National Rally,Rassemblement national,Rassemblement national,r_rad,8.8
1766,FRA,LREM,The Republic on the Move,La République en Marche,La Republique en Marche,lib,6.0`,

	withQuotedFields: `party_id,country_name_short,party_name
123,FRA,"Parti avec, une virgule"
456,FRA,"Parti avec ""guillemets"""`,

	empty: ``,

	headersOnly: `party_id,country_name_short,party_name`,

	malformed: `party_id,country_name_short
123,FRA,ExtraField
456`
};
