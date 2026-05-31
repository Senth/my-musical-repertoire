import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";
import type {
	BlockKind,
	OmittedReason,
	OmittedSlot,
	PlannedBlock,
	SessionEmphasis,
	SessionInputs,
	SessionPlan,
} from "@/models/session";
import type { TechniqueItem } from "@/models/technique";
import { isPracticedToday } from "./day-boundary";
import {
	buildSectionCandidates,
	daysSince,
	eligibleMaintenancePieces,
	eligibleTechniquesInState,
	type SectionCandidate,
	scoreMaintenancePiece,
	sortTechniques,
} from "./planner-scoring";

export interface AllocationResult {
	warmup: number;
	technique: number;
	sightReading: number;
	repertoireLearning: number;
	repertoireStabilizing: number;
	repertoireMaintenance: number;
	repertoireTotal: number;
}

const REF_ROWS: Record<SessionEmphasis, number[][]> = {
	balanced: [
		[15, 3, 2, 10, 0],
		[30, 7, 4, 19, 0],
		[45, 10, 6, 29, 0],
		[60, 12, 8, 35, 5],
	],
	"technique-heavy": [
		[15, 6, 0, 9, 0],
		[30, 14, 2, 14, 0],
		[45, 20, 3, 22, 0],
		[60, 23, 4, 28, 5],
	],
	"reading-heavy": [
		[15, 2, 4, 9, 0],
		[30, 5, 9, 16, 0],
		[45, 7, 13, 25, 0],
		[60, 8, 17, 30, 5],
	],
	"repertoire-only": [
		[15, 0, 0, 15, 0],
		[30, 0, 0, 30, 0],
		[45, 0, 0, 45, 0],
		[60, 0, 0, 55, 5],
	],
};

const ORDER_BY_EMPHASIS: Record<SessionEmphasis, BlockKind[]> = {
	balanced: [
		"warmup",
		"technique",
		"sight-reading",
		"repertoire-learning",
		"repertoire-stabilizing",
		"repertoire-maintenance",
	],
	"technique-heavy": [
		"warmup",
		"technique",
		"repertoire-learning",
		"repertoire-stabilizing",
		"sight-reading",
		"repertoire-maintenance",
	],
	"reading-heavy": [
		"warmup",
		"sight-reading",
		"technique",
		"repertoire-learning",
		"repertoire-stabilizing",
		"repertoire-maintenance",
	],
	"repertoire-only": [
		"warmup",
		"repertoire-learning",
		"repertoire-stabilizing",
		"repertoire-maintenance",
	],
};

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

function interpolateRow(
	emphasis: SessionEmphasis,
	total: number,
): { tech: number; read: number; rep: number; warmup: number } {
	const rows = REF_ROWS[emphasis];
	const clamped = clamp(total, 15, 90);
	let lo = rows[0];
	let hi = rows[rows.length - 1];
	for (let i = 0; i < rows.length - 1; i++) {
		if (clamped >= rows[i][0] && clamped <= rows[i + 1][0]) {
			lo = rows[i];
			hi = rows[i + 1];
			break;
		}
	}
	if (clamped > 60) {
		lo = rows[2];
		hi = rows[3];
	}
	const span = hi[0] - lo[0];
	const t = span === 0 ? 0 : (clamped - lo[0]) / span;
	const tech = lo[1] + (hi[1] - lo[1]) * t;
	const read = lo[2] + (hi[2] - lo[2]) * t;
	const rep = lo[3] + (hi[3] - lo[3]) * t;
	const warmup = clamped >= 60 ? 5 : 0;
	return { tech, read, rep, warmup };
}

function splitRepertoire(repTotal: number): {
	learning: number;
	stabilizing: number;
	maintenance: number;
} {
	if (repTotal <= 0) {
		return { learning: 0, stabilizing: 0, maintenance: 0 };
	}
	let l: number;
	let s: number;
	let m: number;
	if (repTotal < 7) {
		l = repTotal;
		s = 0;
		m = 0;
	} else if (repTotal < 12) {
		l = Math.round(repTotal * 0.65);
		s = repTotal - l;
		m = 0;
	} else {
		l = Math.round(repTotal * 0.55);
		s = Math.round(repTotal * 0.3);
		m = repTotal - l - s;
		if (m < 0) {
			s += m;
			m = 0;
		}
	}
	return { learning: l, stabilizing: s, maintenance: m };
}

export function allocateTime(inputs: SessionInputs): AllocationResult {
	const clamped = clamp(inputs.totalMinutes, 15, 90);
	const raw = interpolateRow(inputs.emphasis, clamped);

	let tech = Math.round(raw.tech);
	let read = Math.round(raw.read);
	let rep = Math.round(raw.rep);
	const warmup = raw.warmup;

	if (!inputs.techniqueEnabled) {
		rep += tech;
		tech = 0;
	}
	if (!inputs.sightReadingEnabled) {
		rep += read;
		read = 0;
	}

	const sum = tech + read + rep + warmup;
	const slack = clamped - sum;
	rep += slack;
	if (rep < 0) rep = 0;

	const sub = splitRepertoire(rep);

	return {
		warmup,
		technique: tech,
		sightReading: read,
		repertoireLearning: sub.learning,
		repertoireStabilizing: sub.stabilizing,
		repertoireMaintenance: sub.maintenance,
		repertoireTotal: rep,
	};
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
		if (isPracticedToday(c.lastPracticed, now)) return false;
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
	};
}

