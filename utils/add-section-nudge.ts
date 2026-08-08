import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";

/**
 * Whether a learning piece has run out of learning-phase material and should be
 * nudged to add its next passage.
 *
 * Returns the section to name in the copy — the furthest one along, which is the
 * one that just cleared learning — or null when the piece does not qualify.
 *
 * Fires at *stabilizing*, not maintenance: that is the window where there is
 * attention to spare for new material, and where the two sections still
 * reinforce each other as an anchor pair. See
 * `docs/specs/section-progression-nudges.md` §5.3.
 */
export function addSectionNudgeSection(
	piece: Piece | null | undefined,
	sections: Section[],
): Section | null {
	if (!piece || piece.state !== "learning") return null;
	if (piece.allSectionsAdded) return null;

	const active = sections.filter(
		(s) => !s.archived && s.pieceId === piece.id && s.id,
	);
	if (active.length === 0) return null;
	if (active.some((s) => s.phase === "learning")) return null;

	return active.reduce((furthest, s) =>
		s.order > furthest.order ? s : furthest,
	);
}
