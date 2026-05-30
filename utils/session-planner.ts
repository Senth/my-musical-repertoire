import type { Piece } from "@/models/piece";
import type { Section, SectionPhase } from "@/models/section";
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

const PHASE_SCORE: Record<SectionPhase, number> = {
	learning: 10,
	stabilizing: 3,
	maintenance: 1,
};

const MS_PER_DAY = 86_400_000;

function daysSince(date: Date | null | undefined, now: Date): number {
	if (!date) return 999;
	const ms = now.getTime() - date.getTime();
	if (ms < 0) return 0;
	return Math.floor(ms / MS_PER_DAY);
}

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

interface SectionCandidate {
	piece: Piece;
	section: Section | null;
	phase: SectionPhase;
	lastPracticed: Date | null;
	currentBpm: number | null;
	score: number;
}

function scoreSectionCandidate(
	piece: Piece,
	phase: SectionPhase,
	lastPracticed: Date | null,
	currentBpm: number | null,
	now: Date,
): number {
	const phaseScore = PHASE_SCORE[phase];
	const days = daysSince(lastPracticed, now);
	let bpmTerm = 0;
	if (piece.targetTempoBpm != null && currentBpm != null) {
		bpmTerm = Math.max(0, piece.targetTempoBpm - currentBpm);
	}
	return phaseScore * days + bpmTerm;
}

function buildSectionCandidates(
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
				score,
			});
		} else {
			for (const section of pieceSections) {
				const score = scoreSectionCandidate(
					piece,
					section.phase,
					section.lastPracticed ?? null,
					section.currentBpm ?? null,
					now,
				);
				candidates.push({
					piece,
					section,
					phase: section.phase,
					lastPracticed: section.lastPracticed ?? null,
					currentBpm: section.currentBpm ?? null,
					score,
				});
			}
		}
	}
	return candidates;
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

function eligibleMaintenancePieces(
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

export function pickRepertoireMaintenance(
	pieces: Piece[],
	allocatedMinutes: number,
	now: Date = new Date(),
	usedPieceIds?: Set<string>,
): PlannedBlock | null {
	const pool = eligibleMaintenancePieces(pieces, now, usedPieceIds);
	if (pool.length === 0) return null;
	const scored = pool.map((piece) => {
		const stateWeight = piece.state === "performance" ? 3 : 1;
		const days = daysSince(piece.lastPracticed ?? null, now);
		let bpmTerm = 0;
		if (piece.targetTempoBpm != null && piece.lastAchievedTempoBpm != null) {
			bpmTerm = Math.max(0, piece.targetTempoBpm - piece.lastAchievedTempoBpm);
		}
		return { piece, score: days * stateWeight + bpmTerm };
	});
	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return compareTitle(a.piece.title, b.piece.title);
	});
	const best = scored[0];
	return {
		kind: "repertoire-maintenance",
		allocatedMinutes,
		pieceId: best.piece.id ?? null,
		sectionId: null,
		title: best.piece.title,
		subtitle: best.piece.composer,
		score: best.score,
	};
}

interface TechniqueScored {
	tech: TechniqueItem;
	score: number;
}

function scoreTechnique(tech: TechniqueItem, now: Date): number {
	const stateScore = tech.state === "active" ? 10 : 2;
	const days = daysSince(tech.lastPracticedAt ?? null, now);
	const effort = tech.lastEffort ?? 1;
	const quality = tech.lastQuality ?? 5;
	const bonus = 2 * (effort - 1 + (5 - quality));
	return stateScore * days + bonus;
}

function sortTechniques(items: TechniqueItem[], now: Date): TechniqueScored[] {
	const scored = items.map((t) => ({ tech: t, score: scoreTechnique(t, now) }));
	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const aDate = a.tech.dateIntroduced.getTime();
		const bDate = b.tech.dateIntroduced.getTime();
		if (aDate !== bDate) return aDate - bDate;
		return compareTitle(a.tech.title, b.tech.title);
	});
	return scored;
}

