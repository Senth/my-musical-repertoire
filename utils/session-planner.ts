import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";
import {
	allocationTotalMinutes,
	type BlockKind,
	type MaintenanceOptIn,
	type OmittedReason,
	type OmittedSlot,
	type PlannedBlock,
	type SessionAllocation,
	type SessionPlan,
} from "@/models/session";
import type { TechniqueItem } from "@/models/technique";
import {
	buildSectionCandidates,
	daysSince,
	eligibleMaintenancePieces,
	eligibleTechniquesInState,
	type SectionCandidate,
	scoreMaintenancePiece,
	scoreTechniqueModes,
	sortTechniques,
} from "./planner-scoring";
import {
	capLearningMinutes,
	LEARNING_BLOCK_MAX,
	REVIEW_BLOCK_MAX,
	STABILIZING_BLOCK_MAX,
	splitLearningLine,
	splitReviewMinutes,
	splitStabilizingLine,
} from "./session-split";

/**
 * One canonical order for every preset. Reading sits directly after warmup: it
 * is demanding on the brain but light on the hands, so it extends the warmup
 * rather than competing with technique — and reading last only trains guessing.
 * Review sits before learning: retention of prior material has to be tested
 * before working memory is loaded with new acquisition, and arriving at the new
 * material through the measures that precede it is the practical warm-in.
 * Disabled lines simply vanish from the sequence.
 */
export const CANONICAL_BLOCK_ORDER: BlockKind[] = [
	"warmup",
	"sight-reading",
	"technique",
	"repertoire-review",
	"repertoire-learning",
	"repertoire-stabilizing",
	"repertoire-maintenance",
];

/** Float slack, matching `session-split`. */
const EPS = 1e-9;

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

function compareTitle(a: string, b: string): number {
	return a.localeCompare(b);
}

/**
 * Identity of a candidate for same-session dedup. A piece with no sections is
 * planned as one virtual whole-piece candidate, so it is keyed by its piece.
 */
function candidateKey(c: SectionCandidate): string {
	return c.section?.id ? `section:${c.section.id}` : `piece:${c.piece.id}`;
}

function stillAvailable(
	candidates: SectionCandidate[],
	usedSectionIds?: Set<string>,
	usedPieceIds?: Set<string>,
): SectionCandidate[] {
	return candidates.filter((c) => {
		// Per-mode: a section drilled left hand this morning can return for right.
		if (c.practicedToday) return false;
		if (c.section?.id) {
			if (usedSectionIds?.has(c.section.id)) return false;
		} else if (c.piece.id && usedPieceIds?.has(c.piece.id)) {
			return false;
		}
		return true;
	});
}

function sortCandidates(candidates: SectionCandidate[]): SectionCandidate[] {
	return candidates.slice().sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const titleCmp = compareTitle(a.piece.title, b.piece.title);
		if (titleCmp !== 0) return titleCmp;
		const aOrder = a.section?.order ?? -1;
		const bOrder = b.section?.order ?? -1;
		return aOrder - bOrder;
	});
}

export interface LearningLinePools {
	/** New acquisition: learning-phase sections of learning-state pieces. */
	learning: SectionCandidate[];
	/** Already-learned sections of those same pieces. */
	review: SectionCandidate[];
}

/**
 * The learning line only ever looks at pieces whose *state* is `learning`. Its
 * two pools never compete in one ranking, which is what stops a learning-phase
 * section (`PHASE_SCORE` 10) from burying a stabilizing one (2.5) forever — no
 * scoring formula had to change for that.
 */
export function learningLinePools(
	pieces: Piece[],
	sections: Section[],
	now: Date,
	usedSectionIds?: Set<string>,
	usedPieceIds?: Set<string>,
): LearningLinePools {
	const learningPieces = pieces.filter((p) => p.state === "learning");
	const all = stillAvailable(
		buildSectionCandidates(learningPieces, sections, now),
		usedSectionIds,
		usedPieceIds,
	);
	return {
		learning: all.filter((c) => c.phase === "learning"),
		review: all.filter(
			(c) => c.phase === "stabilizing" || c.phase === "maintenance",
		),
	};
}

/**
 * Cross-piece consolidation: everything inside a piece promoted out of
 * `learning`, plus the "problem section in an otherwise fine piece" case —
 * a learning- or stabilizing-phase section inside a maintenance/performance
 * piece. Those pieces' *whole-piece* candidates stay out: run-throughs are the
 * maintenance line's job, and counting them twice would double-book the piece.
 */
