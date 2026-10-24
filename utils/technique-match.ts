import enUS from "@/i18n/locales/en-US.json";
import type { TechniqueItem } from "@/models/technique";
import type { TechniqueCatalogEntry } from "@/utils/technique-catalog";

export type TechniqueCatalogMatch = {
	kind: "exact" | "near" | "none";
	technique?: TechniqueItem;
};

export function normalizeTechniqueTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/#/g, "♯")
		.replace(/\b([a-g])b/g, "$1♭")
		.replace(/\s+/g, " ")
		.trim();
}

function withoutScale(title: string): string {
	return title
		.replace(/\bscale\b/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function isNear(title: string, entry: TechniqueCatalogEntry): boolean {
	const ordered = title
		.replace(/\bmaj\b/g, "major")
		.replace(/\bmin\b/g, "minor")
		.replace(/\bharm\b/g, "harmonic")
		.replace(/\bmel\b/g, "melodic")
		.replace(/\b(?:arp|arpeggios)\b/g, "arpeggio")
		.replace(/\b(?:dom\s*7|dominant\s+(?:seventh|7))\b/g, "dominant 7th")
		.replace(
			/^dominant 7th( arpeggio)?(?: in)? ([a-g][♯♭]?)$/,
			"$2 dominant 7th$1",
		);
	const parts = ordered.match(
		/^([a-g][♯♭]?)\s*(?:(harmonic|melodic) )?(major|minor|m|dominant 7th)(?: (scale|arpeggio))?$/,
	);
	if (!parts || parts[1] !== entry.tonic?.toLowerCase()) return false;
	const [, , variant, quality, type] = parts;
	const entryQuality = entry.quality.endsWith("Minor")
		? "minor"
		: entry.quality;
	return (
		(quality === "m"
			? "minor"
			: quality === "dominant 7th"
				? "dominant7"
				: quality) === entryQuality &&
		(!type || type === entry.type) &&
		(!variant || entry.quality === `${variant}Minor`)
	);
}

export function matchCatalog(
	techniques: readonly TechniqueItem[],
	entries: readonly TechniqueCatalogEntry[],
): TechniqueCatalogMatch[] {
	const normalized = techniques.map((technique) =>
		normalizeTechniqueTitle(technique.title),
	);
	const used = new Set<number>();
	const results: TechniqueCatalogMatch[] = entries.map((entry) => {
		const linked = techniques.findIndex(
			(technique) => technique.curriculumKey === entry.key,
		);
		if (linked !== -1 && !used.has(linked)) {
			used.add(linked);
			return { kind: "exact", technique: techniques[linked] };
		}
		return { kind: "none" };
	});
	entries.forEach((entry, index) => {
		if (results[index].kind === "exact") return;
		const titles = enUS.technique.catalog.title;
		const template =
			titles[entry.titleKey.split(".").at(-1) as keyof typeof titles];
		const title = normalizeTechniqueTitle(
			template.replace("{{tonic}}", entry.tonic ?? ""),
		);
		const exact = techniques.findIndex(
			(technique, candidate) =>
				!technique.curriculumKey &&
				!used.has(candidate) &&
				(entry.type === "scale"
					? withoutScale(normalized[candidate]) === withoutScale(title)
					: normalized[candidate] === title),
		);
		if (exact !== -1) {
			used.add(exact);
			results[index] = { kind: "exact", technique: techniques[exact] };
			return;
		}
		const near = techniques.findIndex(
			(technique, candidate) =>
				!technique.curriculumKey &&
				(!technique.type || technique.type === entry.type) &&
				isNear(normalized[candidate], entry),
		);
		if (near !== -1)
			results[index] = { kind: "near", technique: techniques[near] };
	});
	return results;
}
