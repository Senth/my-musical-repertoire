import type { Piece } from "@/models/piece";
import type { Section, SectionPhase } from "@/models/section";

/**
 * The phase a newly created section starts in, so the form opens on the
 * sensible value instead of always `learning`:
 *
 * - learning piece: `learning` while nothing else is being learned, else
 *   `not_started` — new passages queue up instead of splitting attention;
 * - stabilizing piece: `learning`, since new material always starts there;
 * - maintenance, performance, on hold and shelved pieces: `stabilizing`, the
 *   phase of a section added to a piece that is no longer being learned.
 */
export function defaultSectionPhase(
	piece: Piece | null | undefined,
	sections: Section[],
): SectionPhase {
	if (!piece) return "learning";
	const active = sections.filter((s) => !s.archived && s.pieceId === piece.id);
	switch (piece.state) {
		case "learning":
			return active.some((s) => s.phase === "learning")
				? "not_started"
				: "learning";
		case "stabilizing":
			return "learning";
		default:
			return "stabilizing";
	}
}