function eligibleTechniquesInState(
	techniques: TechniqueItem[],
	state: "active" | "maintenance",
	now: Date,
	usedTechniqueIds?: Set<string>,
): TechniqueItem[] {
	return techniques.filter(
		(t) =>
			t.state === state &&
			!isPracticedToday(t.lastPracticedAt ?? null, now) &&
			!(usedTechniqueIds && t.id && usedTechniqueIds.has(t.id)),
	);
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

function redistributeRepertoireForAvailability(
	alloc: AllocationResult,
	hasLearning: boolean,
	hasStabilizing: boolean,
	hasMaintenance: boolean,
): { learning: number; stabilizing: number; maintenance: number } {
	let l = alloc.repertoireLearning;
	let s = alloc.repertoireStabilizing;
	let m = alloc.repertoireMaintenance;

	const adjust = (
		excess: number,
		targets: {
			hasIt: boolean;
			baseWeight: number;
			setter: (v: number) => void;
			current: number;
		}[],
	) => {
		const eligible = targets.filter((t) => t.hasIt);
		const totalWeight = eligible.reduce((acc, t) => acc + t.baseWeight, 0);
		if (eligible.length === 0 || totalWeight <= 0) return;
		let used = 0;
		for (let i = 0; i < eligible.length; i++) {
			const isLast = i === eligible.length - 1;
			const target = eligible[i];
			const portion = isLast
				? excess - used
				: Math.round((excess * target.baseWeight) / totalWeight);
			target.setter(target.current + portion);
			target.current += portion;
			used += portion;
		}
	};

	if (!hasLearning && l > 0) {
		const moveable = l;
		l = 0;
		adjust(moveable, [
			{
				hasIt: hasStabilizing,
				baseWeight: 30,
				current: s,
				setter: (v) => {
					s = v;
				},
			},
			{
				hasIt: hasMaintenance,
				baseWeight: 15,
				current: m,
				setter: (v) => {
					m = v;
				},
			},
		]);
	}
	if (!hasStabilizing && s > 0) {
		const moveable = s;
		s = 0;
		adjust(moveable, [
			{
				hasIt: hasLearning,
				baseWeight: 55,
				current: l,
				setter: (v) => {
					l = v;
				},
			},
			{
				hasIt: hasMaintenance,
				baseWeight: 15,
				current: m,
				setter: (v) => {
					m = v;
				},
			},
		]);
	}
	if (!hasMaintenance && m > 0) {
		const moveable = m;
		m = 0;
		adjust(moveable, [
			{
				hasIt: hasLearning,
				baseWeight: 55,
				current: l,
				setter: (v) => {
					l = v;
				},
			},
			{
				hasIt: hasStabilizing,
				baseWeight: 30,
				current: s,
				setter: (v) => {
					s = v;
				},
			},
		]);
	}
	return { learning: l, stabilizing: s, maintenance: m };
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
	const usedTechniqueIds = new Set<string>();
	const omitted: OmittedSlot[] = [];

	const warmupBlock: PlannedBlock | null =
		alloc.warmup > 0 ? pickWarmup(techniques, alloc.warmup, now) : null;
	if (warmupBlock?.techniqueId) usedTechniqueIds.add(warmupBlock.techniqueId);

	let techMinutes = alloc.technique;
	const techBlocks = pickTechnique(
		techMinutes,
		techniques,
		now,
		usedTechniqueIds,
	);
	for (const tb of techBlocks) {
		if (tb.techniqueId) usedTechniqueIds.add(tb.techniqueId);
	}

	const hasLearningEligible =
		eligibleSectionCandidates("learning", pieces, sections, now).length > 0;
	const hasStabilizingEligible =
		eligibleSectionCandidates("stabilizing", pieces, sections, now).length > 0;
	const hasMaintenanceEligible =
		eligibleMaintenancePieces(pieces, now).length > 0;

	const repSplit = redistributeRepertoireForAvailability(
		alloc,
		hasLearningEligible,
		hasStabilizingEligible,
		hasMaintenanceEligible,
	);

	if (techMinutes > 0 && techBlocks.length === 0) {
		omitted.push({
			kind: "technique",
			reason: omittedReason(hasAnyTechniqueInPool(techniques)),
			redistributedMinutes: techMinutes,
		});
		if (hasLearningEligible) {
			repSplit.learning += techMinutes;
		} else if (hasStabilizingEligible) {
			repSplit.stabilizing += techMinutes;
		} else if (hasMaintenanceEligible) {
			repSplit.maintenance += techMinutes;
		}
		techMinutes = 0;
	}

	if (alloc.repertoireLearning > 0 && !hasLearningEligible) {
		omitted.push({
			kind: "repertoire-learning",
			reason: omittedReason(hasPiecesInState(pieces, "learning")),
			redistributedMinutes: alloc.repertoireLearning,
		});
	}
	if (alloc.repertoireStabilizing > 0 && !hasStabilizingEligible) {
		omitted.push({
			kind: "repertoire-stabilizing",
			reason: omittedReason(hasPiecesInState(pieces, "stabilizing")),
			redistributedMinutes: alloc.repertoireStabilizing,
		});
	}
	if (alloc.repertoireMaintenance > 0 && !hasMaintenanceEligible) {
		const rawMaintenance =
			hasPiecesInState(pieces, "maintenance") ||
			hasPiecesInState(pieces, "performance");
		omitted.push({
			kind: "repertoire-maintenance",
			reason: omittedReason(rawMaintenance),
			redistributedMinutes: alloc.repertoireMaintenance,
		});
	}

	const usedSectionIds = new Set<string>();
	const usedPieceIds = new Set<string>();

	const learningBlock =
		repSplit.learning > 0
			? pickRepertoireSection(
					"learning",
					pieces,
					sections,
					repSplit.learning,
					now,
					usedSectionIds,
				)
			: null;
	if (learningBlock?.sectionId) usedSectionIds.add(learningBlock.sectionId);
	if (learningBlock?.pieceId) usedPieceIds.add(learningBlock.pieceId);

	const stabilizingBlock =
		repSplit.stabilizing > 0
			? pickRepertoireSection(
					"stabilizing",
					pieces,
					sections,
					repSplit.stabilizing,
					now,
					usedSectionIds,
				)
			: null;
	if (stabilizingBlock?.sectionId)
		usedSectionIds.add(stabilizingBlock.sectionId);
	if (stabilizingBlock?.pieceId) usedPieceIds.add(stabilizingBlock.pieceId);

	const maintenanceBlock =
		repSplit.maintenance > 0
			? pickRepertoireMaintenance(
					pieces,
					repSplit.maintenance,
					now,
					usedPieceIds,
				)
			: null;

	const sightBlock: PlannedBlock | null =
		alloc.sightReading > 0
			? {
					kind: "sight-reading",
					allocatedMinutes: alloc.sightReading,
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
		"repertoire-maintenance": maintenanceBlock ?? undefined,
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
