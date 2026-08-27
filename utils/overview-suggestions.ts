import type { Piece } from "@/models/piece";
import type { ModeKey } from "@/models/practice";
import type { Section } from "@/models/section";
import type { TechniqueItem } from "@/models/technique";
import { isPracticedToday } from "./day-boundary";
import {
	BPM_GAP_WEIGHT,
	bpmGap,
	buildSectionCandidates,
	daysSince,
	NEEDS_WORK_WEIGHT,
	needsWorkTerm,
	PHASE_SCORE,
	type SectionCandidate,
	scoreMaintenancePiece,
	scoreTechnique,
} from "./planner-scoring";
import { parseModeKey, targetForMode } from "./practice-modes";

export interface SuggestedPiece {
	piece: Piece;
	/** The passage the card names; `null` for whole-piece suggestions. */
	section: Section | null;
	/** The mode that won the score, so the card can open that hand. */
	modeKey: ModeKey | null;
	score: number;
	reasonKey: string;
	reasonParams: Record<string, unknown>;
}

export interface SuggestedTechnique {
	tech: TechniqueItem;
	score: number;
	reasonKey: string;
	reasonParams: Record<string, unknown>;
}

export interface PieceSuggestions {
	suggestions: SuggestedPiece[];
	emptyStateKey: string | null;
}

export interface TechniqueSuggestions {
	suggestions: SuggestedTechnique[];
	emptyStateKey: string | null;
}

/** Caps per category — not fixed counts; an empty category is omitted. */
const PIECE_CAP = 2;

/**
 * Mirrors `scoreSectionModes`: the reason reads the very stats the winning mode
 * was scored from, so a section drilled left hand this morning can come back for
 * the right hand this evening and still explain itself honestly.
 */
function reasonForCandidate(
	candidate: SectionCandidate,
	now: Date,
): {
	modeKey: ModeKey | null;
	reasonKey: string;
	reasonParams: Record<string, unknown>;
} {
	const modeKey = candidate.modeKey;
	const stats = modeKey ? candidate.section?.byMode?.[modeKey] : null;
	const effectiveTarget =
		candidate.section?.targetBpmOverride ?? candidate.piece.targetTempoBpm;

	const lastPracticed = stats
		? (stats.lastPracticed ?? null)
		: candidate.lastPracticed;
	const currentBpm = stats ? (stats.bpm ?? null) : candidate.currentBpm;
	const quality = stats ? (stats.quality ?? null) : candidate.lastQuality;
	const effort = stats ? (stats.effort ?? null) : candidate.lastEffort;
	const target =
		stats && modeKey
			? targetForMode(parseModeKey(modeKey).hands, effectiveTarget ?? null)
			: effectiveTarget;

	if (!lastPracticed) {
		return {
			modeKey,
			reasonKey: "screen.overview.pieceReason.neverPracticed",
			reasonParams: {},
		};
	}
	const days = daysSince(lastPracticed, now);

	// Mirrors the three terms of `scoreSectionCandidate`: whichever contributed
	// most is the honest answer to "why this passage".
	const phase = candidate.phase;
	const gap = bpmGap(target, currentBpm);
	const daysTerm = PHASE_SCORE[phase] * days;
	const bpmTerm = BPM_GAP_WEIGHT[phase] * gap;
	const workTerm = NEEDS_WORK_WEIGHT[phase] * needsWorkTerm(quality, effort);

	if (workTerm > daysTerm && workTerm >= bpmTerm) {
		return {
			modeKey,
			reasonKey: "screen.overview.pieceReason.lastResultPoor",
			reasonParams: {},
		};
	}
	if (bpmTerm > daysTerm) {
		return {
			modeKey,
			reasonKey: "screen.overview.pieceReason.bpmGap",
			reasonParams: { gap },
		};
	}
	return {
		modeKey,
		reasonKey: "screen.overview.pieceReason.daysSince",
		reasonParams: { days },
	};
}

function reasonForMaintenancePiece(
	piece: Piece,
	now: Date,
): { reasonKey: string; reasonParams: Record<string, unknown> } {
	if (!piece.lastPracticed) {
		return {
			reasonKey: "screen.overview.pieceReason.neverPracticed",
			reasonParams: {},
		};
	}
	const stateWeight = piece.state === "performance" ? 3 : 1;
	const days = daysSince(piece.lastPracticed, now);
	const techMistakes = piece.lastTechnicalMistakes ?? 0;
	const memMistakes = piece.lastMemoryMistakes ?? 0;
	const mistakesTerm = 2 * (techMistakes + memMistakes);
	if (mistakesTerm > stateWeight * days) {
		return {
			reasonKey: "screen.overview.pieceReason.mistakes",
			reasonParams: {},
		};
	}
	return {
		reasonKey: "screen.overview.pieceReason.daysSince",
		reasonParams: { days },
	};
}

/** Every candidate, not one per piece — the overview is a menu of passages. */
function sectionBasedSuggestions(
	pieces: Piece[],
	sections: Section[],
	now: Date,
): SuggestedPiece[] {
	if (pieces.length === 0) return [];
	return buildSectionCandidates(pieces, sections, now)
		.filter((c) => !c.practicedToday)
		.map((c) => ({
			piece: c.piece,
			section: c.section,
			score: c.score,
			...reasonForCandidate(c, now),
		}));
}

