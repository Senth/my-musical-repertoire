import { PIECE_STATES, type Piece, type PieceState } from "@/models/piece";
import {
	TECHNIQUE_STATES,
	TECHNIQUE_TYPES,
	type TechniqueItem,
	type TechniqueState,
	type TechniqueType,
} from "@/models/technique";

/**
 * Pure filter predicates for the pieces and technique lists.
 *
 * Multi-select semantics differ by field on purpose:
 * - `states` is always an explicit list, because its default is a real subset
 *   (shelved / retired hidden). Deselecting everything genuinely matches
 *   nothing — recoverable via "Clear all".
 * - every other multi-select treats the empty list as "no constraint", so an
 *   untouched filter never hides anything.
 */

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5];

export interface PieceFilters {
	states: PieceState[];
	composers: string[];
	collections: string[];
	difficulties: Difficulty[];
	/** Minutes, inclusive lower bound. */
	lengthMinMin: number | null;
	/** Minutes, inclusive upper bound. */
	lengthMaxMin: number | null;
}

export interface TechniqueFilters {
	states: TechniqueState[];
	types: TechniqueType[];
}

/** Shelved pieces are noise in the working list, so they start hidden. */
export const DEFAULT_PIECE_FILTERS: PieceFilters = {
	states: PIECE_STATES.filter((s) => s !== "shelved"),
	composers: [],
	collections: [],
	difficulties: [],
	lengthMinMin: null,
	lengthMaxMin: null,
};

/** Matches the pre-existing behaviour of the technique list. */
export const DEFAULT_TECHNIQUE_FILTERS: TechniqueFilters = {
	states: TECHNIQUE_STATES.filter((s) => s !== "retired"),
	types: [],
};

const SECONDS_PER_MINUTE = 60;

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
	if (a.length !== b.length) return false;
	const bSet = new Set(b);
	return a.every((value) => bSet.has(value));
}

/** Toggles `value` in `values`, keeping `order`'s declared sequence. */
export function toggleValue<T>(
	values: readonly T[],
	value: T,
	order?: readonly T[],
): T[] {
	const next = values.includes(value)
		? values.filter((v) => v !== value)
		: [...values, value];
	if (!order) return next.slice().sort();
	return order.filter((v) => next.includes(v));
}

/** De-duplicated, A–Z sorted composer names present in the library. */
export function availableComposers(pieces: Piece[]): string[] {
	return distinctTrimmed(pieces.map((p) => p.composer));
}

/** De-duplicated, A–Z sorted collection names. Pieces without one are ignored. */
export function availableCollections(pieces: Piece[]): string[] {
	return distinctTrimmed(pieces.map((p) => p.collectionName));
}

