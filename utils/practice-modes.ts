import type {
	ByMode,
	HandsMode,
	ModeKey,
	ModeStats,
	PracticeDrill,
	TechniqueHandsMode,
} from "@/models/practice";
import { HANDS_MODES } from "@/models/practice";

/**
 * Hands-separate target is this much higher than the hands-together target.
 * A constant, not a stored field — revisit as its own issue if a piece needs
 * a different bar.
 */
export const HS_TARGET_MULTIPLIER = 1.15;

const KEY_SEPARATOR = ".";

/** Build the `ByMode` key for a hands + drill pair. `null` drill = normal. */
export function modeKey(
	hands: HandsMode,
	drill: PracticeDrill | null = null,
): ModeKey {
	return drill ? `${hands}${KEY_SEPARATOR}${drill}` : hands;
}

/** Split a `ByMode` key back into its hands + drill parts. */
export function parseModeKey(key: ModeKey): {
	hands: HandsMode;
	drill: PracticeDrill | null;
} {
	const [hands, drill] = key.split(KEY_SEPARATOR);
	return {
		hands: hands as HandsMode,
		drill: (drill as PracticeDrill) ?? null,
	};
}

/** Hands-separate target — 15% above the hands-together target. */
export function hsTarget(effectiveTarget: number | null): number | null {
	if (effectiveTarget == null) return null;
	return Math.round(effectiveTarget * HS_TARGET_MULTIPLIER);
}

/** Target BPM for a hands mode. A drill never changes the target. */
export function targetForMode(
	hands: HandsMode,
	effectiveTarget: number | null,
): number | null {
	if (effectiveTarget == null) return null;
	return hands === "HT" ? effectiveTarget : hsTarget(effectiveTarget);
}

/** Which hands chips a technique offers. */
export function availableHandsModes(
	handsMode: TechniqueHandsMode | null | undefined,
): HandsMode[] {
	switch (handsMode ?? "separate") {
		case "together":
			return ["HT"];
		case "both":
			return ["LH", "RH", "HT"];
		default:
			return ["LH", "RH"];
	}
}

/** Both hands separately at or above the hands-separate target. */
export function isHtReady(
	byMode: ByMode | null | undefined,
	effectiveTarget: number | null,
): boolean {
	const target = hsTarget(effectiveTarget);
	if (target == null || !byMode) return false;
	return (["LH", "RH"] as HandsMode[]).every((hands) => {
		const bpm = byMode[modeKey(hands)]?.bpm;
		return bpm != null && bpm >= target;
	});
}

/**
 * Preselect the hand that needs work most: largest gap to the hands-separate
 * target (never practised counts as an infinite gap), then lower quality, then
 * longest since practised. `HT` wins outright when both hands are ready.
 */
export function pickPreselectedHands(
	byMode: ByMode | null | undefined,
	available: HandsMode[],
	effectiveTarget: number | null,
): HandsMode {
	const separate = available.filter((h) => h !== "HT");
	if (separate.length === 0) return available[0] ?? "HT";
	if (available.includes("HT") && isHtReady(byMode, effectiveTarget)) {
		return "HT";
	}

	const target = hsTarget(effectiveTarget);
	let best = separate[0];
	let bestRank = rankHand(byMode?.[modeKey(best)], target);
	for (const hands of separate.slice(1)) {
		const rank = rankHand(byMode?.[modeKey(hands)], target);
		if (compareRank(rank, bestRank) > 0) {
			best = hands;
			bestRank = rank;
		}
	}
	return best;
}

interface HandRank {
	gap: number;
	quality: number;
	staleness: number;
}

function rankHand(
	stats: ModeStats | undefined,
	target: number | null,
): HandRank {
	const bpm = stats?.bpm;
	return {
		// Never practised (or no BPM logged) always needs work most.
		gap: bpm == null ? Number.POSITIVE_INFINITY : (target ?? bpm) - bpm,
		// Unknown quality must not beat a known-bad quality.
		quality: stats?.quality ?? 6,
		staleness: stats?.lastPracticed
			? -stats.lastPracticed.getTime()
			: Number.POSITIVE_INFINITY,
	};
}

