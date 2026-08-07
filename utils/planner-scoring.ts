import type { Piece } from "@/models/piece";
import type { ByMode, ModeKey, ModeStats } from "@/models/practice";
import type { Section, SectionPhase } from "@/models/section";
import type { TechniqueItem } from "@/models/technique";
import { isPracticedToday } from "./day-boundary";
import {
	availableHandsModes,
	parseModeKey,
	targetForMode,
} from "./practice-modes";

/**
 * The three weights of the section score, one row per phase:
 *
 *     score = PHASE_SCORE·days + BPM_GAP_WEIGHT·bpmGap + NEEDS_WORK_WEIGHT·needsWork
 *
 * One formula for every phase — no branch — so scores stay comparable and the
 * learning line can rank a neglected stabilizing section against a learning one
 * in a single pool. See `docs/specs/learning-line-greedy-selection.md` §3.1.
 */

/** `M` — how fast a section of this phase decays per day untouched. */
export const PHASE_SCORE: Record<SectionPhase, number> = {
	learning: 10,
	stabilizing: 3,
	maintenance: 1,
};

/**
 * `N` — weight on the raw BPM gap. Rises as the phase matures because the gaps
 * shrink (learning ~50, stabilizing ~10, maintenance ~0): the weighting
 * normalizes the term into the same band everywhere, so tempo is a nudge in
 * every phase instead of dominating one and vanishing from another.
 */
export const BPM_GAP_WEIGHT: Record<SectionPhase, number> = {
	learning: 0.25,
	stabilizing: 0.5,
	maintenance: 1,
};

/** `P` — weight on the squared needs-work term. Halved for learning, where a
 * rough attempt is expected rather than alarming. */
export const NEEDS_WORK_WEIGHT: Record<SectionPhase, number> = {
	learning: 0.5,
	stabilizing: 1,
	maintenance: 1,
};

const MS_PER_DAY = 86_400_000;

export function daysSince(date: Date | null | undefined, now: Date): number {
	if (!date) return 999;
	const ms = now.getTime() - date.getTime();
	if (ms < 0) return 0;
	return Math.floor(ms / MS_PER_DAY);
}

function compareTitle(a: string, b: string): number {
	return a.localeCompare(b);
}

/**
 * The modes worth scoring: everything present in `byMode` that was not already
 * practised today, in a stable order. Empty when the item has no `byMode` yet
 * (callers then fall back to the legacy item-level fields) or when every mode
 * was practised today.
 */
function scorableModes(
	byMode: ByMode | null | undefined,
	now: Date,
): Array<[ModeKey, ModeStats]> {
	return Object.entries(byMode ?? {})
		.filter(([, stats]) => !isPracticedToday(stats?.lastPracticed ?? null, now))
		.sort(([a], [b]) => a.localeCompare(b));
}

/** True when the item has modes and every one of them was practised today. */
function allModesPracticedToday(
	byMode: ByMode | null | undefined,
	now: Date,
): boolean {
	const present = Object.keys(byMode ?? {});
	return present.length > 0 && scorableModes(byMode, now).length === 0;
}

export interface SectionCandidate {
	piece: Piece;
	section: Section | null;
	phase: SectionPhase;
	lastPracticed: Date | null;
	currentBpm: number | null;
	lastQuality: number | null;
	lastEffort: number | null;
	score: number;
	/** Which mode produced `score`; `null` when scored from legacy fields. */
	modeKey: ModeKey | null;
	/** Every present mode was practised today — the section is done for now. */
	practicedToday: boolean;
}

/**
 * How badly the last logged attempt went, 0..32. Squared, not linear: a minor
 * slip should be nearly free, a section that fell apart at the limit should be
 * an emergency, and the curve between them is what tells those two apart.
 *
 * Unlogged defaults to `quality 5 / effort 1` — a section with no history
 * contributes 0 here, so the term never inflates something never played.
 */
export function needsWorkTerm(
	quality?: number | null,
	effort?: number | null,
): number {
	return (5 - (quality ?? 5)) ** 2 + ((effort ?? 1) - 1) ** 2;
}

/** Raw BPM shortfall against the target; 0 when either value is unknown. */
export function bpmGap(
	target: number | null | undefined,
	currentBpm: number | null | undefined,
): number {
	if (target == null || currentBpm == null) return 0;
	return Math.max(0, target - currentBpm);
}

