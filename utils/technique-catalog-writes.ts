import type { TechniqueHandsMode } from "@/models/practice";
import type { TechniqueItem, TechniqueType } from "@/models/technique";
import type { TechniqueCatalogEntry } from "@/utils/technique-catalog";

export type TechniqueCatalogMode = "start" | "later";

export type TechniqueCatalogDocument = Pick<
	TechniqueItem,
	| "title"
	| "curriculumKey"
	| "state"
	| "type"
	| "targetTempoBpm"
	| "dateIntroduced"
	| "handsMode"
	| "activeDrills"
>;

export function newCatalogTechnique(
	entry: TechniqueCatalogEntry,
	title: string,
	mode: TechniqueCatalogMode,
	now: Date,
): TechniqueCatalogDocument {
	return {
		title,
		curriculumKey: entry.key,
		state: mode === "start" ? "active" : "not_started",
		type: entry.type,
		targetTempoBpm: null,
		handsMode: "separate" satisfies TechniqueHandsMode,
		activeDrills: [],
		dateIntroduced: now,
	};
}

export function addAllDocs(
	entries: readonly TechniqueCatalogEntry[],
	titles: readonly string[],
	now: Date,
): TechniqueCatalogDocument[] {
	return entries.map((entry, index) =>
		newCatalogTechnique(
			entry,
			titles[index],
			"later",
			new Date(now.getTime() + index),
		),
	);
}

export function catalogLinkUpdates(
	entry: TechniqueCatalogEntry,
	title: string,
	rename: boolean,
	currentType: TechniqueType | null | undefined,
): Partial<Pick<TechniqueItem, "curriculumKey" | "title" | "type">> {
	return {
		curriculumKey: entry.key,
		...(rename ? { title, ...(!currentType ? { type: entry.type } : {}) } : {}),
	};
}
