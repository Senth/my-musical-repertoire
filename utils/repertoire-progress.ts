import type { Piece } from "@/models/piece";
import { type ByMode, HANDS_MODES, type HandsMode } from "@/models/practice";
import type { Section } from "@/models/section";
import type { TechniqueItem } from "@/models/technique";

export function progressFill(bpm: number, target: number): number {
	if (target <= 20) return bpm >= target ? 1 : 0;
	return Math.max(0, Math.min(1, (bpm - 20) / (target - 20)));
}

export type ProgressRow = (
	| { kind: "section"; piece: Piece; section: Section }
	| { kind: "technique"; technique: TechniqueItem }
) & {
	target: number;
	hands: { hands: HandsMode; bpm: number; fill: number }[];
	fill: number;
};

export function buildProgressRows({
	pieces,
	sectionsByPiece,
	techniques,
}: {
	pieces: readonly Piece[];
	sectionsByPiece: Record<string, Section[]>;
	techniques: readonly TechniqueItem[];
}): { rows: ProgressRow[]; atTarget: ProgressRow[] } {
	const candidates: ProgressRow[] = [];
	function add(
		source:
			| { kind: "section"; piece: Piece; section: Section }
			| { kind: "technique"; technique: TechniqueItem },
		target: number | null | undefined,
		byMode?: ByMode,
	) {
		if (target == null || !Number.isFinite(target)) return;
		const hands = HANDS_MODES.flatMap((hands) => {
			const bpm = byMode?.[hands]?.bpm;
			return typeof bpm === "number" && Number.isFinite(bpm)
				? [{ hands, bpm, fill: progressFill(bpm, target) }]
				: [];
		});
		if (hands.length)
			candidates.push({
				...source,
				target,
				hands,
				fill: Math.min(...hands.map(({ fill }) => fill)),
			});
	}
	for (const piece of pieces) {
		if (piece.state === "on_hold" || piece.state === "shelved") continue;
		for (const section of sectionsByPiece[piece.id ?? ""] ?? []) {
			if (section.archived || section.state === "not_started") continue;
			add(
				{ kind: "section", piece, section },
				section.targetBpmOverride ?? piece.targetTempoBpm,
				section.byMode,
			);
		}
	}
	for (const technique of techniques) {
		if (technique.state === "not_started" || technique.state === "retired")
			continue;
		add(
			{ kind: "technique", technique },
			technique.targetTempoBpm,
			technique.byMode,
		);
	}
	candidates.sort((a, b) => a.fill - b.fill);
	return {
		rows: candidates.filter(
			(row) => !row.hands.every(({ bpm }) => bpm >= row.target),
		),
		atTarget: candidates.filter((row) =>
			row.hands.every(({ bpm }) => bpm >= row.target),
		),
	};
}