/**
 * Breadth before depth: pass one takes each piece's best candidate in piece
 * order, pass two spends what is left on second passages of pieces already
 * shown. Pure score order would hand a finely sectioned piece every slot for
 * days, because each of its untouched sections accrues neglect on its own.
 * The session coach anchors on the piece instead, and disagrees on purpose.
 */
function breadthFirst(
	suggestions: SuggestedPiece[],
	cap: number,
): SuggestedPiece[] {
	const byPiece = new Map<string, SuggestedPiece[]>();
	for (const s of suggestions) {
		const id = s.piece.id ?? "";
		byPiece.set(id, [...(byPiece.get(id) ?? []), s]);
	}
	const queues = Array.from(byPiece.values())
		.map((q) => q.sort((a, b) => b.score - a.score))
		.sort((a, b) => b[0].score - a[0].score);

	const out: SuggestedPiece[] = [];
	for (let round = 0; out.length < cap; round++) {
		const before = out.length;
		for (const queue of queues) {
			if (out.length >= cap) break;
			if (queue[round]) out.push(queue[round]);
		}
		if (out.length === before) break;
	}
	return out;
}

function maintenanceBasedSuggestions(
	pieces: Piece[],
	now: Date,
): SuggestedPiece[] {
	return pieces.map((piece) => ({
		piece,
		section: null,
		modeKey: null,
		score: scoreMaintenancePiece(piece, now),
		...reasonForMaintenancePiece(piece, now),
	}));
}

export function suggestPieces(
	pieces: Piece[],
	sections: Section[],
	now: Date,
): PieceSuggestions {
	const activePieces = pieces.filter(
		(p) => p.state !== "on_hold" && p.state !== "shelved",
	);

	if (pieces.length === 0) {
		return {
			suggestions: [],
			emptyStateKey: "screen.overview.emptyState.noActivePieces",
		};
	}

	const allMaintenance =
		activePieces.length > 0 &&
		activePieces.every(
			(p) => p.state === "performance" || p.state === "maintenance",
		);

	const notPracticedToday = (s: SuggestedPiece) =>
		!isPracticedToday(s.piece.lastPracticed ?? null, now);

	const inState = (state: Piece["state"]) =>
		activePieces.filter((p) => p.state === state);

	const bySection = (state: Piece["state"]) =>
		breadthFirst(
			sectionBasedSuggestions(inState(state), sections, now),
			PIECE_CAP,
		);

	const byPiece = (state: Piece["state"]) =>
		maintenanceBasedSuggestions(inState(state), now)
			.filter(notPracticedToday)
			.sort((a, b) => b.score - a.score)
			.slice(0, PIECE_CAP);

	const suggestions = [
		...bySection("learning"),
		...bySection("stabilizing"),
		...byPiece("performance"),
		...byPiece("maintenance"),
	];

	// Nothing left to suggest, yet pieces are alive: they were all practised.
	if (suggestions.length === 0 && activePieces.length > 0) {
		return {
			suggestions: [],
			emptyStateKey: "screen.overview.emptyState.allPracticedToday",
		};
	}

	return {
		suggestions,
		emptyStateKey: allMaintenance
			? "screen.overview.emptyState.allMaintenance"
			: null,
	};
}

function reasonForTechnique(
	tech: TechniqueItem,
	now: Date,
): { reasonKey: string; reasonParams: Record<string, unknown> } {
	if (!tech.lastPracticedAt) {
		return {
			reasonKey: "screen.overview.techniqueReason.new",
			reasonParams: {},
		};
	}
	const stateScore = tech.state === "active" ? 10 : 2;
	const days = daysSince(tech.lastPracticedAt, now);
	const effort = tech.lastEffort ?? 1;
	const quality = tech.lastQuality ?? 5;
	const bonus = 2 * (effort - 1 + (5 - quality));
	if (bonus > stateScore * days) {
		return {
			reasonKey: "screen.overview.techniqueReason.effortQuality",
			reasonParams: {},
		};
	}
	return {
		reasonKey: "screen.overview.techniqueReason.daysSince",
		reasonParams: { days },
	};
}

export function suggestTechniques(
	techniques: TechniqueItem[],
	now: Date,
): TechniqueSuggestions {
	const pool = techniques.filter(
		(t) => t.state === "active" || t.state === "maintenance",
	);

	if (pool.length === 0) {
		return { suggestions: [], emptyStateKey: null };
	}

	const eligible = pool.filter(
		(t) => !isPracticedToday(t.lastPracticedAt ?? null, now),
	);

	if (eligible.length === 0) {
		return {
			suggestions: [],
			emptyStateKey: "screen.overview.emptyState.allTechniquesPracticedToday",
		};
	}

	const toSuggested = (t: TechniqueItem): SuggestedTechnique => ({
		tech: t,
		score: scoreTechnique(t, now),
		...reasonForTechnique(t, now),
	});

	const activeSuggestions = eligible
		.filter((t) => t.state === "active")
		.map(toSuggested)
		.sort((a, b) => b.score - a.score)
		.slice(0, 2);

	const maintSuggestions = eligible
		.filter((t) => t.state === "maintenance")
		.map(toSuggested)
		.sort((a, b) => b.score - a.score)
		.slice(0, 2);

	return {
		suggestions: [...activeSuggestions, ...maintSuggestions],
		emptyStateKey: null,
	};
}
