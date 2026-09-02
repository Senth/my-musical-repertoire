import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";

export type SectionNudge =
	| { kind: "add"; section: Section }
	| { kind: "transition"; section: Section };

/**
 * Whether a learning piece is ready for new material, and which suggestion to
 * make. When the piece still has not-started sections, the nudge asks to move
 * the next one into learning rather than adding more passages. Only when every
 * active section has left both phases does it ask to add the next passage —
 * named by the furthest one along, the one that just cleared learning.
 *
 * Fires at *stabilizing*, not maintenance: that is the window where there is
 * attention to spare for new material, and where the two sections still
 * reinforce each other as an anchor pair. See
 * `docs/specs/section-phases.md` §6.3.
 */
export function sectionNudge(
	piece: Piece | null | undefined,
	sections: Section[],
): SectionNudge | null {
	if (!piece || piece.state !== "learning") return null;
	if (piece.allSectionsAdded) return null;

	const active = sections.filter(
		(s) => !s.archived && s.pieceId === piece.id && s.id,
	);
	if (active.length === 0) return null;

	const notStarted = active.filter((s) => s.phase === "not_started");
	if (notStarted.length > 0) {
		return {
			kind: "transition",
			section: notStarted.reduce((next, s) =>
				s.order < next.order ? s : next,
			),
		};
	}

	if (active.some((s) => s.phase === "learning")) return null;

	return {
		kind: "add",
		section: active.reduce((furthest, s) =>
			s.order > furthest.order ? s : furthest,
		),
	};
}
