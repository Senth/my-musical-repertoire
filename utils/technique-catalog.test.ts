import i18next from "i18next";
import enUS from "@/i18n/locales/en-US.json";
import {
	byKey,
	byType,
	catalogEntries,
	catalogTitle,
} from "@/utils/technique-catalog";

const i18n = i18next.createInstance();
void i18n.init({
	lng: "en-US",
	resources: { "en-US": { translation: enUS } },
	interpolation: { escapeValue: false },
	initAsync: false,
});

describe("technique catalogue", () => {
	const entries = catalogEntries();

	it("has 73 unique keys in curriculum order, with chromatic at position 19", () => {
		const keys = [
			["C", "A"],
			["G", "E"],
			["F", "D"],
			["D", "B"],
			["B♭", "G"],
			["A", "F♯"],
			["E♭", "C"],
			["E", "C♯"],
			["A♭", "F"],
			["B", "G♯"],
			["D♭", "B♭"],
			["F♯", "E♭"],
		];
		const expected = keys.flatMap(([major, minor]) => [
			`scale.major.${major}`,
			`arpeggio.major.${major}`,
			`arpeggio.dominant7.${major}`,
			`scale.harmonicMinor.${minor}`,
			`scale.melodicMinor.${minor}`,
			`arpeggio.minor.${minor}`,
		]);
		expected.splice(18, 0, "scale.chromatic");

		expect(entries).toHaveLength(73);
		expect(new Set(entries.map((entry) => entry.key)).size).toBe(73);
		expect(entries.map((entry) => entry.key)).toEqual(expected);
		expect(entries[18].key).toBe("scale.chromatic");
	});

	it("groups by key and type without changing curriculum order", () => {
		const keys = byKey();
		const types = byType();

		expect(keys).toHaveLength(13);
		expect(keys.slice(0, 12).map((group) => group.key)).toEqual([
			"C",
			"G",
			"F",
			"D",
			"B♭",
			"A",
			"E♭",
			"E",
			"A♭",
			"B",
			"D♭",
			"F♯",
		]);
		expect(keys.slice(0, 12).every((group) => group.entries.length === 6)).toBe(
			true,
		);
		expect(keys[12]).toMatchObject({
			key: "not-tied-to-a-key",
			titleKey: "technique.catalog.group.notTiedToKey",
			entries: [entries[18]],
		});
		expect(types.map((group) => group.key)).toEqual([
			"scale.major",
			"arpeggio.major",
			"arpeggio.dominant7",
			"scale.harmonicMinor",
			"scale.melodicMinor",
			"arpeggio.minor",
			"scale.chromatic",
		]);
		expect(types.map((group) => group.entries.length)).toEqual([
			12, 12, 12, 12, 12, 12, 1,
		]);
		expect(types.map((group) => group.titleKey)).toEqual([
			"technique.catalog.group.majorScales",
			"technique.catalog.group.majorArpeggios",
			"technique.catalog.group.dominant7Arpeggios",
			"technique.catalog.group.harmonicMinorScales",
			"technique.catalog.group.melodicMinorScales",
			"technique.catalog.group.minorArpeggios",
			"technique.catalog.group.chromaticScale",
		]);
		expect(
			types.map((group) =>
				i18n.t(group.titleKey as Parameters<typeof i18n.t>[0]),
			),
		).toEqual([
			"Major scales",
			"Major arpeggios",
			"Dominant 7th arpeggios",
			"Harmonic minor scales",
			"Melodic minor scales",
			"Minor arpeggios",
			"Chromatic scale",
		]);
		expect(
			types.map((group) => group.entries.map((entry) => entry.key)),
		).toEqual(
			[
				["scale", "major"],
				["arpeggio", "major"],
				["arpeggio", "dominant7"],
				["scale", "harmonicMinor"],
				["scale", "melodicMinor"],
				["arpeggio", "minor"],
				["scale", "chromatic"],
			].map(([type, quality]) =>
				entries
					.filter((entry) => entry.type === type && entry.quality === quality)
					.map((entry) => entry.key),
			),
		);
	});

	it("renders catalogue titles with note-name interpolation parameters", () => {
		expect(catalogTitle(entries[0], i18n.t)).toBe("C major scale");
		expect(catalogTitle(entries[2], i18n.t)).toBe("Dominant 7th arpeggio in C");
		expect(catalogTitle(entries[18], i18n.t)).toBe("Chromatic scale");
		expect(catalogTitle(entries[34], i18n.t)).toBe("F♯ harmonic minor scale");
	});
});
