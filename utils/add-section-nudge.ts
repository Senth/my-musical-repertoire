import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";

export type SectionNudge =
	| { kind: "add"; section: Section }
	| { kind: "transition"; section: Section };

/**
 * Whether a learning piece is ready for new material, and which suggestion to
 * make. With fewer than two active learning sections, a not-started section
 * is suggested first; otherwise the nudge asks to add the next passage,
 * named by the furthest section along. Two learning sections silence the nudge.
 *
 * Fires at *stabilizing*, not maintenance: that is the window where there is
 * attention to spare for new material, and where the two sections still
 * reinforce each other as an anchor pair.
 */
export function sectionNudge(
	piece: Piece | null | undefined,
	sections: Section[],
): SectionNudge | null {
	if (piece?.state !== "learning") return null;
	if (piece.allSectionsAdded) return null;

	const active = sections.filter(
		(s) => !s.archived && s.pieceId === piece.id && s.id,
	);
	if (active.length === 0) return null;
	if (active.filter((s) => s.state === "learning").length >= 2) return null;

	const notStarted = active.filter((s) => s.state === "not_started");
	if (notStarted.length > 0) {
		return {
			kind: "transition",
			section: notStarted.reduce((next, s) =>
				s.order < next.order ? s : next,
			),
		};
	}

	return {
		kind: "add",
		section: active.reduce((furthest, s) =>
			s.order > furthest.order ? s : furthest,
		),
	};
}