// Per-piece maintenance cost in minutes: a full play-through + 20% buffer when
// a duration is known, otherwise a flat 5-minute guess (no buffer).
function maintenanceCost(piece: Piece): number {
	if (piece.durationSeconds != null) {
		return Math.max(1, Math.round((piece.durationSeconds / 60) * 1.2));
	}
	return 5;
}

export interface MaintenancePackResult {
	blocks: PlannedBlock[];
	leftoverMinutes: number;
}

/**
 * Packs as many maintenance pieces as fit into the budget, best-score-first,
 * one block per piece. The best piece is always taken (even if it overruns the
 * budget) so maintenance is never empty when eligible pieces exist; subsequent
 * pieces are taken only while they fully fit, stopping at the first that does not.
 */
export function pickRepertoireMaintenanceBlocks(
	pieces: Piece[],
	budgetMinutes: number,
	now: Date = new Date(),
	usedPieceIds?: Set<string>,
): MaintenancePackResult {
	const pool = eligibleMaintenancePieces(pieces, now, usedPieceIds);
	if (pool.length === 0) {
		return { blocks: [], leftoverMinutes: Math.max(0, budgetMinutes) };
	}
	const scored = pool.map((piece) => ({
		piece,
		score: scoreMaintenancePiece(piece, now),
	}));
	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return compareTitle(a.piece.title, b.piece.title);
	});

	const blocks: PlannedBlock[] = [];
	let remaining = budgetMinutes;
	for (let i = 0; i < scored.length; i++) {
		const { piece, score } = scored[i];
		const cost = maintenanceCost(piece);
		// First (best) piece is always taken at full cost, even if it overruns.
		// Any later piece is taken only if it fully fits; otherwise stop.
		if (i > 0 && cost > remaining) break;
		blocks.push({
			kind: "repertoire-maintenance",
			allocatedMinutes: cost,
			pieceId: piece.id ?? null,
			sectionId: null,
			title: piece.title,
			subtitle: piece.composer,
			score,
		});
		remaining -= cost;
	}
	return { blocks, leftoverMinutes: Math.max(0, remaining) };
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

	const perTech = Math.floor(slotMin / count);
	const remainderMin = slotMin - perTech * count;

	const picks = [...sortedActive, ...sortedMaint];
	const blocks: PlannedBlock[] = picks.map((p, idx) => ({
		kind: "technique" as const,
		allocatedMinutes: perTech + (idx === 0 ? remainderMin : 0),
		techniqueId: p.tech.id ?? null,
		title: p.tech.title,
		subtitle: null,
		score: p.score,
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
	};
}

export const REDISTRIBUTABLE_SLOTS = [
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
 * surviving (available) slots in proportion to their current allocation.
 * Integer split via last-gets-remainder so the total is conserved. Warmup is
 * never part of this and is handled separately.
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
	let used = 0;
	for (let i = 0; i < recipients.length; i++) {
		const slot = recipients[i];
		const isLast = i === recipients.length - 1;
		const portion = isLast
			? freed - used
			: Math.round((freed * result[slot]) / totalAlloc);
		result[slot] += portion;
		used += portion;
	}
	return result;
}

/**
 * Add maintenance leftover minutes to the learning/stabilizing blocks in
 * proportion to their current allocation (last-gets-remainder). Mutates blocks
 * in place. Dropped if neither block exists.
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
	let used = 0;
	for (let i = 0; i < recipients.length; i++) {
		const isLast = i === recipients.length - 1;
		const portion = isLast
			? leftoverMinutes - used
			: totalAlloc > 0
				? Math.round(
						(leftoverMinutes * recipients[i].allocatedMinutes) / totalAlloc,
					)
				: Math.round(leftoverMinutes / recipients.length);
		recipients[i].allocatedMinutes += portion;
		used += portion;
	}
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

export function buildPlan(
	inputs: SessionInputs,
	pieces: Piece[],
	sections: Section[],
	techniques: TechniqueItem[],
	now: Date = new Date(),
): SessionPlan {
	const alloc = allocateTime(inputs);
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

	const { blocks: maintenanceBlocks, leftoverMinutes } =
		updated.repertoireMaintenance > 0
			? pickRepertoireMaintenanceBlocks(
					pieces,
					updated.repertoireMaintenance,
					now,
					usedPieceIds,
				)
			: { blocks: [] as PlannedBlock[], leftoverMinutes: 0 };
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

	const order = ORDER_BY_EMPHASIS[inputs.emphasis];
	const blocks: PlannedBlock[] = [];
	for (const kind of order) {
		const entry = byKind[kind];
		if (!entry) continue;
		if (Array.isArray(entry)) {
			blocks.push(...entry);
		} else {
			blocks.push(entry);
		}
	}

	return {
		emphasis: inputs.emphasis,
		totalMinutes: clamp(inputs.totalMinutes, 15, 90),
		blocks,
		generatedAt: now.toISOString(),
		omitted,
	};
}
