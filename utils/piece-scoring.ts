import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";
import {
	type SectionCandidate,
	scoreMaintenancePiece,
	scoreSectionModes,
} from "./planner-scoring";

/**
 * The single place a piece is boiled down to one number.
 *
 * Both the overview ("practice today") and the pieces list order by this, so it
 * lives here rather than inline in either surface — a piece that tops the
 * overview must not sit halfway down a score-sorted list.
 */

/** Non-archived sections grouped by their piece id. */
export function groupSectionsByPiece(
	sections: Section[],
): Map<string, Section[]> {
	const byPiece = new Map<string, Section[]>();
	for (const section of sections) {
		if (section.archived) continue;
		const arr = byPiece.get(section.pieceId) ?? [];
		arr.push(section);
		byPiece.set(section.pieceId, arr);
	}
	return byPiece;
}

/**
 * Highest-scoring candidate per piece — the section that needs work most is
 * what makes the whole piece worth practising.
 */
export function bestCandidateByPiece(
	candidates: SectionCandidate[],
): Map<string, SectionCandidate> {
	const best = new Map<string, SectionCandidate>();
	for (const candidate of candidates) {
		const id = candidate.piece.id ?? "";
		const existing = best.get(id);
		if (!existing || candidate.score > existing.score) {
			best.set(id, candidate);
		}
	}
	return best;
}

/**
 * Sections present -> the best section score, matching what
 * `buildSectionCandidates` produces for the same piece.
 * No sections -> the whole-piece maintenance score, since there is nothing
 * finer-grained to plan against.
 */
export function scorePiece(
	piece: Piece,
	sectionsForPiece: Section[],
	now: Date,
): number {
	const active = sectionsForPiece.filter((s) => !s.archived);
	if (active.length === 0) return scoreMaintenancePiece(piece, now);

	let best = Number.NEGATIVE_INFINITY;
	for (const section of active) {
		const effectiveTarget =
			section.targetBpmOverride ?? piece.targetTempoBpm ?? null;
		const { score } = scoreSectionModes(
			piece,
			section.phase,
			section.byMode,
			effectiveTarget,
			now,
			{
				lastPracticed: section.lastPracticed ?? null,
				lastQuality: section.lastQuality ?? null,
				lastEffort: section.lastEffort ?? null,
			},
		);
		if (score > best) best = score;
	}
	return best;
}

/** `scorePiece` over a whole library, keyed by piece id. */
export function scorePieces(
	pieces: Piece[],
	sections: Section[],
	now: Date,
): Record<string, number> {
	const byPiece = groupSectionsByPiece(sections);
	const scores: Record<string, number> = {};
	for (const piece of pieces) {
		if (!piece.id) continue;
		scores[piece.id] = scorePiece(piece, byPiece.get(piece.id) ?? [], now);
	}
	return scores;
}