export function stabilizingLinePool(
	pieces: Piece[],
	sections: Section[],
	now: Date,
	usedSectionIds?: Set<string>,
	usedPieceIds?: Set<string>,
): SectionCandidate[] {
	const promoted = buildSectionCandidates(
		pieces.filter((p) => p.state === "stabilizing"),
		sections,
		now,
	);
	const problemSections = buildSectionCandidates(
		pieces.filter(
			(p) => p.state === "maintenance" || p.state === "performance",
		),
		sections,
		now,
	).filter(
		(c) =>
			c.section != null &&
			(c.phase === "stabilizing" || c.phase === "learning"),
	);
	return stillAvailable(
		[...promoted, ...problemSections],
		usedSectionIds,
		usedPieceIds,
	);
}

/**
 * Review candidates ordered same-piece-first: reviewing what precedes the new
 * material is the whole point, so sections of the pieces a learning block was
 * picked from come before other learning-state pieces. Score orders within each
 * group.
 */
function orderReviewPool(
	candidates: SectionCandidate[],
	learningPieceIds: Set<string>,
): SectionCandidate[] {
	const sorted = sortCandidates(candidates);
	const sameP = sorted.filter(
		(c) => c.piece.id && learningPieceIds.has(c.piece.id),
	);
	const others = sorted.filter(
		(c) => !(c.piece.id && learningPieceIds.has(c.piece.id)),
	);
	return [...sameP, ...others];
}

/** Blocks must land on *different* sections — the same one twice with a pause
 * in the middle is one long block, not interleaving. */
function takeDistinct(
	ordered: SectionCandidate[],
	count: number,
	taken: Set<string>,
): SectionCandidate[] {
	const picks: SectionCandidate[] = [];
	for (const c of ordered) {
		if (picks.length >= count) break;
		const key = candidateKey(c);
		if (taken.has(key)) continue;
		taken.add(key);
		picks.push(c);
	}
	return picks;
}

function sectionBlock(
	kind: BlockKind,
	candidate: SectionCandidate,
	allocatedMinutes: number,
): PlannedBlock {
	return {
		kind,
		allocatedMinutes,
		pieceId: candidate.piece.id ?? null,
		sectionId: candidate.section?.id ?? null,
		title: candidate.piece.title,
		subtitle: candidate.section?.label ?? null,
		score: candidate.score,
		modeKey: candidate.modeKey,
	};
}

function sum(values: number[]): number {
	return values.reduce((acc, v) => acc + v, 0);
}

/**
 * The single best section for a line, at the full allocation. Kept for callers
 * that want one block; `buildPlan` uses the multi-block pickers below.
 */
export function pickRepertoireSection(
	slot: "learning" | "stabilizing",
	pieces: Piece[],
	sections: Section[],
	allocatedMinutes: number,
	now: Date = new Date(),
	usedSectionIds?: Set<string>,
	usedPieceIds?: Set<string>,
): PlannedBlock | null {
	const pool =
		slot === "learning"
			? learningLinePools(pieces, sections, now, usedSectionIds, usedPieceIds)
					.learning
			: stabilizingLinePool(
					pieces,
					sections,
					now,
					usedSectionIds,
					usedPieceIds,
				);
	const best = sortCandidates(pool)[0];
	if (!best) return null;
	const kind: BlockKind =
		slot === "learning" ? "repertoire-learning" : "repertoire-stabilizing";
	return sectionBlock(kind, best, allocatedMinutes);
}

export interface LearningLineResult {
	learningBlocks: PlannedBlock[];
	reviewBlocks: PlannedBlock[];
	/** Minutes no block could take — the caller redistributes them. */
	leftoverMinutes: number;
}

/**
 * Splits the learning line into time-boxed learning blocks plus the reserved
 * review blocks, then walks the degradation ladder when the pools are thinner
 * than the split asked for:
 *
 * 1. fewer distinct learning sections than blocks → fewer blocks, each capped
 *    at `LEARNING_BLOCK_MAX`, surplus minutes moved into the review budget (so
 *    one eligible section and a 20-minute line gives 12 learning + 8 review,
 *    never 20 minutes on one section);
 * 2. no learning section at all → the whole line runs as review;
 * 3. no review section either → review minutes go back to learning, still
 *    capped, and whatever still cannot be placed comes back as `leftoverMinutes`.
 */
