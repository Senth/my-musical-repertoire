import type { Section } from "@/models/section";

export interface BarRange {
	startBar: number;
	endBar: number;
}

export interface SectionBarSegment {
	sectionId: string;
	start: number;
	width: number;
	fill: number;
	flagged: boolean;
}

type BarSection = Pick<Section, "startBar" | "endBar"> & { id: string };

type Played =
	| { kind: "run-through" }
	| { kind: "section"; sectionId: string; ranges: readonly BarRange[] };

function hasRange(
	section: Pick<Section, "startBar" | "endBar">,
): section is BarRange {
	return (
		section.startBar != null &&
		section.endBar != null &&
		section.endBar >= section.startBar
	);
}

export function computeSectionBar({
	sections,
	played,
	flaggedSectionIds,
}: {
	sections: readonly BarSection[];
	played: Played;
	flaggedSectionIds: readonly string[];
}): { segments: SectionBarSegment[] } | null {
	if (sections.length === 0) return null;
	const equalWidths = sections.some((section) => !hasRange(section));
	const leaves = sections.filter(
		(section) =>
			!hasRange(section) ||
			!sections.some(
				(other) =>
					hasRange(other) &&
					section.startBar <= other.startBar &&
					section.endBar >= other.endBar &&
					(section.startBar < other.startBar || section.endBar > other.endBar),
			),
	);
	const lengths = leaves.map((section) =>
		equalWidths || !hasRange(section)
			? 1
			: section.endBar - section.startBar + 1,
	);
	const total = lengths.reduce((sum, length) => sum + length, 0);
	const ranges =
		played.kind === "section"
			? [...played.ranges].sort((a, b) => a.startBar - b.startBar)
			: [];
	const flagged = new Set(flaggedSectionIds);
	let start = 0;
	return {
		segments: leaves.map((section, index) => {
			const width = lengths[index] / total;
			let fill = 1;
			if (played.kind === "section") {
				fill = section.id === played.sectionId ? 1 : 0;
				if (ranges.length > 0 && hasRange(section)) {
					let covered = 0;
					let nextBar = section.startBar;
					for (const range of ranges) {
						const from = Math.max(nextBar, range.startBar);
						const to = Math.min(section.endBar, range.endBar);
						if (to < from) continue;
						covered += to - from + 1;
						nextBar = to + 1;
					}
					fill = covered / (section.endBar - section.startBar + 1);
				}
			}
			const segment = {
				sectionId: section.id,
				start,
				width,
				fill,
				flagged: played.kind === "run-through" && flagged.has(section.id),
			};
			start += width;
			return segment;
		}),
	};
}