export function scoreSectionCandidate(
	piece: Piece,
	phase: SectionPhase,
	lastPracticed: Date | null,
	currentBpm: number | null,
	now: Date,
	lastQuality?: number | null,
	lastEffort?: number | null,
	/** Target this BPM is measured against; defaults to the piece target. */
	target?: number | null,
): number {
	const days = daysSince(lastPracticed, now);
	const effectiveTarget = target === undefined ? piece.targetTempoBpm : target;
	return (
		PHASE_SCORE[phase] * days +
		BPM_GAP_WEIGHT[phase] * bpmGap(effectiveTarget, currentBpm) +
		NEEDS_WORK_WEIGHT[phase] * needsWorkTerm(lastQuality, lastEffort)
	);
}

/**
 * Scores every mode a section has been practised in and keeps the highest —
 * the mode that needs work most is what makes the section worth planning.
 * Modes absent from `byMode` are not scored: `daysSince(null) = 999` would make
 * every maintenance section with an unplayed left hand outrank the whole board.
 */
export function scoreSectionModes(
	piece: Piece,
	phase: SectionPhase,
	byMode: ByMode | null | undefined,
	effectiveTarget: number | null,
	now: Date,
	legacy: {
		lastPracticed: Date | null;
		currentBpm: number | null;
		lastQuality: number | null;
		lastEffort: number | null;
	},
): { score: number; modeKey: ModeKey | null } {
	const modes = scorableModes(byMode, now);

	if (modes.length === 0) {
		// No mode history (or all practised today) — score exactly as before.
		return {
			score: scoreSectionCandidate(
				piece,
				phase,
				legacy.lastPracticed,
				legacy.currentBpm,
				now,
				legacy.lastQuality,
				legacy.lastEffort,
				effectiveTarget,
			),
			modeKey: null,
		};
	}

	let bestScore = Number.NEGATIVE_INFINITY;
	let bestKey: ModeKey | null = null;
	for (const [key, stats] of modes) {
		const { hands } = parseModeKey(key);
		const score = scoreSectionCandidate(
			piece,
			phase,
			stats.lastPracticed ?? null,
			stats.bpm ?? null,
			now,
			stats.quality ?? null,
			stats.effort ?? null,
			targetForMode(hands, effectiveTarget),
		);
		if (score > bestScore) {
			bestScore = score;
			bestKey = key;
		}
	}
	return { score: bestScore, modeKey: bestKey };
}

export function scoreMaintenancePiece(piece: Piece, now: Date): number {
	const stateWeight = piece.state === "performance" ? 3 : 1;
	const days = daysSince(piece.lastPracticed ?? null, now);
	const techMistakes = piece.lastTechnicalMistakes ?? 0;
	const memMistakes = piece.lastMemoryMistakes ?? 0;
	return days * stateWeight + 2 * (techMistakes + memMistakes);
}

/**
 * Drops stats for modes the technique no longer offers — switching `handsMode`
 * from `both` to `separate`, or turning a drill off, leaves the old keys behind.
 * A mode the student cannot select must not drive the plan.
 */
function reachableByMode(tech: TechniqueItem): ByMode {
	const hands = availableHandsModes(tech.handsMode);
	const drills = tech.activeDrills ?? [];
	const out: ByMode = {};
	for (const [key, stats] of Object.entries(tech.byMode ?? {})) {
		const parsed = parseModeKey(key);
		if (!hands.includes(parsed.hands)) continue;
		if (parsed.drill && !drills.includes(parsed.drill)) continue;
		out[key] = stats;
	}
	return out;
}

export interface TechniqueScored {
	tech: TechniqueItem;
	score: number;
	/** Which mode produced `score`; `null` when scored from legacy fields. */
	modeKey: ModeKey | null;
}

function scoreTechniqueMode(
	tech: TechniqueItem,
	lastPracticed: Date | null,
	quality: number | null,
	effort: number | null,
	now: Date,
): number {
	const stateScore = tech.state === "active" ? 10 : 2;
	const days = daysSince(lastPracticed, now);
	const bonus = 2 * ((effort ?? 1) - 1 + (5 - (quality ?? 5)));
	return stateScore * days + bonus;
}

/** Highest score across the technique's practised modes. */
export function scoreTechniqueModes(
	tech: TechniqueItem,
	now: Date,
): { score: number; modeKey: ModeKey | null } {
	const modes = scorableModes(reachableByMode(tech), now);

	if (modes.length === 0) {
		return {
			score: scoreTechniqueMode(
				tech,
				tech.lastPracticedAt ?? null,
				tech.lastQuality ?? null,
				tech.lastEffort ?? null,
				now,
			),
			modeKey: null,
		};
	}

	let bestScore = Number.NEGATIVE_INFINITY;
	let bestKey: ModeKey | null = null;
	for (const [key, stats] of modes) {
		const score = scoreTechniqueMode(
			tech,
			stats.lastPracticed ?? null,
			stats.quality ?? null,
			stats.effort ?? null,
			now,
		);
		if (score > bestScore) {
			bestScore = score;
			bestKey = key;
		}
	}
	return { score: bestScore, modeKey: bestKey };
}

