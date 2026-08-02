import { PIECE_STATES, type Piece } from "@/models/piece";
import {
	TECHNIQUE_STATES,
	TECHNIQUE_TYPES,
	type TechniqueItem,
} from "@/models/technique";

/**
 * Pure comparators for the pieces and technique lists.
 *
 * Two rules shape every sort:
 * - Unknown values sort last in *both* directions, so flipping the direction
 *   never fills the top of the list with blanks.
 * - Never-practiced is not unknown: it is maximally stale, mirroring the
 *   planner's `daysSince(null) = 999`. It therefore leads "Last practiced"
 *   oldest-first and trails it newest-first.
 */

export type SortDir = "asc" | "desc";

export type PieceSortKey =
	| "score"
	| "lastPracticed"
	| "title"
	| "composer"
	| "collection"
	| "length"
	| "difficulty"
	| "state";

export type TechniqueSortKey =
	| "score"
	| "lastPracticed"
	| "title"
	| "type"
	| "state";

export interface SortOption<K extends string> {
	key: K;
	/** Direction applied when the user switches to this sort. */
	defaultDir: SortDir;
}

/** Declaration order is menu order; the first entry is the screen default. */
export const PIECE_SORTS: SortOption<PieceSortKey>[] = [
	{ key: "score", defaultDir: "desc" },
	{ key: "lastPracticed", defaultDir: "asc" },
	{ key: "title", defaultDir: "asc" },
	{ key: "composer", defaultDir: "asc" },
	{ key: "collection", defaultDir: "asc" },
	{ key: "length", defaultDir: "asc" },
	{ key: "difficulty", defaultDir: "asc" },
	{ key: "state", defaultDir: "asc" },
];

export const TECHNIQUE_SORTS: SortOption<TechniqueSortKey>[] = [
	{ key: "score", defaultDir: "desc" },
	{ key: "lastPracticed", defaultDir: "asc" },
	{ key: "title", defaultDir: "asc" },
	{ key: "type", defaultDir: "asc" },
	{ key: "state", defaultDir: "asc" },
];

export const PIECE_SORT_KEYS = PIECE_SORTS.map((s) => s.key);
export const TECHNIQUE_SORT_KEYS = TECHNIQUE_SORTS.map((s) => s.key);

export function defaultDirFor<K extends string>(
	options: SortOption<K>[],
	key: K,
): SortDir {
	return options.find((o) => o.key === key)?.defaultDir ?? "asc";
}

/** `null` means "unknown" and is pinned to the bottom regardless of `dir`. */
type SortValue = number | string | null;

function compareValues(a: SortValue, b: SortValue, dir: SortDir): number {
	if (a === null && b === null) return 0;
	if (a === null) return 1;
	if (b === null) return -1;
	const result =
		typeof a === "string"
			? a.localeCompare(b as string)
			: (a as number) - (b as number);
	return dir === "desc" ? -result : result;
}

function sortBy<T>(
	items: T[],
	keyFn: (item: T) => SortValue,
	dir: SortDir,
	title: (item: T) => string,
): T[] {
	return items.slice().sort((a, b) => {
		const result = compareValues(keyFn(a), keyFn(b), dir);
		if (result !== 0) return result;
		return title(a).localeCompare(title(b));
	});
}

/** Never practiced ranks as the oldest possible date, not as unknown. */
function practicedAt(date: Date | null | undefined): number {
	return date ? date.getTime() : Number.NEGATIVE_INFINITY;
}

function indexIn<T>(values: readonly T[], value: T | null | undefined) {
	if (value == null) return null;
	const index = values.indexOf(value);
	return index === -1 ? null : index;
}

function pieceSortValue(
	piece: Piece,
	key: PieceSortKey,
	scores: Record<string, number>,
): SortValue {
	switch (key) {
		case "score":
			return scores[piece.id ?? ""] ?? 0;
		case "lastPracticed":
			return practicedAt(piece.lastPracticed);
		case "title":
			return piece.title;
		case "composer":
			return piece.composer.trim() || null;
		case "collection":
			return piece.collectionName?.trim() || null;
		case "length":
			return piece.durationSeconds ?? null;
		case "difficulty":
			return piece.difficulty ?? null;
		case "state":
			return indexIn(PIECE_STATES, piece.state);
	}
}

export function sortPieces(
	pieces: Piece[],
	sort: { key: PieceSortKey; dir: SortDir },
	scores: Record<string, number>,
): Piece[] {
	return sortBy(
		pieces,
		(piece) => pieceSortValue(piece, sort.key, scores),
		sort.dir,
		(piece) => piece.title,
	);
}

function techniqueSortValue(
	item: TechniqueItem,
	key: TechniqueSortKey,
	scores: Record<string, number>,
): SortValue {
	switch (key) {
		case "score":
			return scores[item.id ?? ""] ?? 0;
		case "lastPracticed":
			return practicedAt(item.lastPracticedAt);
		case "title":
			return item.title;
		case "type":
			return indexIn(TECHNIQUE_TYPES, item.type);
		case "state":
			return indexIn(TECHNIQUE_STATES, item.state);
	}
}

export function sortTechniqueItems(
	items: TechniqueItem[],
	sort: { key: TechniqueSortKey; dir: SortDir },
	scores: Record<string, number>,
): TechniqueItem[] {
	return sortBy(
		items,
		(item) => techniqueSortValue(item, sort.key, scores),
		sort.dir,
		(item) => item.title,
	);
}

/**
 * Tapping the active sort flips its direction; tapping another switches to it
 * at that sort's default direction.
 */
export function nextSort<K extends string>(
	options: SortOption<K>[],
	current: { key: K; dir: SortDir },
	tapped: K,
): { key: K; dir: SortDir } {
	if (current.key === tapped) {
		return { key: tapped, dir: current.dir === "asc" ? "desc" : "asc" };
	}
	return { key: tapped, dir: defaultDirFor(options, tapped) };
}
