// Tables
export { actors, type Actor, type NewActor } from './actors';
export { organs, type Organ, type NewOrgan } from './organs';
export { mandates, type Mandate, type NewMandate } from './mandates';
export { scrutins, type Scrutin, type NewScrutin } from './scrutins';
export { votes, type Vote, type NewVote } from './votes';
export { laws, type Law, type NewLaw } from './laws';
export { amendments, type Amendment, type NewAmendment } from './amendments';
export { lawCosignatories, type LawCosignatory, type NewLawCosignatory } from './law-cosignatories';
export { lawSummaries, type LawSummary, type NewLawSummary } from './law-summaries';
export { syncMetadata, type SyncMetadata, type NewSyncMetadata } from './sync-metadata';
export { actorStats, type ActorStats, type NewActorStats } from './actor-stats';
export { adminSettings, type AdminSetting, type NewAdminSetting } from './admin-settings';
export { tags, type Tag, type NewTag } from './tags';
export { lawTags, type LawTag, type NewLawTag } from './law-tags';
export { scrutinTags, type ScrutinTag, type NewScrutinTag } from './scrutin-tags';
export { lawTextSkipList, type LawTextSkip, type NewLawTextSkip } from './law-text-skip-list';
export { searchSynonyms, type SearchSynonym, type NewSearchSynonym } from './search-synonyms';
export {
	searchNoiseWords,
	type SearchNoiseWord,
	type NewSearchNoiseWord
} from './search-noise-words';

// Relations
export {
	actorsRelations,
	organsRelations,
	mandatesRelations,
	scrutinsRelations,
	votesRelations,
	lawsRelations,
	lawCosignatoriesRelations,
	lawSummariesRelations,
	amendmentsRelations,
	tagsRelations,
	lawTagsRelations,
	scrutinTagsRelations,
	lawTextSkipListRelations
} from './relations';