export function scoreTechnique(tech: TechniqueItem, now: Date): number {
	return scoreTechniqueModes(tech, now).score;
}

export function sortTechniques(
	items: TechniqueItem[],
	now: Date,
): TechniqueScored[] {
	const scored = items.map((t) => ({
		tech: t,
		...scoreTechniqueModes(t, now),
	}));
	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const aDate = a.tech.dateIntroduced.getTime();
		const bDate = b.tech.dateIntroduced.getTime();
		if (aDate !== bDate) return aDate - bDate;
		return compareTitle(a.tech.title, b.tech.title);
	});
	return scored;
}

export function buildSectionCandidates(
	pieces: Piece[],
	sections: Section[],
	now: Date,
): SectionCandidate[] {
	const sectionsByPiece = new Map<string, Section[]>();
	for (const s of sections) {
		if (s.archived) continue;
		const arr = sectionsByPiece.get(s.pieceId) ?? [];
		arr.push(s);
		sectionsByPiece.set(s.pieceId, arr);
	}
	const candidates: SectionCandidate[] = [];
	for (const piece of pieces) {
		if (!piece.id) continue;
		const pieceSections = sectionsByPiece.get(piece.id) ?? [];
		if (pieceSections.length === 0) {
			// A piece with no sections is planned as one whole-piece candidate.
			const phase: SectionPhase = "learning";
			const score = scoreSectionCandidate(
				piece,
				phase,
				piece.lastPracticed ?? null,
				piece.lastAchievedTempoBpm ?? null,
				now,
			);
			candidates.push({
				piece,
				section: null,
				phase,
				lastPracticed: piece.lastPracticed ?? null,
				currentBpm: piece.lastAchievedTempoBpm ?? null,
				lastQuality: null,
				lastEffort: null,
				score,
				modeKey: null,
				practicedToday: isPracticedToday(piece.lastPracticed ?? null, now),
			});
		} else {
			for (const section of pieceSections) {
				const effectiveTarget =
					section.targetBpmOverride ?? piece.targetTempoBpm ?? null;
				const { score, modeKey } = scoreSectionModes(
					piece,
					section.phase,
					section.byMode,
					effectiveTarget,
					now,
					{
						lastPracticed: section.lastPracticed ?? null,
						currentBpm: section.currentBpm ?? null,
						lastQuality: section.lastQuality ?? null,
						lastEffort: section.lastEffort ?? null,
					},
				);
				const hasModes = Object.keys(section.byMode ?? {}).length > 0;
				candidates.push({
					piece,
					section,
					phase: section.phase,
					lastPracticed: section.lastPracticed ?? null,
					currentBpm: section.currentBpm ?? null,
					lastQuality: section.lastQuality ?? null,
					lastEffort: section.lastEffort ?? null,
					score,
					modeKey,
					practicedToday: hasModes
						? allModesPracticedToday(section.byMode, now)
						: isPracticedToday(section.lastPracticed ?? null, now),
				});
			}
		}
	}
	return candidates;
}

export function eligibleMaintenancePieces(
	pieces: Piece[],
	now: Date,
	usedPieceIds?: Set<string>,
): Piece[] {
	return pieces.filter(
		(p) =>
			(p.state === "maintenance" || p.state === "performance") &&
			!isPracticedToday(p.lastPracticed ?? null, now) &&
			!(usedPieceIds && p.id && usedPieceIds.has(p.id)),
	);
}

/** A technique drops out only when every mode it has was practised today. */
export function techniquePracticedToday(
	tech: TechniqueItem,
	now: Date,
): boolean {
	const byMode = reachableByMode(tech);
	if (Object.keys(byMode).length > 0) {
		return allModesPracticedToday(byMode, now);
	}
	return isPracticedToday(tech.lastPracticedAt ?? null, now);
}

export function eligibleTechniquesInState(
	techniques: TechniqueItem[],
	state: "active" | "maintenance",
	now: Date,
	usedTechniqueIds?: Set<string>,
): TechniqueItem[] {
	return techniques.filter(
		(t) =>
			t.state === state &&
			!techniquePracticedToday(t, now) &&
			!(usedTechniqueIds && t.id && usedTechniqueIds.has(t.id)),
	);
}
