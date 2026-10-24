import type { TechniqueItem } from "@/models/technique";
import { catalogEntries } from "@/utils/technique-catalog";
import { matchCatalog } from "@/utils/technique-match";

const entries = catalogEntries();
const technique = (
	title: string,
	overrides: Partial<TechniqueItem> = {},
): TechniqueItem => ({
	id: title,
	userId: "student",
	title,
	state: "active",
	dateIntroduced: new Date(2026, 0, 1),
	...overrides,
});

function match(
	title: string,
	key: string,
	overrides: Partial<TechniqueItem> = {},
) {
	return matchCatalog([technique(title, overrides)], entries)[
		entries.findIndex((entry) => entry.key === key)
	];
}

describe("matchCatalog", () => {
	it.each([
		["  C   MAJOR scale  ", "scale.major.C"],
		["Bb major", "scale.major.B♭"],
		["F# maj", "scale.major.F♯"],
		["A harm min scale", "scale.harmonicMinor.A"],
		["A mel min", "scale.melodicMinor.A"],
		["C major arp", "arpeggio.major.C"],
		["A min arpeggios", "arpeggio.minor.A"],
		["dom 7 arpeggio in C", "arpeggio.dominant7.C"],
		["dom7 arpeggio in C", "arpeggio.dominant7.C"],
		["dominant seventh arpeggio in C", "arpeggio.dominant7.C"],
		["dominant 7 arpeggio in C", "arpeggio.dominant7.C"],
		["Chromatic", "scale.chromatic"],
	])("normalizes %s to an exact match", (title, key) => {
		expect(match(title, key).kind).toBe("exact");
	});

	it("uses curriculumKey regardless of title, without claiming another entry", () => {
		const linked = technique("C major scale", {
			curriculumKey: "arpeggio.minor.G",
		});
		const results = matchCatalog([linked], entries);
		expect(
			results[entries.findIndex((entry) => entry.key === "arpeggio.minor.G")],
		).toEqual({ kind: "exact", technique: linked });
		expect(results[0]).toEqual({ kind: "none" });
		expect(results.filter((result) => result.kind === "exact")).toHaveLength(1);
		expect(
			match("G minor", "scale.harmonicMinor.G", {
				curriculumKey: "arpeggio.minor.G",
			}),
		).toEqual({ kind: "none" });
	});

	it("reserves linked matches before title matches even when entries are reversed", () => {
		const linked = technique("C major scale", {
			curriculumKey: "arpeggio.minor.G",
		});
		const reversed = [...entries].reverse();
		expect(
			matchCatalog([linked], reversed).filter(
				(result) => result.kind === "exact",
			),
		).toHaveLength(1);
	});

	it.each([
		["G minor", "scale.harmonicMinor.G"],
		["G minor", "scale.melodicMinor.G"],
		["G minor", "arpeggio.minor.G"],
		["bb minor", "scale.harmonicMinor.B♭"],
		["C#m", "arpeggio.minor.C♯"],
		["G minor scale", "scale.harmonicMinor.G"],
	])("finds near match for %s against %s", (title, key) => {
		expect(match(title, key).kind).toBe("near");
	});

	it.each([
		["Hanon No. 1", "scale.major.C"],
		["G major", "scale.harmonicMinor.G"],
		["A harmonic minor", "scale.melodicMinor.A"],
		["G minor arpeggio", "scale.harmonicMinor.G"],
		["G minor scale", "arpeggio.minor.G"],
		["F major", "scale.major.F♯"],
	])("rejects incompatible %s against %s", (title, key) => {
		expect(match(title, key)).toEqual({ kind: "none" });
	});

	it("requires matching type for near matches only", () => {
		expect(
			match("G minor", "scale.harmonicMinor.G", { type: "arpeggio" }),
		).toEqual({ kind: "none" });
		expect(
			match("G minor", "scale.harmonicMinor.G", { type: "scale" }).kind,
		).toBe("near");
		expect(
			match("C major scale", "scale.major.C", { type: "exercise" }).kind,
		).toBe("exact");
	});

	it("counts retired techniques and prefers exact over earlier near matches", () => {
		const exact = technique("G harmonic minor scale", { state: "retired" });
		const index = entries.findIndex(
			(entry) => entry.key === "scale.harmonicMinor.G",
		);
		expect(matchCatalog([technique("G minor"), exact], entries)[index]).toEqual(
			{ kind: "exact", technique: exact },
		);
	});

	it("returns none for empty input and never exact-matches one technique twice", () => {
		expect(
			matchCatalog([], entries).every((result) => result.kind === "none"),
		).toBe(true);
		const results = matchCatalog([technique("C major")], entries);
		expect(results.filter((result) => result.kind === "exact")).toHaveLength(1);
		expect(results[1].kind).toBe("near");
	});
});
