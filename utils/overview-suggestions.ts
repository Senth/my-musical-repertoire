import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";
import type { TechniqueItem } from "@/models/technique";
import { isPracticedToday } from "./day-boundary";
import {
	buildSectionCandidates,
	daysSince,
	PHASE_SCORE,
	type SectionCandidate,
	scoreMaintenancePiece,
	scoreTechnique,
} from "./planner-scoring";

export interface SuggestedPiece {
	piece: Piece;
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

function reasonForCandidate(
	candidate: SectionCandidate,
	now: Date,
): { reasonKey: string; reasonParams: Record<string, unknown> } {
	if (!candidate.lastPracticed) {
		return {
			reasonKey: "screen.overview.pieceReason.neverPracticed",
			reasonParams: {},
		};
	}
	const days = daysSince(candidate.lastPracticed, now);

	if (candidate.phase === "maintenance") {
		const effort = candidate.lastEffort ?? 1;
		const quality = candidate.lastQuality ?? 5;
		const bonus = effort - 1 + (5 - quality);
		if (bonus > 1 * days) {
			return {
				reasonKey: "screen.overview.pieceReason.lastResultPoor",
				reasonParams: {},
			};
		}
		return {
			reasonKey: "screen.overview.pieceReason.daysSince",
			reasonParams: { days },
		};
	}

	const phaseScore = PHASE_SCORE[candidate.phase];
	let bpmTerm = 0;
	if (candidate.piece.targetTempoBpm != null && candidate.currentBpm != null) {
		bpmTerm = Math.max(
			0,
			candidate.piece.targetTempoBpm - candidate.currentBpm,
		);
	}
	if (bpmTerm > phaseScore * days) {
		return {
			reasonKey: "screen.overview.pieceReason.bpmGap",
			reasonParams: { gap: bpmTerm },
		};
	}
	return {
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

function sectionBasedSuggestions(
	pieces: Piece[],
	sections: Section[],
	now: Date,
): SuggestedPiece[] {
	if (pieces.length === 0) return [];
	const candidates = buildSectionCandidates(pieces, sections, now);

	const bestByPiece = new Map<string, SectionCandidate>();
	for (const c of candidates) {
		const id = c.piece.id ?? "";
		const existing = bestByPiece.get(id);
		if (!existing || c.score > existing.score) {
			bestByPiece.set(id, c);
		}
	}

	return Array.from(bestByPiece.values()).map((c) => ({
		piece: c.piece,
		score: c.score,
		...reasonForCandidate(c, now),
	}));
}

function maintenanceBasedSuggestions(
	pieces: Piece[],
	now: Date,
): SuggestedPiece[] {
	return pieces.map((piece) => ({
		piece,
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

	if (
		activePieces.length > 0 &&
		activePieces.every((p) => isPracticedToday(p.lastPracticed ?? null, now))
	) {
		return {
			suggestions: [],
			emptyStateKey: "screen.overview.emptyState.allPracticedToday",
		};
	}

	const allMaintenance =
		activePieces.length > 0 &&
		activePieces.every(
			(p) => p.state === "performance" || p.state === "maintenance",
		);

	const notPracticedToday = (s: SuggestedPiece) =>
		!isPracticedToday(s.piece.lastPracticed ?? null, now);

	const learnSuggestions = sectionBasedSuggestions(
		activePieces.filter((p) => p.state === "learning"),
		sections,
		now,
	)
		.filter(notPracticedToday)
		.sort((a, b) => b.score - a.score)
		.slice(0, 1);

	const stabSuggestions = sectionBasedSuggestions(
		activePieces.filter((p) => p.state === "stabilizing"),
		sections,
		now,
	)
		.filter(notPracticedToday)
		.sort((a, b) => b.score - a.score)
		.slice(0, 1);

	const perfSuggestions = maintenanceBasedSuggestions(
		activePieces.filter((p) => p.state === "performance"),
		now,
	)
		.filter(notPracticedToday)
		.sort((a, b) => b.score - a.score)
		.slice(0, 2);

	const maintSuggestions = maintenanceBasedSuggestions(
		activePieces.filter((p) => p.state === "maintenance"),
		now,
	)
		.filter(notPracticedToday)
		.sort((a, b) => b.score - a.score)
		.slice(0, 2);

	const suggestions = [
		...learnSuggestions,
		...stabSuggestions,
		...perfSuggestions,
		...maintSuggestions,
	];

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
