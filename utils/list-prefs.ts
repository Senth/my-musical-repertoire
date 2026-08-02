import { PIECE_STATES, type PieceState } from "@/models/piece";
import {
	TECHNIQUE_STATES,
	TECHNIQUE_TYPES,
	type TechniqueState,
	type TechniqueType,
} from "@/models/technique";
import {
	DEFAULT_PIECE_FILTERS,
	DEFAULT_TECHNIQUE_FILTERS,
	DIFFICULTIES,
	type Difficulty,
	type PieceFilters,
	type TechniqueFilters,
} from "./list-filtering";
import {
	defaultDirFor,
	PIECE_SORT_KEYS,
	PIECE_SORTS,
	type PieceSortKey,
	type SortDir,
	TECHNIQUE_SORT_KEYS,
	TECHNIQUE_SORTS,
	type TechniqueSortKey,
} from "./list-sorting";

/**
 * Persisted list preferences. Everything here is disposable: a bumped schema
 * version, an unknown sort key, or a hand-mangled value all fall back to the
 * defaults rather than leaving the list in a state the UI cannot express.
 */
export const LIST_PREFS_SCHEMA_VERSION = 1;

export interface PieceListPrefs {
	v: number;
	sortKey: PieceSortKey;
	sortDir: SortDir;
	filters: PieceFilters;
}

export interface TechniqueListPrefs {
	v: number;
	sortKey: TechniqueSortKey;
	sortDir: SortDir;
	filters: TechniqueFilters;
}

export const DEFAULT_PIECE_LIST_PREFS: PieceListPrefs = {
	v: LIST_PREFS_SCHEMA_VERSION,
	sortKey: PIECE_SORTS[0].key,
	sortDir: PIECE_SORTS[0].defaultDir,
	filters: DEFAULT_PIECE_FILTERS,
};

export const DEFAULT_TECHNIQUE_LIST_PREFS: TechniqueListPrefs = {
	v: LIST_PREFS_SCHEMA_VERSION,
	sortKey: TECHNIQUE_SORTS[0].key,
	sortDir: TECHNIQUE_SORTS[0].defaultDir,
	filters: DEFAULT_TECHNIQUE_FILTERS,
};

function asRecord(raw: unknown): Record<string, unknown> | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	return raw as Record<string, unknown>;
}

/** Keeps only known members, in the declared order. */
function memberList<T extends string | number>(
	raw: unknown,
	allowed: readonly T[],
) {
	if (!Array.isArray(raw)) return null;
	return allowed.filter((value) => raw.includes(value));
}

function stringList(raw: unknown): string[] | null {
	if (!Array.isArray(raw)) return null;
	const out: string[] = [];
	for (const value of raw) {
		if (typeof value === "string" && value.trim()) out.push(value.trim());
	}
	return out;
}

function positiveMinutes(raw: unknown): number | null {
	if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
	return raw;
}

function sortDir(raw: unknown): SortDir | null {
	return raw === "asc" || raw === "desc" ? raw : null;
}

export function sanitizePieceListPrefs(raw: unknown): PieceListPrefs | null {
	const record = asRecord(raw);
	if (!record || record.v !== LIST_PREFS_SCHEMA_VERSION) return null;

	const sortKey = PIECE_SORT_KEYS.includes(record.sortKey as PieceSortKey)
		? (record.sortKey as PieceSortKey)
		: DEFAULT_PIECE_LIST_PREFS.sortKey;
	const filters = asRecord(record.filters) ?? {};

	// An empty saved status list would render an unexplainably empty screen on
	// open, so it reverts to the default selection.
	const states = memberList<PieceState>(filters.states, PIECE_STATES);

	return {
		v: LIST_PREFS_SCHEMA_VERSION,
		sortKey,
		sortDir: sortDir(record.sortDir) ?? defaultDirFor(PIECE_SORTS, sortKey),
		filters: {
			states: states?.length ? states : DEFAULT_PIECE_FILTERS.states,
			composers: stringList(filters.composers) ?? [],
			collections: stringList(filters.collections) ?? [],
			difficulties:
				memberList<Difficulty>(filters.difficulties, DIFFICULTIES) ?? [],
			lengthMinMin: positiveMinutes(filters.lengthMinMin),
			lengthMaxMin: positiveMinutes(filters.lengthMaxMin),
		},
	};
}

export function sanitizeTechniqueListPrefs(
	raw: unknown,
): TechniqueListPrefs | null {
	const record = asRecord(raw);
	if (!record || record.v !== LIST_PREFS_SCHEMA_VERSION) return null;

	const sortKey = TECHNIQUE_SORT_KEYS.includes(
		record.sortKey as TechniqueSortKey,
	)
		? (record.sortKey as TechniqueSortKey)
		: DEFAULT_TECHNIQUE_LIST_PREFS.sortKey;
	const filters = asRecord(record.filters) ?? {};
	const states = memberList<TechniqueState>(filters.states, TECHNIQUE_STATES);

	return {
		v: LIST_PREFS_SCHEMA_VERSION,
		sortKey,
		sortDir: sortDir(record.sortDir) ?? defaultDirFor(TECHNIQUE_SORTS, sortKey),
		filters: {
			states: states?.length ? states : DEFAULT_TECHNIQUE_FILTERS.states,
			types: memberList<TechniqueType>(filters.types, TECHNIQUE_TYPES) ?? [],
		},
	};
}