export function pickRepertoireLearningBlocks(
	pieces: Piece[],
	sections: Section[],
	allocatedMinutes: number,
	now: Date = new Date(),
	usedSectionIds?: Set<string>,
	usedPieceIds?: Set<string>,
): LearningLineResult {
	const empty: LearningLineResult = {
		learningBlocks: [],
		reviewBlocks: [],
		leftoverMinutes: 0,
	};
	if (allocatedMinutes <= 0) return empty;

	const pools = learningLinePools(
		pieces,
		sections,
		now,
		usedSectionIds,
		usedPieceIds,
	);
	if (pools.learning.length === 0 && pools.review.length === 0) {
		return { ...empty, leftoverMinutes: allocatedMinutes };
	}

	const split = splitLearningLine(allocatedMinutes);
	const taken = new Set<string>();
	const learningPicks = takeDistinct(
		sortCandidates(pools.learning),
		split.learningMinutes.length,
		taken,
	);

	let learningMinutes: number[];
	let reviewBudget = sum(split.reviewMinutes);
	if (learningPicks.length === split.learningMinutes.length) {
		learningMinutes = split.learningMinutes;
	} else {
		const capped = capLearningMinutes(
			sum(split.learningMinutes),
			learningPicks.length,
		);
		learningMinutes = capped.minutes;
		reviewBudget += capped.surplus;
	}

	const learningPieceIds = new Set(
		learningPicks.map((c) => c.piece.id).filter((id): id is string => !!id),
	);
	// With no learning block the "review never outnumbers learning" rule has
	// nothing to bound — the line is review, so it is sized on its own.
	const wantedReviewBlocks =
		learningMinutes.length > 0
			? splitReviewMinutes(reviewBudget, learningMinutes.length).length
			: splitReviewMinutes(reviewBudget, Number.MAX_SAFE_INTEGER).length;
	const reviewPicks = takeDistinct(
		orderReviewPool(pools.review, learningPieceIds),
		wantedReviewBlocks,
		taken,
	);

	let leftoverMinutes = 0;
	if (reviewPicks.length === 0 && reviewBudget > EPS) {
		// Nothing learned to review yet — hand the minutes back to learning, still
		// capped, and report what even that cannot absorb.
		const capacity = Math.max(
			0,
			learningMinutes.length * LEARNING_BLOCK_MAX - sum(learningMinutes),
		);
		const give = Math.min(reviewBudget, capacity);
		if (give > 0) {
			const per = give / learningMinutes.length;
			learningMinutes = learningMinutes.map((m) => m + per);
		}
		leftoverMinutes = reviewBudget - give;
		reviewBudget = 0;
	}

	const reviewMinutes =
		reviewPicks.length > 0
			? reviewPicks.map(() => reviewBudget / reviewPicks.length)
			: [];

	return {
		learningBlocks: learningPicks.map((c, i) =>
			sectionBlock("repertoire-learning", c, learningMinutes[i]),
		),
		reviewBlocks: reviewPicks.map((c, i) =>
			sectionBlock("repertoire-review", c, reviewMinutes[i]),
		),
		leftoverMinutes,
	};
}

export interface StabilizingLineResult {
	blocks: PlannedBlock[];
	/** Minutes no block could take — the caller redistributes them. */
	leftoverMinutes: number;
}

/**
 * Splits the stabilizing line into time-boxed blocks on distinct sections. When
 * the pool is thinner than the split asked for, the remaining blocks are capped
 * at `STABILIZING_BLOCK_MAX` rather than absorbing the whole line.
 */
export function pickRepertoireStabilizingBlocks(
	pieces: Piece[],
	sections: Section[],
	allocatedMinutes: number,
	now: Date = new Date(),
	usedSectionIds?: Set<string>,
	usedPieceIds?: Set<string>,
): StabilizingLineResult {
	if (allocatedMinutes <= 0) return { blocks: [], leftoverMinutes: 0 };

	const wanted = splitStabilizingLine(allocatedMinutes);
	const pool = stabilizingLinePool(
		pieces,
		sections,
		now,
		usedSectionIds,
		usedPieceIds,
	);
	const picks = takeDistinct(sortCandidates(pool), wanted.length, new Set());
	if (picks.length === 0) {
		return { blocks: [], leftoverMinutes: allocatedMinutes };
	}

	const per =
		picks.length === wanted.length
			? allocatedMinutes / wanted.length
			: Math.min(STABILIZING_BLOCK_MAX, allocatedMinutes / picks.length);
	return {
		blocks: picks.map((c) => sectionBlock("repertoire-stabilizing", c, per)),
		leftoverMinutes: Math.max(0, allocatedMinutes - per * picks.length),
	};
}

