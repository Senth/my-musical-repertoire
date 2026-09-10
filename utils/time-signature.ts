export type NoteValue = 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128;

export interface TimeSignature {
	beats: number;
	noteValue: NoteValue;
}

export const NOTE_VALUES: NoteValue[] = [1, 2, 4, 8, 16, 32, 64, 128];

export const PRESETS: TimeSignature[] = [
	{ beats: 2, noteValue: 4 },
	{ beats: 3, noteValue: 4 },
	{ beats: 4, noteValue: 4 },
	{ beats: 6, noteValue: 8 },
];

export function formatTimeSignature(sig: TimeSignature): string {
	return `${sig.beats}/${sig.noteValue}`;
}

/**
 * A section's override beats its piece's own signature; most pieces are one
 * signature throughout, so the piece carries the default and only a differing
 * passage stores an override — the same shape `targetBpmOverride` uses.
 */
export function resolveTimeSignature(
	section: { timeSignatureOverride?: TimeSignature | null } | null | undefined,
	owner: { timeSignature?: TimeSignature | null } | null | undefined,
): TimeSignature | null {
	return section?.timeSignatureOverride ?? owner?.timeSignature ?? null;
}

export interface TimeSignatureWritePlan {
	target: "piece" | "section" | "technique" | "none";
	/** New value for `piece.timeSignature`, present when `target` is "piece". */
	piece?: TimeSignature;
	/**
	 * New value for `section.timeSignatureOverride` (null clears it), present
	 * when the section's override is written or cleared alongside.
	 */
	sectionOverride?: TimeSignature | null;
}

function sameTimeSignature(a: TimeSignature, b: TimeSignature): boolean {
	return a.beats === b.beats && a.noteValue === b.noteValue;
}

/**
 * Where a newly chosen signature lands. With no piece in scope the entity is a
 * technique — there is no override axis, so the caller writes the technique
 * directly. With a piece but no section the write is the whole-piece edit.
 */
export function planTimeSignatureWrite(
	next: TimeSignature,
	piece: { timeSignature?: TimeSignature | null } | null,
	section: { timeSignatureOverride?: TimeSignature | null } | null,
): TimeSignatureWritePlan {
	if (!piece) return { target: "technique" };
	const pieceSig = piece.timeSignature;
	if (!pieceSig) {
		return section
			? { target: "piece", piece: next, sectionOverride: null }
			: { target: "piece", piece: next };
	}
	if (sameTimeSignature(next, pieceSig)) {
		return section
			? { target: "section", sectionOverride: null }
			: { target: "none" };
	}
	return section
		? { target: "section", sectionOverride: next }
		: { target: "piece", piece: next };
}
