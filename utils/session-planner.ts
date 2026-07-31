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

/**
 * One canonical order for every preset. Reading sits directly after warmup: it
 * is demanding on the brain but light on the hands, so it extends the warmup
 * rather than competing with technique — and reading last only trains guessing.
 * Disabled lines simply vanish from the sequence.
 */
export const CANONICAL_BLOCK_ORDER: BlockKind[] = [
	"warmup",
	"sight-reading",
	"technique",
	"repertoire-learning",
	"repertoire-stabilizing",
	"repertoire-maintenance",
];

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

function compareTitle(a: string, b: string): number {
	return a.localeCompare(b);
}

function eligibleSectionCandidates(
	slot: "learning" | "stabilizing",
	pieces: Piece[],
	sections: Section[],
	now: Date,
	usedSectionIds?: Set<string>,
): SectionCandidate[] {
	const filteredPieces = pieces.filter((p) => p.state === slot);
	const candidates = buildSectionCandidates(filteredPieces, sections, now);
	return candidates.filter((c) => {
		// Per-mode: a section drilled left hand this morning can return for right.
		if (c.practicedToday) return false;
		if (usedSectionIds && c.section?.id && usedSectionIds.has(c.section.id))
			return false;
		return true;
	});
}

function pickBestSection(
	candidates: SectionCandidate[],
): SectionCandidate | null {
	if (candidates.length === 0) return null;
	return candidates.slice().sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const titleCmp = compareTitle(a.piece.title, b.piece.title);
		if (titleCmp !== 0) return titleCmp;
		const aOrder = a.section?.order ?? -1;
		const bOrder = b.section?.order ?? -1;
		return aOrder - bOrder;
	})[0];
}

export function pickRepertoireSection(
	slot: "learning" | "stabilizing",
	pieces: Piece[],
	sections: Section[],
	allocatedMinutes: number,
	now: Date = new Date(),
	usedSectionIds?: Set<string>,
): PlannedBlock | null {
	const candidates = eligibleSectionCandidates(
		slot,
		pieces,
		sections,
		now,
		usedSectionIds,
	);
	const best = pickBestSection(candidates);
	if (!best) return null;
	const kind: BlockKind =
		slot === "learning" ? "repertoire-learning" : "repertoire-stabilizing";
	return {
		kind,
		allocatedMinutes,
		pieceId: best.piece.id ?? null,
		sectionId: best.section?.id ?? null,
		title: best.piece.title,
		subtitle: best.section?.label ?? null,
		score: best.score,
		modeKey: best.modeKey,
	};
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

/**
 * Add maintenance leftover minutes to the learning/stabilizing blocks in exact
 * proportion to their current allocation. Mutates blocks in place. Dropped if
 * neither block exists.
 */
function applyMaintenanceLeftover(
	leftoverMinutes: number,
	learningBlock: PlannedBlock | null,
	stabilizingBlock: PlannedBlock | null,
): void {
	if (leftoverMinutes <= 0) return;
	const recipients = [learningBlock, stabilizingBlock].filter(
		(b): b is PlannedBlock => b != null,
	);
	if (recipients.length === 0) return;
	const totalAlloc = recipients.reduce((acc, b) => acc + b.allocatedMinutes, 0);
	const shares = recipients.map((b) =>
		totalAlloc > 0
			? (leftoverMinutes * b.allocatedMinutes) / totalAlloc
			: leftoverMinutes / recipients.length,
	);
	recipients.forEach((b, i) => {
		b.allocatedMinutes += shares[i];
	});
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
	const learningEligible =
		eligibleSectionCandidates("learning", pieces, sections, now).length > 0;
	const stabilizingEligible =
		eligibleSectionCandidates("stabilizing", pieces, sections, now).length > 0;
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
			reason: omittedReason(hasPiecesInState(pieces, "stabilizing")),
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

	const learningBlock =
		updated.repertoireLearning > 0
			? pickRepertoireSection(
					"learning",
					pieces,
					sections,
					updated.repertoireLearning,
					now,
					usedSectionIds,
				)
			: null;
	if (learningBlock?.sectionId) usedSectionIds.add(learningBlock.sectionId);
	if (learningBlock?.pieceId) usedPieceIds.add(learningBlock.pieceId);

	const stabilizingBlock =
		updated.repertoireStabilizing > 0
			? pickRepertoireSection(
					"stabilizing",
					pieces,
					sections,
					updated.repertoireStabilizing,
					now,
					usedSectionIds,
				)
			: null;
	if (stabilizingBlock?.sectionId)
		usedSectionIds.add(stabilizingBlock.sectionId);
	if (stabilizingBlock?.pieceId) usedPieceIds.add(stabilizingBlock.pieceId);

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
	for (const mb of maintenanceBlocks) {
		if (mb.pieceId) usedPieceIds.add(mb.pieceId);
	}

	applyMaintenanceLeftover(leftoverMinutes, learningBlock, stabilizingBlock);

	const sightBlock: PlannedBlock | null =
		updated.sightReading > 0
			? {
					kind: "sight-reading",
					allocatedMinutes: updated.sightReading,
					title: null,
					subtitle: null,
				}
			: null;

	const byKind: Partial<Record<BlockKind, PlannedBlock | PlannedBlock[]>> = {
		warmup: warmupBlock ?? undefined,
		technique: techBlocks.length > 0 ? techBlocks : undefined,
		"sight-reading": sightBlock ?? undefined,
		"repertoire-learning": learningBlock ?? undefined,
		"repertoire-stabilizing": stabilizingBlock ?? undefined,
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
