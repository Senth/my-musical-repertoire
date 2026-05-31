import type { Piece } from "@/models/piece";
import type { Section, SectionPhase } from "@/models/section";
import type { TechniqueItem } from "@/models/technique";
import { isPracticedToday } from "./day-boundary";

export const PHASE_SCORE: Record<SectionPhase, number> = {
	learning: 10,
	stabilizing: 3,
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

export interface SectionCandidate {
	piece: Piece;
	section: Section | null;
	phase: SectionPhase;
	lastPracticed: Date | null;
	currentBpm: number | null;
	score: number;
}

export function scoreSectionCandidate(
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

export function scoreMaintenancePiece(piece: Piece, now: Date): number {
	const stateWeight = piece.state === "performance" ? 3 : 1;
	const days = daysSince(piece.lastPracticed ?? null, now);
	let bpmTerm = 0;
	if (piece.targetTempoBpm != null && piece.lastAchievedTempoBpm != null) {
		bpmTerm = Math.max(0, piece.targetTempoBpm - piece.lastAchievedTempoBpm);
	}
	return days * stateWeight + bpmTerm;
}

export interface TechniqueScored {
	tech: TechniqueItem;
	score: number;
}

export function scoreTechnique(tech: TechniqueItem, now: Date): number {
	const stateScore = tech.state === "active" ? 10 : 2;
	const days = daysSince(tech.lastPracticedAt ?? null, now);
	const effort = tech.lastEffort ?? 1;
	const quality = tech.lastQuality ?? 5;
	const bonus = 2 * (effort - 1 + (5 - quality));
	return stateScore * days + bonus;
}

export function sortTechniques(
	items: TechniqueItem[],
	now: Date,
): TechniqueScored[] {
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

export function eligibleTechniquesInState(
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
