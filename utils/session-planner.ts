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
	LEARNING_BLOCK_MAX,
	LEARNING_BLOCK_MIN,
	REVIEW_BLOCK_MAX,
	REVIEW_BLOCK_MIN,
	STABILIZING_BLOCK_MAX,
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

/**
 * The learning line only ever looks at pieces whose *state* is `learning`, and
 * ranks every phase in **one** pool — the score is comparable across phases now
 * (`planner-scoring` §3.1), so a section neglected for a week can out-rank new
 * acquisition without a reserved share forcing it.
 *
 * The order is piece-anchored: pieces are ranked by their best candidate, and
 * *every* candidate of the top piece precedes every candidate of the second,
 * regardless of score. That is what makes review pedagogically meaningful —
 * you warm into the new bars through the ones that precede them, in the same
 * piece, in the same session. Within a piece, score decides.
 */
export function learningLinePool(
	pieces: Piece[],
	sections: Section[],
	now: Date,
	usedSectionIds?: Set<string>,
	usedPieceIds?: Set<string>,
): SectionCandidate[] {
	const learningPieces = pieces.filter((p) => p.state === "learning");
	const available = stillAvailable(
		buildSectionCandidates(learningPieces, sections, now),
		usedSectionIds,
		usedPieceIds,
	);

	// Score order first, so the first candidate seen for a piece is that piece's
	// best — insertion order into the map is therefore the piece ranking.
	const byPiece = new Map<string, SectionCandidate[]>();
	for (const c of sortCandidates(available)) {
		const key = c.piece.id ?? `title:${c.piece.title}`;
		const group = byPiece.get(key);
		if (group) group.push(c);
		else byPiece.set(key, [c]);
	}
	return Array.from(byPiece.values()).flat();
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
			? learningLinePool(pieces, sections, now, usedSectionIds, usedPieceIds)
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
 * Block bounds are a property of the *phase the candidate landed on*, not of
 * which half of a split it came from: new acquisition needs 8–12 minutes, a
 * review of learned material 6–9.
 */
function blockBounds(candidate: SectionCandidate): {
	min: number;
	max: number;
} {
	return candidate.phase === "learning"
		? { min: LEARNING_BLOCK_MIN, max: LEARNING_BLOCK_MAX }
		: { min: REVIEW_BLOCK_MIN, max: REVIEW_BLOCK_MAX };
}

/**
 * Fills the learning line greedily off one score-ranked, piece-anchored pool
 * (`learningLinePool`): take the best candidate, size the block by the phase it
 * landed on, and keep adding while the chosen set genuinely cannot absorb the
 * minutes on its own.
 *
 * There is no reserved review share any more. Whether the session is all-new,
 * all-review or mixed falls out of the scores, and the score has its own
 * back-pressure — every section accrues `PHASE_SCORE·days` while it waits and
 * resets to zero when picked, so the line can never lock into one mode. See
 * `docs/specs/learning-line-greedy-selection.md` §4.
 *
 * Minutes: every block gets its floor, then the remainder is spread in
 * proportion to each block's headroom so they all reach their maximum together.
 * Blocks never exceed their maximum to absorb leftovers — the maximum is a
 * pedagogical ceiling, not a rounding target — so whatever is left comes back
 * as `leftoverMinutes` for the caller to redistribute.
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

	const ordered = learningLinePool(
		pieces,
		sections,
		now,
		usedSectionIds,
		usedPieceIds,
	);
	if (ordered.length === 0) {
		return { ...empty, leftoverMinutes: allocatedMinutes };
	}

	const bounds = ordered.map(blockBounds);
	const chosen = [0];
	const sumMin = (): number => sum(chosen.map((i) => bounds[i].min));
	const sumMax = (): number => sum(chosen.map((i) => bounds[i].max));

	// `sumMax < L` is the anti-fragmentation guard: only add a block when the
	// current set cannot legally take the time. `sumMin + next.min <= L` is the
	// legality guard: only add one when every block can still reach its floor.
	for (let i = 1; i < ordered.length; i++) {
		if (sumMax() >= allocatedMinutes - EPS) break;
		if (sumMin() + bounds[i].min > allocatedMinutes + EPS) break;
		chosen.push(i);
	}

	const base = sumMin();
	let minutes: number[];
	let leftoverMinutes: number;
	if (base > allocatedMinutes + EPS) {
		// Below the best candidate's floor. Unreachable through the presets, but a
		// short block beats no block at all.
		minutes = [allocatedMinutes];
		chosen.length = 1;
		leftoverMinutes = 0;
	} else {
		const headroom = chosen.map((i) => bounds[i].max - bounds[i].min);
		const totalHeadroom = sum(headroom);
		const rem = Math.min(allocatedMinutes - base, totalHeadroom);
		minutes = chosen.map(
			(i, n) =>
				bounds[i].min +
				(totalHeadroom > 0 ? (rem * headroom[n]) / totalHeadroom : 0),
		);
		leftoverMinutes = Math.max(0, allocatedMinutes - base - rem);
	}

	const learningBlocks: PlannedBlock[] = [];
	const reviewBlocks: PlannedBlock[] = [];
	chosen.forEach((i, n) => {
		const candidate = ordered[i];
		if (candidate.phase === "learning") {
			learningBlocks.push(
				sectionBlock("repertoire-learning", candidate, minutes[n]),
			);
		} else {
			reviewBlocks.push(
				sectionBlock("repertoire-review", candidate, minutes[n]),
			);
		}
	});

	// The piece anchor decides *which* sections run; within a kind the student
	// still meets the one that needs work most first.
	const byScoreDesc = (a: PlannedBlock, b: PlannedBlock) =>
		(b.score ?? 0) - (a.score ?? 0);
	learningBlocks.sort(byScoreDesc);
	reviewBlocks.sort(byScoreDesc);

	return { learningBlocks, reviewBlocks, leftoverMinutes };
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
	// The line survives on review alone: with nothing new to acquire today, its
	// minutes are better spent on that piece's learned sections than handed away.
	const learningEligible = learningLinePool(pieces, sections, now).length > 0;
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
		// The learning line got its blocks but not all of its minutes: either the
		// pool ran out of eligible sections or every chosen block hit its ceiling.
		// Filed under `repertoire-review` so it can never collide with the
		// whole-line `repertoire-learning` entry pushed above.
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
