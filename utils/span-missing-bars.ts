import type { Section } from "@/models/section";
import { hasSpanBars, isSpanQualifying } from "./span-detection";

export function sectionsMissingSpanBars(sections: Section[]): Section[] {
	const ordered = sections
		.filter((section) => !section.archived)
		.sort((a, b) => a.order - b.order);
	const missing = new Set<Section>();

	for (let index = 1; index < ordered.length; index++) {
		const previous = ordered[index - 1];
		const current = ordered[index];
		if (!isSpanQualifying(previous) || !isSpanQualifying(current)) continue;
		if (!hasSpanBars(previous)) missing.add(previous);
		if (!hasSpanBars(current)) missing.add(current);
	}

	return ordered.filter((section) => missing.has(section));
}