/** Positive when `a` needs work more than `b`. */
function compareRank(a: HandRank, b: HandRank): number {
	if (a.gap !== b.gap) return a.gap - b.gap;
	if (a.quality !== b.quality) return b.quality - a.quality;
	return a.staleness - b.staleness;
}

/** Only the plain hands keys — drill keys are excluded. */
function handsEntries(byMode: ByMode | null | undefined): ModeStats[] {
	if (!byMode) return [];
	return HANDS_MODES.map((h) => byMode[h]).filter(
		(s): s is ModeStats => s != null,
	);
}

/**
 * Displayed BPM: the minimum across the hands modes actually practised.
 * Drill keys are excluded — a staccato tempo is not the section's tempo.
 */
export function deriveCurrentBpm(
	byMode: ByMode | null | undefined,
): number | null {
	const bpms = handsEntries(byMode)
		.map((s) => s.bpm)
		.filter((b): b is number => b != null);
	if (bpms.length === 0) return null;
	return Math.min(...bpms);
}

/** Most recent practice across every mode, drills included. */
export function deriveLastPracticed(
	byMode: ByMode | null | undefined,
): Date | null {
	let latest: Date | null = null;
	for (const stats of Object.values(byMode ?? {})) {
		const at = stats?.lastPracticed;
		if (at && (!latest || at.getTime() > latest.getTime())) latest = at;
	}
	return latest;
}

/** One mode's worth of a practice save. */
export interface ModeEntry {
	hands: HandsMode;
	drill: PracticeDrill | null;
	bpm: number | null;
	quality: 1 | 2 | 3 | 4 | 5;
	effort: 1 | 2 | 3 | 4 | 5;
}

/**
 * Fold saved entries into the stored `ByMode` map. A missing BPM keeps whatever
 * the mode already had — the student rated the mode without retiming it.
 */
export function mergeByMode(
	existing: ByMode | null | undefined,
	entries: ModeEntry[],
	date: Date,
): ByMode {
	const next: ByMode = { ...(existing ?? {}) };
	for (const entry of entries) {
		const key = modeKey(entry.hands, entry.drill);
		next[key] = {
			bpm: entry.bpm ?? next[key]?.bpm ?? null,
			quality: entry.quality,
			effort: entry.effort,
			lastPracticed: date,
		};
	}
	return next;
}

/** The single-number display values kept in sync with `byMode` on every save. */
export function deriveFromByMode(byMode: ByMode | null | undefined): {
	bpm: number | null;
	quality: 1 | 2 | 3 | 4 | 5 | null;
	effort: 1 | 2 | 3 | 4 | 5 | null;
	lastPracticed: Date | null;
} {
	const { quality, effort } = deriveLastRating(byMode);
	return {
		bpm: deriveCurrentBpm(byMode),
		quality,
		effort,
		lastPracticed: deriveLastPracticed(byMode),
	};
}

/** Read a stored `byMode` map, turning Firestore Timestamps into Dates. */
export function byModeFromFirestore(raw: unknown): ByMode {
	if (!raw || typeof raw !== "object") return {};
	const out: ByMode = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!value || typeof value !== "object") continue;
		const stats = value as Record<string, unknown>;
		const at = stats.lastPracticed as { toDate?: () => Date } | null;
		out[key] = {
			bpm: (stats.bpm as number) ?? null,
			quality: (stats.quality as 1 | 2 | 3 | 4 | 5) ?? null,
			effort: (stats.effort as 1 | 2 | 3 | 4 | 5) ?? null,
			lastPracticed: typeof at?.toDate === "function" ? at.toDate() : null,
		};
	}
	return out;
}

/** Quality + effort from the most recently practised mode, drills included. */
export function deriveLastRating(byMode: ByMode | null | undefined): {
	quality: 1 | 2 | 3 | 4 | 5 | null;
	effort: 1 | 2 | 3 | 4 | 5 | null;
} {
	let latest: Date | null = null;
	let winner: ModeStats | null = null;
	for (const stats of Object.values(byMode ?? {})) {
		const at = stats?.lastPracticed;
		if (!at) continue;
		if (!latest || at.getTime() > latest.getTime()) {
			latest = at;
			winner = stats;
		}
	}
	return {
		quality: winner?.quality ?? null,
		effort: winner?.effort ?? null,
	};
}