const BLOCK_CAP: Partial<Record<BlockKind, number>> = {
	"repertoire-learning": LEARNING_BLOCK_MAX,
	"repertoire-review": REVIEW_BLOCK_MAX,
	"repertoire-stabilizing": STABILIZING_BLOCK_MAX,
};

/**
 * Spreads unplaceable minutes over section blocks in proportion to their current
 * allocation, never past each block's cap — the caps are the reason those
 * minutes had nowhere to go in the first place. Mutates the blocks and returns
 * whatever still could not be placed.
 */
function distributeUpToCaps(minutes: number, blocks: PlannedBlock[]): number {
	let remaining = minutes;
	// Each round fills at least one block to its cap, so this terminates.
	for (let round = 0; round <= blocks.length && remaining > EPS; round++) {
		const open = blocks.filter(
			(b) => b.allocatedMinutes < (BLOCK_CAP[b.kind] ?? 0) - EPS,
		);
		if (open.length === 0) break;
		const total = sum(open.map((b) => b.allocatedMinutes));
		let placed = 0;
		for (const b of open) {
			const share =
				total > 0
					? (remaining * b.allocatedMinutes) / total
					: remaining / open.length;
			const cap = BLOCK_CAP[b.kind] ?? 0;
			const add = Math.min(share, cap - b.allocatedMinutes);
			b.allocatedMinutes += add;
			placed += add;
		}
		if (placed <= EPS) break;
		remaining -= placed;
	}
	return Math.max(0, remaining);
}

// Per-piece maintenance cost in minutes: a full play-through + 20% buffer when
// a duration is known, otherwise a flat 5-minute guess (no buffer). Fractional —
// display rounding is the caller's job.
function maintenanceCost(piece: Piece): number {
	if (piece.durationSeconds != null) {
		return Math.max(1, (piece.durationSeconds / 60) * 1.2);
	}
	return 5;
}

/**
 * How far past its budget the maintenance group may run, in minutes. The cap is
 * on the whole group, not per piece — three packed pieces each overrunning by 3
 * would put the session 9 minutes long, which is the bug this exists to fix.
 */
export const MAINTENANCE_INFLATION_CAP_MINUTES = 3;

// Float slack so a piece landing exactly on the allowance is taken.
const FIT_EPSILON = 1e-9;

export interface MaintenancePackOptions {
	/**
	 * The user opted into an oversized piece: it becomes the only maintenance
	 * block, at full cost. A swap, not an addition. Ignored when the piece is not
	 * in the eligible pool.
	 */
	forcedMaintenancePieceId?: string | null;
}

export interface MaintenancePackResult {
	blocks: PlannedBlock[];
	leftoverMinutes: number;
	/** Maintenance minutes beyond the budget. 0 when nothing overran. */
	inflationMinutes: number;
	/** Best-scored eligible piece that can never fit, offered as an opt-in. */
	optIn: MaintenanceOptIn | null;
}

function maintenanceBlock(piece: Piece, score: number): PlannedBlock {
	return {
		kind: "repertoire-maintenance",
		allocatedMinutes: maintenanceCost(piece),
		pieceId: piece.id ?? null,
		sectionId: null,
		title: piece.title,
		subtitle: piece.composer,
		score,
	};
}

/**
 * Packs maintenance pieces best-score-first, one block per piece, allowing the
 * group to run at most `MAINTENANCE_INFLATION_CAP_MINUTES` past its budget. A
 * piece that does not fit is skipped and scanning continues, so the next-best
 * piece that *does* fit is scheduled instead of the session silently inflating.
 *
 * The best-scored piece whose own cost can never fit the allowance is returned
 * as `optIn` — the setup screen offers it as an explicit checkbox, and ticking
 * it re-plans with `options.forcedMaintenancePieceId`.
 */
