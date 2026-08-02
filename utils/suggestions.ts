import type { Piece } from "@/models/piece";

export const MAX_SUGGESTIONS = 5;

/**
 * Dedupes case-insensitively (first-seen variant wins) and sorts alphabetically,
 * case-insensitively. Blank and nullish values are dropped.
 */
export function dedupeSuggestions(
	values: (string | null | undefined)[],
): string[] {
	const seen = new Map<string, string>();
	for (const value of values) {
		const trimmed = value?.trim();
		if (!trimmed) continue;
		const key = trimmed.toLowerCase();
		if (!seen.has(key)) seen.set(key, trimmed);
	}
	return Array.from(seen.values()).sort((a, b) =>
		a.toLowerCase().localeCompare(b.toLowerCase()),
	);
}

/** Composer suggestions: substring matches only once the user has typed. */
export function composerSuggestions(pieces: Piece[], query: string): string[] {
	if (!query.trim()) return [];
	const lower = query.toLowerCase();
	return dedupeSuggestions(pieces.map((p) => p.composer))
		.filter((c) => c.toLowerCase().includes(lower))
		.slice(0, MAX_SUGGESTIONS);
}

/**
 * Collection suggestions drawn from the user's own pieces.
 *
 * - Empty query, empty composer: nothing.
 * - Empty query, composer set: collections of that composer's pieces.
 * - Non-empty query: substring matches across all collections, with the current
 *   composer's collections ranked first.
 *
 * Capped at {@link MAX_SUGGESTIONS} in all cases.
 */
export function collectionSuggestions(
	pieces: Piece[],
	composer: string,
	query: string,
): string[] {
	const composerKey = composer.trim().toLowerCase();
	const lowerQuery = query.trim().toLowerCase();

	const sameComposer = dedupeSuggestions(
		pieces
			.filter(
				(p) => composerKey && p.composer.trim().toLowerCase() === composerKey,
			)
			.map((p) => p.collectionName),
	);

	if (!lowerQuery) return sameComposer.slice(0, MAX_SUGGESTIONS);

	const matches = (c: string) => c.toLowerCase().includes(lowerQuery);
	const sameComposerMatches = sameComposer.filter(matches);
	const sameComposerKeys = new Set(
		sameComposerMatches.map((c) => c.toLowerCase()),
	);
	const otherMatches = dedupeSuggestions(pieces.map((p) => p.collectionName))
		.filter(matches)
		.filter((c) => !sameComposerKeys.has(c.toLowerCase()));

	return [...sameComposerMatches, ...otherMatches].slice(0, MAX_SUGGESTIONS);
}
