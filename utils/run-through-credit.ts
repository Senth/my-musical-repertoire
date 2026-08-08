import type { Piece } from "@/models/piece";
import type { ByMode, ModeStats } from "@/models/practice";
import { PracticeMistakes } from "@/models/practice";
import type { Section } from "@/models/section";
import { deriveFromByMode } from "./practice-modes";

/** A run-through is hands-together by definition — it says nothing about LH/RH. */
const RUN_THROUGH_MODE = "HT";

/** Marks a section log as earned in context rather than repaired in isolation. */
export const RUN_THROUGH_LOG_SOURCE = "run-through";

/** The section-log payload for one credited section, minus the fields only the
 * persistence layer knows (`triggeredFrom`, `sessionId`). */
export interface RunThroughLog {
	date: Date;
	hands: typeof RUN_THROUGH_MODE;
	drill: null;
	quality: 1 | 2 | 3 | 4 | 5 | null;
	effort: 1 | 2 | 3 | 4 | 5 | null;
	achievedBpm: number | null;
	source: typeof RUN_THROUGH_LOG_SOURCE;
}

/** One section that held together during the run-through. */
export interface RunThroughCredit {
	sectionId: string;
	/** The section's full `byMode` map with `HT` refreshed. */
	byMode: ByMode;
	/** `deriveFromByMode(byMode)` — the section's single-number display fields. */
	derived: ReturnType<typeof deriveFromByMode>;
	log: RunThroughLog;
}

export interface RunThroughEffects {
	credits: RunThroughCredit[];
	/** Section ids to move back to the `stabilizing` phase. */
	demotions: string[];
}

export interface RunThroughInput {
	piece: Piece;
	/** The piece's sections as the practice screen already holds them. */
	sections: Section[];
	/** Sections the student ticked as shaky. */
	flaggedSectionIds: string[];
	technicalMistakes: PracticeMistakes;
	memoryMistakes: PracticeMistakes;
	achievedBpm: number | null;
	now: Date;
}

const EMPTY: RunThroughEffects = { credits: [], demotions: [] };

/** A run-through only carries section-level information for a piece the student
 * is holding, not one they are still building. */
function pieceIsRunnable(piece: Piece): boolean {
	return piece.state === "maintenance" || piece.state === "performance";
}

/**
 * Quality rises one step, capped at 5, and only after a clean run — one good
 * play-through must not erase three bad isolated logs. A section that was never
 * rated stays `null`: a run-through never invents a rating.
 */
function creditedQuality(
	previous: 1 | 2 | 3 | 4 | 5 | null | undefined,
	technicalMistakes: PracticeMistakes,
	memoryMistakes: PracticeMistakes,
): 1 | 2 | 3 | 4 | 5 | null {
	if (previous == null) return null;
	const worst = Math.max(technicalMistakes, memoryMistakes);
	if (worst > PracticeMistakes.few) return previous;
	return Math.min(5, previous + 1) as 1 | 2 | 3 | 4 | 5;
}

/**
 * `currentBpm` is earned history from isolated work, so a run-through taken
 * below it is not evidence the section got slower. A blank BPM writes nothing.
 */
function creditedBpm(
	previous: number | null | undefined,
	achievedBpm: number | null,
): number | null {
	if (achievedBpm == null) return previous ?? null;
	return Math.max(previous ?? 0, achievedBpm);
}

/**
 * What a whole-piece run-through does to the piece's maintenance-phase sections:
 * the unticked ones keep their recency and tempo (credit), the ticked ones drop
 * back to the stabilizing phase so the planner schedules them again.
 *
 * Pure — no Firestore, no React. Returns an empty result for any piece state or
 * section phase outside the maintenance/performance × maintenance cell.
 * See `docs/specs/run-through-credit-and-demotion.md` §3.
 */
export function computeRunThroughEffects({
	piece,
	sections,
	flaggedSectionIds,
	technicalMistakes,
	memoryMistakes,
	achievedBpm,
	now,
}: RunThroughInput): RunThroughEffects {
	if (!pieceIsRunnable(piece)) return EMPTY;

	const flagged = new Set(flaggedSectionIds);
	const credits: RunThroughCredit[] = [];
	const demotions: string[] = [];

	for (const section of sections) {
		if (section.archived) continue;
		if (section.phase !== "maintenance") continue;
		const sectionId = section.id;
		if (!sectionId) continue;

		// Ticked: revealed weak, not repaired. No credit, no log — only demotion.
		if (flagged.has(sectionId)) {
			demotions.push(sectionId);
			continue;
		}

		const previous: ModeStats = section.byMode?.[RUN_THROUGH_MODE] ?? {};
		const quality = creditedQuality(
			previous.quality,
			technicalMistakes,
			memoryMistakes,
		);
		const effort = previous.effort ?? null;
		const byMode: ByMode = {
			...(section.byMode ?? {}),
			[RUN_THROUGH_MODE]: {
				bpm: creditedBpm(previous.bpm, achievedBpm),
				quality,
				effort,
				lastPracticed: now,
			},
		};

		credits.push({
			sectionId,
			byMode,
			derived: deriveFromByMode(byMode),
			log: {
				date: now,
				hands: RUN_THROUGH_MODE,
				drill: null,
				quality,
				effort,
				// The tempo actually played, not the section's stored best.
				achievedBpm,
				source: RUN_THROUGH_LOG_SOURCE,
			},
		});
	}

	return { credits, demotions };
}