function distinctTrimmed(values: (string | null | undefined)[]): string[] {
	const seen = new Set<string>();
	for (const value of values) {
		const trimmed = value?.trim();
		if (trimmed) seen.add(trimmed);
	}
	return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

export function filterPieces(pieces: Piece[], filters: PieceFilters): Piece[] {
	const composers = new Set(filters.composers);
	const collections = new Set(filters.collections);
	const states = new Set(filters.states);
	const difficulties = new Set<number>(filters.difficulties);
	const hasLengthBound =
		filters.lengthMinMin != null || filters.lengthMaxMin != null;

	return pieces.filter((piece) => {
		if (!states.has(piece.state)) return false;
		if (composers.size > 0 && !composers.has(piece.composer.trim())) {
			return false;
		}
		if (collections.size > 0) {
			const collection = piece.collectionName?.trim();
			if (!collection || !collections.has(collection)) return false;
		}
		if (difficulties.size > 0) {
			if (piece.difficulty == null || !difficulties.has(piece.difficulty)) {
				return false;
			}
		}
		if (hasLengthBound) {
			// An unknown length cannot satisfy a length question — excluding it
			// beats silently implying the piece is short enough.
			if (piece.durationSeconds == null) return false;
			const minutes = piece.durationSeconds / SECONDS_PER_MINUTE;
			if (filters.lengthMinMin != null && minutes < filters.lengthMinMin) {
				return false;
			}
			if (filters.lengthMaxMin != null && minutes > filters.lengthMaxMin) {
				return false;
			}
		}
		return true;
	});
}

export function filterTechniques(
	techniques: TechniqueItem[],
	filters: TechniqueFilters,
): TechniqueItem[] {
	const states = new Set(filters.states);
	const types = new Set(filters.types);
	return techniques.filter((item) => {
		if (!states.has(item.state)) return false;
		if (types.size > 0) {
			if (!item.type || !types.has(item.type)) return false;
		}
		return true;
	});
}

export function searchPieces(pieces: Piece[], query: string): Piece[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return pieces;
	return pieces.filter(
		(p) =>
			p.title.toLowerCase().includes(needle) ||
			p.composer.toLowerCase().includes(needle) ||
			(p.collectionName?.toLowerCase().includes(needle) ?? false),
	);
}

export function searchTechniques(
	techniques: TechniqueItem[],
	query: string,
): TechniqueItem[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return techniques;
	return techniques.filter((item) => item.title.toLowerCase().includes(needle));
}

/**
 * One pill per selected value. `kind` + `value` is enough for the caller to
 * both label the pill and remove exactly that value.
 */
export type PieceFilterPill =
	| { id: string; kind: "state"; value: PieceState }
	| { id: string; kind: "composer"; value: string }
	| { id: string; kind: "collection"; value: string }
	| { id: string; kind: "difficulty"; value: Difficulty }
	| { id: string; kind: "length"; min: number | null; max: number | null };

export type TechniqueFilterPill =
	| { id: string; kind: "state"; value: TechniqueState }
	| { id: string; kind: "type"; value: TechniqueType };

export function hasNonDefaultPieceFilters(filters: PieceFilters): boolean {
	return piecePills(filters).length > 0;
}

export function hasNonDefaultTechniqueFilters(
	filters: TechniqueFilters,
): boolean {
	return techniquePills(filters).length > 0;
}

/** The default status selection is the resting state, so it shows no pill. */
export function piecePills(filters: PieceFilters): PieceFilterPill[] {
	const pills: PieceFilterPill[] = [];
	if (!sameSet(filters.states, DEFAULT_PIECE_FILTERS.states)) {
		for (const state of PIECE_STATES) {
			if (filters.states.includes(state)) {
				pills.push({ id: `state:${state}`, kind: "state", value: state });
			}
		}
	}
	for (const composer of filters.composers) {
		pills.push({
			id: `composer:${composer}`,
			kind: "composer",
			value: composer,
		});
	}
	for (const collection of filters.collections) {
		pills.push({
			id: `collection:${collection}`,
			kind: "collection",
			value: collection,
		});
	}
	for (const difficulty of filters.difficulties) {
		pills.push({
			id: `difficulty:${difficulty}`,
			kind: "difficulty",
			value: difficulty,
		});
	}
	if (filters.lengthMinMin != null || filters.lengthMaxMin != null) {
		pills.push({
			id: "length",
			kind: "length",
			min: filters.lengthMinMin,
			max: filters.lengthMaxMin,
		});
	}
	return pills;
}

export function techniquePills(
	filters: TechniqueFilters,
): TechniqueFilterPill[] {
	const pills: TechniqueFilterPill[] = [];
	if (!sameSet(filters.states, DEFAULT_TECHNIQUE_FILTERS.states)) {
		for (const state of TECHNIQUE_STATES) {
			if (filters.states.includes(state)) {
				pills.push({ id: `state:${state}`, kind: "state", value: state });
			}
		}
	}
	for (const type of TECHNIQUE_TYPES) {
		if (filters.types.includes(type)) {
			pills.push({ id: `type:${type}`, kind: "type", value: type });
		}
	}
	return pills;
}

/**
 * Removing the last non-default status pill would leave an empty status list
 * (matching nothing), so it restores the default selection instead.
 */
export function removePiecePill(
	filters: PieceFilters,
	pill: PieceFilterPill,
): PieceFilters {
	switch (pill.kind) {
		case "state": {
			const states = filters.states.filter((s) => s !== pill.value);
			return {
				...filters,
				states: states.length === 0 ? DEFAULT_PIECE_FILTERS.states : states,
			};
		}
		case "composer":
			return {
				...filters,
				composers: filters.composers.filter((c) => c !== pill.value),
			};
		case "collection":
			return {
				...filters,
				collections: filters.collections.filter((c) => c !== pill.value),
			};
		case "difficulty":
			return {
				...filters,
				difficulties: filters.difficulties.filter((d) => d !== pill.value),
			};
		case "length":
			return { ...filters, lengthMinMin: null, lengthMaxMin: null };
	}
}

export function removeTechniquePill(
	filters: TechniqueFilters,
	pill: TechniqueFilterPill,
): TechniqueFilters {
	switch (pill.kind) {
		case "state": {
			const states = filters.states.filter((s) => s !== pill.value);
			return {
				...filters,
				states: states.length === 0 ? DEFAULT_TECHNIQUE_FILTERS.states : states,
			};
		}
		case "type":
			return {
				...filters,
				types: filters.types.filter((t) => t !== pill.value),
			};
	}
}
