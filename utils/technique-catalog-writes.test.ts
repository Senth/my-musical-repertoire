import type { TechniqueCatalogEntry } from "@/utils/technique-catalog";
import {
	addAllDocs,
	catalogLinkUpdates,
	newCatalogTechnique,
} from "@/utils/technique-catalog-writes";

const entry = (
	key: string,
	type: TechniqueCatalogEntry["type"],
): TechniqueCatalogEntry => ({
	key,
	type,
	tonic: "C",
	quality: "major",
	titleKey: "technique.catalog.title.majorScale",
	titleParams: { tonic: "C" },
});

describe("technique catalogue writes", () => {
	const now = new Date("2026-10-24T12:00:00.000Z");

	it.each([
		["start", "active"],
		["later", "not_started"],
	] as const)("creates a %s technique in the %s state", (mode, state) => {
		expect(
			newCatalogTechnique(
				entry("scale.major.C", "scale"),
				"C major scale",
				mode,
				now,
			),
		).toEqual({
			title: "C major scale",
			curriculumKey: "scale.major.C",
			state,
			type: "scale",
			handsMode: "separate",
			activeDrills: [],
			targetTempoBpm: null,
			dateIntroduced: now,
		});
	});

	it("creates not-started documents with strictly increasing curriculum timestamps", () => {
		const entries = [
			entry("scale.major.C", "scale"),
			entry("arpeggio.major.C", "arpeggio"),
			entry("scale.harmonicMinor.A", "scale"),
		];
		const docs = addAllDocs(
			entries,
			["C major scale", "C major arpeggio", "A harmonic minor scale"],
			now,
		);

		expect(docs.map((document) => document.state)).toEqual([
			"not_started",
			"not_started",
			"not_started",
		]);
		expect(docs.map((document) => document.dateIntroduced)).toEqual([
			now,
			new Date(now.getTime() + 1),
			new Date(now.getTime() + 2),
		]);
		expect(docs.map((document) => document.curriculumKey)).toEqual(
			entries.map((item) => item.key),
		);
	});

	it("links without touching other fields and renames only selected fields", () => {
		const item = entry("scale.major.C", "scale");
		expect(
			catalogLinkUpdates(item, "C major scale", false, "arpeggio"),
		).toEqual({
			curriculumKey: item.key,
		});
		expect(catalogLinkUpdates(item, "C major scale", true, "arpeggio")).toEqual(
			{
				curriculumKey: item.key,
				title: "C major scale",
			},
		);
		expect(catalogLinkUpdates(item, "C major scale", true, null)).toEqual({
			curriculumKey: item.key,
			title: "C major scale",
			type: "scale",
		});
	});
});