export function pickRepertoireMaintenanceBlocks(
	pieces: Piece[],
	budgetMinutes: number,
	now: Date = new Date(),
	usedPieceIds?: Set<string>,
	options?: MaintenancePackOptions,
): MaintenancePackResult {
	// No maintenance budget → no maintenance block and nothing to offer. A
	// 15-minute session is not the place to propose a 14-minute piece.
	if (budgetMinutes <= 0) {
		return { blocks: [], leftoverMinutes: 0, inflationMinutes: 0, optIn: null };
	}

	const pool = eligibleMaintenancePieces(pieces, now, usedPieceIds);
	if (pool.length === 0) {
		return {
			blocks: [],
			leftoverMinutes: budgetMinutes,
			inflationMinutes: 0,
			optIn: null,
		};
	}
	const scored = pool.map((piece) => ({
		piece,
		score: scoreMaintenancePiece(piece, now),
	}));
	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return compareTitle(a.piece.title, b.piece.title);
	});

	const forcedId = options?.forcedMaintenancePieceId;
	if (forcedId) {
		const forced = scored.find((s) => s.piece.id === forcedId);
		if (forced) {
			const cost = maintenanceCost(forced.piece);
			return {
				blocks: [maintenanceBlock(forced.piece, forced.score)],
				leftoverMinutes: 0,
				inflationMinutes: Math.max(0, cost - budgetMinutes),
				optIn: null,
			};
		}
		// Not eligible any more (practiced today, restated, taken by another slot)
		// → fall through to normal packing.
	}

	const allowance = budgetMinutes + MAINTENANCE_INFLATION_CAP_MINUTES;
	const blocks: PlannedBlock[] = [];
	let used = 0;
	let optIn: MaintenanceOptIn | null = null;
	for (const { piece, score } of scored) {
		const cost = maintenanceCost(piece);
		if (used + cost <= allowance + FIT_EPSILON) {
			blocks.push(maintenanceBlock(piece, score));
			used += cost;
			continue;
		}
		// Offer the best-scored piece that can never fit — one that is merely
		// crowded out by earlier picks would fit on its own and is not a choice.
		if (!optIn && piece.id && cost > allowance + FIT_EPSILON) {
			optIn = {
				pieceId: piece.id,
				title: piece.title,
				subtitle: piece.composer,
				costMinutes: cost,
				extraMinutes: Math.max(0, cost - budgetMinutes),
				daysSinceLastPracticed: daysSince(piece.lastPracticed ?? null, now),
			};
		}
	}

	return {
		blocks,
		leftoverMinutes: Math.max(0, budgetMinutes - used),
		inflationMinutes: Math.max(0, used - budgetMinutes),
		optIn,
	};
}

function computeTechniqueSplit(
	slotMin: number,
	count: number,
): { active: number; maintenance: number } {
	if (slotMin < 8) return { active: count, maintenance: 0 };
	if (slotMin <= 14) {
		if (count <= 1) return { active: count, maintenance: 0 };
		return { active: count - 1, maintenance: 1 };
	}
	if (count === 1) return { active: 1, maintenance: 0 };
	if (count === 2) return { active: 1, maintenance: 1 };
	return { active: 1, maintenance: 2 };
}

export function pickTechnique(
	slotMin: number,
	techniques: TechniqueItem[],
	now: Date = new Date(),
	usedTechniqueIds?: Set<string>,
): PlannedBlock[] {
	if (slotMin <= 0) return [];
	let count = clamp(Math.floor(slotMin / 5), 1, 3);
	while (count >= 2 && Math.floor(slotMin / count) < 3) {
		count -= 1;
	}
	if (count < 1) count = 1;

	const active = eligibleTechniquesInState(
		techniques,
		"active",
		now,
		usedTechniqueIds,
	);
	const maintenance = eligibleTechniquesInState(
		techniques,
		"maintenance",
		now,
		usedTechniqueIds,
	);

	if (active.length === 0 && maintenance.length === 0) return [];

	const split = computeTechniqueSplit(slotMin, count);
	let activeCount = Math.min(split.active, active.length);
	let maintCount = Math.min(split.maintenance, maintenance.length);
	let remaining = count - activeCount - maintCount;
	if (remaining > 0 && maintenance.length > maintCount) {
		const add = Math.min(remaining, maintenance.length - maintCount);
		maintCount += add;
		remaining -= add;
	}
	if (remaining > 0 && active.length > activeCount) {
		const add = Math.min(remaining, active.length - activeCount);
		activeCount += add;
		remaining -= add;
	}
	count = activeCount + maintCount;
	if (count === 0) return [];

	while (count >= 2 && Math.floor(slotMin / count) < 3) {
		if (maintCount >= activeCount && maintCount > 0) {
			maintCount -= 1;
		} else if (activeCount > 0) {
			activeCount -= 1;
		}
		count = activeCount + maintCount;
	}
	if (count === 0) return [];

	const sortedActive = sortTechniques(active, now).slice(0, activeCount);
	const sortedMaint = sortTechniques(maintenance, now).slice(0, maintCount);

	// Exact split — the count heuristics above still use whole-minute floors, but
	// the minutes handed to each technique no longer need remainder patching.
	const perTech = slotMin / count;

	const picks = [...sortedActive, ...sortedMaint];
	const blocks: PlannedBlock[] = picks.map((p) => ({
		kind: "technique" as const,
		allocatedMinutes: perTech,
		techniqueId: p.tech.id ?? null,
		title: p.tech.title,
		subtitle: null,
		score: p.score,
		modeKey: p.modeKey,
	}));
	return blocks;
}

