import { DEFAULT_PIECE_FILTERS } from "./list-filtering";
import {
	DEFAULT_PIECE_LIST_PREFS,
	DEFAULT_TECHNIQUE_LIST_PREFS,
	LIST_PREFS_SCHEMA_VERSION,
	sanitizePieceListPrefs,
	sanitizeTechniqueListPrefs,
} from "./list-prefs";

const stored = (over: Record<string, unknown>) => ({
	v: LIST_PREFS_SCHEMA_VERSION,
	sortKey: "title",
	sortDir: "asc",
	filters: {},
	...over,
});

describe("sanitizePieceListPrefs", () => {
	it("defaults to score, high to low", () => {
		expect(DEFAULT_PIECE_LIST_PREFS.sortKey).toBe("score");
		expect(DEFAULT_PIECE_LIST_PREFS.sortDir).toBe("desc");
		expect(DEFAULT_PIECE_LIST_PREFS.filters).toEqual(DEFAULT_PIECE_FILTERS);
	});

	it("round trips a well-formed value", () => {
		const prefs = {
			v: LIST_PREFS_SCHEMA_VERSION,
			sortKey: "length" as const,
			sortDir: "desc" as const,
			filters: {
				states: ["learning" as const],
				composers: ["Bach"],
				collections: ["Inventions"],
				difficulties: [3 as const],
				lengthMinMin: 2,
				lengthMaxMin: 9,
			},
		};
		expect(sanitizePieceListPrefs(prefs)).toEqual(prefs);
	});

	it("rejects a different schema version", () => {
		expect(sanitizePieceListPrefs(stored({ v: 99 }))).toBeNull();
		expect(sanitizePieceListPrefs(stored({ v: undefined }))).toBeNull();
	});

	it("rejects anything that is not an object", () => {
		expect(sanitizePieceListPrefs(null)).toBeNull();
		expect(sanitizePieceListPrefs("nope")).toBeNull();
		expect(sanitizePieceListPrefs([])).toBeNull();
	});

	it("falls back to the default sort when the key is unknown", () => {
		const prefs = sanitizePieceListPrefs(stored({ sortKey: "vibes" }));
		expect(prefs?.sortKey).toBe(DEFAULT_PIECE_LIST_PREFS.sortKey);
	});

	it("falls back to the sort's own default direction when the direction is junk", () => {
		expect(
			sanitizePieceListPrefs(stored({ sortKey: "score", sortDir: "sideways" }))
				?.sortDir,
		).toBe("desc");
		expect(
			sanitizePieceListPrefs(stored({ sortKey: "title", sortDir: null }))
				?.sortDir,
		).toBe("asc");
	});

	it("drops unknown filter members and keeps the declared order", () => {
		const prefs = sanitizePieceListPrefs(
			stored({
				filters: {
					states: ["shelved", "bogus", "learning"],
					difficulties: [3, 9, "2"],
				},
			}),
		);
		expect(prefs?.filters.states).toEqual(["learning", "shelved"]);
		expect(prefs?.filters.difficulties).toEqual([3]);
	});

	it("restores the default statuses when none survive", () => {
		const prefs = sanitizePieceListPrefs(
			stored({ filters: { states: ["bogus"] } }),
		);
		expect(prefs?.filters.states).toEqual(DEFAULT_PIECE_FILTERS.states);
	});

	it("drops blank and non-string composer/collection entries", () => {
		const prefs = sanitizePieceListPrefs(
			stored({
				filters: { composers: [" Bach ", "", 7], collections: "nope" },
			}),
		);
		expect(prefs?.filters.composers).toEqual(["Bach"]);
		expect(prefs?.filters.collections).toEqual([]);
	});

	it("drops negative and non-numeric length bounds", () => {
		const prefs = sanitizePieceListPrefs(
			stored({ filters: { lengthMinMin: -3, lengthMaxMin: "8" } }),
		);
		expect(prefs?.filters.lengthMinMin).toBeNull();
		expect(prefs?.filters.lengthMaxMin).toBeNull();
	});
});

describe("sanitizeTechniqueListPrefs", () => {
	it("defaults to score, high to low, with retired hidden", () => {
		expect(DEFAULT_TECHNIQUE_LIST_PREFS.sortKey).toBe("score");
		expect(DEFAULT_TECHNIQUE_LIST_PREFS.sortDir).toBe("desc");
		expect(DEFAULT_TECHNIQUE_LIST_PREFS.filters.states).not.toContain(
			"retired",
		);
	});

	it("keeps known states and types only", () => {
		const prefs = sanitizeTechniqueListPrefs(
			stored({
				sortKey: "type",
				filters: { states: ["retired", "nope"], types: ["trill", "nope"] },
			}),
		);
		expect(prefs?.sortKey).toBe("type");
		expect(prefs?.filters.states).toEqual(["retired"]);
		expect(prefs?.filters.types).toEqual(["trill"]);
	});

	it("rejects a piece-only sort key", () => {
		expect(
			sanitizeTechniqueListPrefs(stored({ sortKey: "composer" }))?.sortKey,
		).toBe(DEFAULT_TECHNIQUE_LIST_PREFS.sortKey);
	});
});