export function pickWarmup(
	techniques: TechniqueItem[],
	allocatedMinutes: number,
	now: Date = new Date(),
	usedTechniqueIds?: Set<string>,
): PlannedBlock {
	const pool = eligibleTechniquesInState(
		techniques,
		"maintenance",
		now,
		usedTechniqueIds,
	);
	if (pool.length === 0) {
		return {
			kind: "warmup",
			allocatedMinutes,
			techniqueId: null,
			title: null,
			subtitle: null,
		};
	}
	const sorted = pool.slice().sort((a, b) => {
		const aDays = daysSince(a.lastPracticedAt ?? null, now);
		const bDays = daysSince(b.lastPracticedAt ?? null, now);
		if (bDays !== aDays) return bDays - aDays;
		const aDate = a.dateIntroduced.getTime();
		const bDate = b.dateIntroduced.getTime();
		if (aDate !== bDate) return aDate - bDate;
		return compareTitle(a.title, b.title);
	});
	const pick = sorted[0];
	return {
		kind: "warmup",
		allocatedMinutes,
		techniqueId: pick.id ?? null,
		title: pick.title,
		subtitle: null,
		// Warmup is picked by staleness alone, but the student still deserves to
		// land on the mode that needs work most within it.
		modeKey: scoreTechniqueModes(pick, now).modeKey,
	};
}

const REDISTRIBUTABLE_SLOTS = [
	"technique",
	"sightReading",
	"repertoireLearning",
	"repertoireStabilizing",
	"repertoireMaintenance",
] as const;

export type RedistributableSlot = (typeof REDISTRIBUTABLE_SLOTS)[number];

export type SlotMinutes = Record<RedistributableSlot, number>;
export type SlotAvailability = Record<RedistributableSlot, boolean>;

/**
 * Build-time, empty-content redistribution. Every slot that has minutes but no
 * eligible content is zeroed and its minutes pooled, then spread across the
 * surviving (available) slots in proportion to their current allocation. The
 * shares are exact, so the total is conserved without integer patching. Warmup
 * is never part of this and is handled separately.
 */
export function redistributeForAvailability(
	alloc: SlotMinutes,
	available: SlotAvailability,
): SlotMinutes {
	const result: SlotMinutes = { ...alloc };
	let freed = 0;
	for (const slot of REDISTRIBUTABLE_SLOTS) {
		if (result[slot] > 0 && !available[slot]) {
			freed += result[slot];
			result[slot] = 0;
		}
	}
	if (freed <= 0) return result;

	const recipients = REDISTRIBUTABLE_SLOTS.filter(
		(slot) => result[slot] > 0 && available[slot],
	);
	if (recipients.length === 0) return result; // nothing to receive → dropped

	const totalAlloc = recipients.reduce((acc, slot) => acc + result[slot], 0);
	const shares = recipients.map((slot) => (freed * result[slot]) / totalAlloc);
	recipients.forEach((slot, i) => {
		result[slot] += shares[i];
	});
	return result;
}

function hasEligibleTechnique(techniques: TechniqueItem[], now: Date): boolean {
	return (
		eligibleTechniquesInState(techniques, "active", now).length > 0 ||
		eligibleTechniquesInState(techniques, "maintenance", now).length > 0
	);
}

function hasPiecesInState(pieces: Piece[], state: Piece["state"]): boolean {
	return pieces.some((p) => p.state === state);
}

/**
 * Whether the stabilizing line has *any* raw content, ignoring today's
 * exclusions — a promoted piece, or a problem section inside an otherwise fine
 * one. Decides between the "practiced today" and "nothing to practise" wording.
 */
function hasStabilizingLineContent(
	pieces: Piece[],
	sections: Section[],
): boolean {
	if (hasPiecesInState(pieces, "stabilizing")) return true;
	const problemPieceIds = new Set(
		pieces
			.filter((p) => p.state === "maintenance" || p.state === "performance")
			.map((p) => p.id)
			.filter((id): id is string => !!id),
	);
	return sections.some(
		(s) =>
			!s.archived &&
			problemPieceIds.has(s.pieceId) &&
			(s.phase === "stabilizing" || s.phase === "learning"),
	);
}

/** Whether any learning-state piece has an already-learned section to review. */
function hasReviewContent(pieces: Piece[], sections: Section[]): boolean {
	const learningPieceIds = new Set(
		pieces
			.filter((p) => p.state === "learning")
			.map((p) => p.id)
			.filter((id): id is string => !!id),
	);
	return sections.some(
		(s) =>
			!s.archived &&
			learningPieceIds.has(s.pieceId) &&
			(s.phase === "stabilizing" || s.phase === "maintenance"),
	);
}

function hasAnyTechniqueInPool(techniques: TechniqueItem[]): boolean {
	return techniques.some(
		(t) => t.state === "active" || t.state === "maintenance",
	);
}

function omittedReason(rawExists: boolean): OmittedReason {
	return rawExists ? "practiced-today" : "no-content";
}

export interface BuildPlanOptions {
	/** The user ticked the oversized-maintenance opt-in for this piece. */
	forcedMaintenancePieceId?: string | null;
	/** The preset this session came from. `null`/absent for a Custom session. */
	presetId?: string | null;
	presetName?: string;
}

/**
 * The session's real length: the allocated minutes plus whatever maintenance
 * overran by. `plan.totalMinutes` stays the *allocated* value, so every screen
 * showing a real total goes through here rather than re-deriving it.
 */
export function planTotalMinutes(plan: SessionPlan): number {
	return plan.totalMinutes + (plan.inflationMinutes ?? 0);
}

export function buildPlan(
	alloc: SessionAllocation,
	pieces: Piece[],
	sections: Section[],
	techniques: TechniqueItem[],
	now: Date = new Date(),
	options?: BuildPlanOptions,
): SessionPlan {
	const omitted: OmittedSlot[] = [];

	// Availability flags (warmup excluded — it has its own freeform fallback).
	const techniqueEligible = hasEligibleTechnique(techniques, now);
	const pools = learningLinePools(pieces, sections, now);
	// The line survives on review alone: with nothing new to acquire today, its
	// minutes are better spent on that piece's learned sections than handed away.
	const learningEligible = pools.learning.length > 0 || pools.review.length > 0;
	const stabilizingEligible =
		stabilizingLinePool(pieces, sections, now).length > 0;
	const maintenanceEligible = eligibleMaintenancePieces(pieces, now).length > 0;

	const baseAlloc: SlotMinutes = {
		technique: alloc.technique,
		sightReading: alloc.sightReading,
		repertoireLearning: alloc.repertoireLearning,
		repertoireStabilizing: alloc.repertoireStabilizing,
		repertoireMaintenance: alloc.repertoireMaintenance,
	};
	const available: SlotAvailability = {
		technique: techniqueEligible,
		// Sight-reading is a freeform timer — always runnable when it has minutes.
		sightReading: alloc.sightReading > 0,
		repertoireLearning: learningEligible,
		repertoireStabilizing: stabilizingEligible,
		repertoireMaintenance: maintenanceEligible,
	};

	// Record omitted entries for slots that get zeroed (the setup preview uses them).
	if (baseAlloc.technique > 0 && !available.technique) {
		omitted.push({
			kind: "technique",
			reason: omittedReason(hasAnyTechniqueInPool(techniques)),
			redistributedMinutes: baseAlloc.technique,
		});
	}
	if (baseAlloc.repertoireLearning > 0 && !available.repertoireLearning) {
		omitted.push({
			kind: "repertoire-learning",
			reason: omittedReason(hasPiecesInState(pieces, "learning")),
			redistributedMinutes: baseAlloc.repertoireLearning,
		});
	}
	if (baseAlloc.repertoireStabilizing > 0 && !available.repertoireStabilizing) {
		omitted.push({
			kind: "repertoire-stabilizing",
			reason: omittedReason(hasStabilizingLineContent(pieces, sections)),
			redistributedMinutes: baseAlloc.repertoireStabilizing,
		});
	}
	if (baseAlloc.repertoireMaintenance > 0 && !available.repertoireMaintenance) {
		omitted.push({
			kind: "repertoire-maintenance",
			reason: omittedReason(
				hasPiecesInState(pieces, "maintenance") ||
					hasPiecesInState(pieces, "performance"),
			),
			redistributedMinutes: baseAlloc.repertoireMaintenance,
		});
	}

	const updated = redistributeForAvailability(baseAlloc, available);

	const usedTechniqueIds = new Set<string>();
	const warmupBlock: PlannedBlock | null =
		alloc.warmup > 0 ? pickWarmup(techniques, alloc.warmup, now) : null;
	if (warmupBlock?.techniqueId) usedTechniqueIds.add(warmupBlock.techniqueId);

	const techBlocks = pickTechnique(
		updated.technique,
		techniques,
		now,
		usedTechniqueIds,
	);
	for (const tb of techBlocks) {
		if (tb.techniqueId) usedTechniqueIds.add(tb.techniqueId);
	}

	const usedSectionIds = new Set<string>();
	const usedPieceIds = new Set<string>();

	const markUsed = (blocks: PlannedBlock[]): void => {
		for (const b of blocks) {
			if (b.sectionId) usedSectionIds.add(b.sectionId);
			if (b.pieceId) usedPieceIds.add(b.pieceId);
		}
	};

	const learning = pickRepertoireLearningBlocks(
		pieces,
		sections,
		updated.repertoireLearning,
		now,
		usedSectionIds,
		usedPieceIds,
	);
	markUsed([...learning.reviewBlocks, ...learning.learningBlocks]);

	const stabilizing = pickRepertoireStabilizingBlocks(
		pieces,
		sections,
		updated.repertoireStabilizing,
		now,
		usedSectionIds,
		usedPieceIds,
	);
	markUsed(stabilizing.blocks);

	const {
		blocks: maintenanceBlocks,
		leftoverMinutes,
		inflationMinutes,
		optIn: maintenanceOptIn,
	} = pickRepertoireMaintenanceBlocks(
		pieces,
		updated.repertoireMaintenance,
		now,
		usedPieceIds,
		{ forcedMaintenancePieceId: options?.forcedMaintenancePieceId },
	);
	markUsed(maintenanceBlocks);

	const sightBlock: PlannedBlock | null =
		updated.sightReading > 0
			? {
					kind: "sight-reading",
					allocatedMinutes: updated.sightReading,
					title: null,
					subtitle: null,
				}
			: null;

	// Everything the section blocks could not take: maintenance pieces that did
	// not fit their budget, plus learning/stabilizing minutes the block caps
	// refused. Fill the section blocks up to their caps, then let the freeform
	// reading timer absorb the rest; anything beyond that the session runs short.
	let unplaced = distributeUpToCaps(
		leftoverMinutes + learning.leftoverMinutes + stabilizing.leftoverMinutes,
		[
			...learning.reviewBlocks,
			...learning.learningBlocks,
			...stabilizing.blocks,
		],
	);
	if (unplaced > EPS && sightBlock) {
		sightBlock.allocatedMinutes += unplaced;
		unplaced = 0;
	}
	if (learning.leftoverMinutes > EPS) {
		// The learning line got its blocks but not all of its minutes: the block
		// caps refused the rest and there was nothing to review. Filed under
		// `repertoire-review` rather than `repertoire-learning` so the preview says
		// which half of the line came up empty — and so it can never collide with
		// the whole-line entry pushed above.
		omitted.push({
			kind: "repertoire-review",
			reason: omittedReason(hasReviewContent(pieces, sections)),
			redistributedMinutes: learning.leftoverMinutes,
		});
	}

	const byKind: Partial<Record<BlockKind, PlannedBlock | PlannedBlock[]>> = {
		warmup: warmupBlock ?? undefined,
		technique: techBlocks.length > 0 ? techBlocks : undefined,
		"sight-reading": sightBlock ?? undefined,
		"repertoire-review":
			learning.reviewBlocks.length > 0 ? learning.reviewBlocks : undefined,
		"repertoire-learning":
			learning.learningBlocks.length > 0 ? learning.learningBlocks : undefined,
		"repertoire-stabilizing":
			stabilizing.blocks.length > 0 ? stabilizing.blocks : undefined,
		"repertoire-maintenance":
			maintenanceBlocks.length > 0 ? maintenanceBlocks : undefined,
	};

	const blocks: PlannedBlock[] = [];
	for (const kind of CANONICAL_BLOCK_ORDER) {
		const entry = byKind[kind];
		if (!entry) continue;
		if (Array.isArray(entry)) {
			blocks.push(...entry);
		} else {
			blocks.push(entry);
		}
	}

	return {
		presetId: options?.presetId ?? null,
		presetName: options?.presetName ?? "",
		totalMinutes: allocationTotalMinutes(alloc),
		blocks,
		generatedAt: now.toISOString(),
		omitted,
		inflationMinutes,
		maintenanceOptIn,
	};
}
