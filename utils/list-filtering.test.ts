import { PIECE_STATES } from "@/models/piece";
import { TECHNIQUE_TYPES } from "@/models/technique";
import {
	availableCollections,
	availableComposers,
	DEFAULT_PIECE_FILTERS,
	DEFAULT_TECHNIQUE_FILTERS,
	filterPieces,
	filterTechniques,
	hasNonDefaultPieceFilters,
	hasNonDefaultTechniqueFilters,
	piecePills,
	removePiecePill,
	removeTechniquePill,
	searchPieces,
	searchTechniques,
	techniquePills,
	toggleValue,
} from "./list-filtering";
import { makePiece, makeTechnique } from "./test-factories";

const ids = (items: { id?: string }[]) => items.map((i) => i.id);

describe("filterPieces", () => {
	it("hides shelved pieces by default", () => {
		const pieces = [
			makePiece({ id: "live", state: "learning" }),
			makePiece({ id: "shelved", state: "shelved" }),
		];
		expect(ids(filterPieces(pieces, DEFAULT_PIECE_FILTERS))).toEqual(["live"]);
	});

	it("shows shelved pieces once the status is selected", () => {
		const pieces = [makePiece({ id: "shelved", state: "shelved" })];
		expect(
			ids(
				filterPieces(pieces, { ...DEFAULT_PIECE_FILTERS, states: ["shelved"] }),
			),
		).toEqual(["shelved"]);
	});

	it("matches nothing when every status is deselected", () => {
		const pieces = [makePiece({ id: "a", state: "learning" })];
		expect(
			filterPieces(pieces, { ...DEFAULT_PIECE_FILTERS, states: [] }),
		).toEqual([]);
	});

	it("filters by composer, ignoring stored whitespace", () => {
		const pieces = [
			makePiece({ id: "b", composer: " Beethoven " }),
			makePiece({ id: "c", composer: "Chopin" }),
		];
		expect(
			ids(
				filterPieces(pieces, {
					...DEFAULT_PIECE_FILTERS,
					composers: ["Beethoven"],
				}),
			),
		).toEqual(["b"]);
	});

	it("excludes pieces with no collection when a collection is selected", () => {
		const pieces = [
			makePiece({ id: "in", collectionName: "Inventions" }),
			makePiece({ id: "out", collectionName: null }),
		];
		expect(
			ids(
				filterPieces(pieces, {
					...DEFAULT_PIECE_FILTERS,
					collections: ["Inventions"],
				}),
			),
		).toEqual(["in"]);
	});

	it("filters by difficulty and drops pieces that have none", () => {
		const pieces = [
			makePiece({ id: "d3", difficulty: 3 }),
			makePiece({ id: "d5", difficulty: 5 }),
			makePiece({ id: "unknown" }),
		];
		expect(
			ids(
				filterPieces(pieces, {
					...DEFAULT_PIECE_FILTERS,
					difficulties: [3, 5],
				}),
			),
		).toEqual(["d3", "d5"]);
	});

	it("applies length bounds in minutes, inclusive on both ends", () => {
		const pieces = [
			makePiece({ id: "two", durationSeconds: 120 }),
			makePiece({ id: "five", durationSeconds: 300 }),
			makePiece({ id: "ten", durationSeconds: 600 }),
		];
		expect(
			ids(
				filterPieces(pieces, {
					...DEFAULT_PIECE_FILTERS,
					lengthMinMin: 2,
					lengthMaxMin: 5,
				}),
			),
		).toEqual(["two", "five"]);
	});

	it("excludes unknown-length pieces while any length bound is active", () => {
		const pieces = [
			makePiece({ id: "known", durationSeconds: 300 }),
			makePiece({ id: "unknown", durationSeconds: null }),
		];
		expect(
			ids(filterPieces(pieces, { ...DEFAULT_PIECE_FILTERS, lengthMinMin: 1 })),
		).toEqual(["known"]);
		// ...but keeps them when no bound is set.
		expect(ids(filterPieces(pieces, DEFAULT_PIECE_FILTERS)).sort()).toEqual([
			"known",
			"unknown",
		]);
	});
});

describe("filterTechniques", () => {
	it("hides retired techniques by default", () => {
		const items = [
			makeTechnique({ id: "active", state: "active" }),
			makeTechnique({ id: "retired", state: "retired" }),
		];
		expect(ids(filterTechniques(items, DEFAULT_TECHNIQUE_FILTERS))).toEqual([
			"active",
		]);
	});

	it("filters by type and drops untyped techniques", () => {
		const items = [
			makeTechnique({ id: "scale", type: "scale" }),
			makeTechnique({ id: "none", type: null }),
		];
		expect(
			ids(
				filterTechniques(items, {
					...DEFAULT_TECHNIQUE_FILTERS,
					types: ["scale"],
				}),
			),
		).toEqual(["scale"]);
	});
});

describe("search", () => {
	it("matches pieces on title, composer or collection", () => {
		const pieces = [
			makePiece({ id: "t", title: "Moonlight" }),
			makePiece({ id: "c", title: "X", composer: "Beethoven" }),
			makePiece({ id: "k", title: "Y", collectionName: "Inventions" }),
			makePiece({ id: "no", title: "Z", composer: "Q" }),
		];
		expect(ids(searchPieces(pieces, "moon"))).toEqual(["t"]);
		expect(ids(searchPieces(pieces, "BEETH"))).toEqual(["c"]);
		expect(ids(searchPieces(pieces, "invent"))).toEqual(["k"]);
		expect(ids(searchPieces(pieces, "   "))).toHaveLength(4);
	});

	it("matches techniques on title", () => {
		const items = [
			makeTechnique({ id: "a", title: "C major scale" }),
			makeTechnique({ id: "b", title: "Octaves" }),
		];
		expect(ids(searchTechniques(items, "scale"))).toEqual(["a"]);
	});
});

describe("available values", () => {
	it("de-duplicates on the trimmed name and sorts A–Z", () => {
		const pieces = [
			makePiece({ id: "1", composer: "Chopin", collectionName: "Nocturnes" }),
			makePiece({ id: "2", composer: " Chopin ", collectionName: null }),
			makePiece({ id: "3", composer: "Bach", collectionName: "Inventions" }),
		];
		expect(availableComposers(pieces)).toEqual(["Bach", "Chopin"]);
		expect(availableCollections(pieces)).toEqual(["Inventions", "Nocturnes"]);
	});
});

describe("toggleValue", () => {
	it("adds and removes, keeping the declared order", () => {
		const added = toggleValue(["maintenance"], "learning", PIECE_STATES);
		expect(added).toEqual(["learning", "maintenance"]);
		expect(toggleValue(added, "learning", PIECE_STATES)).toEqual([
			"maintenance",
		]);
	});
});

describe("pills", () => {
	it("shows no pill while the filters are at their defaults", () => {
		expect(piecePills(DEFAULT_PIECE_FILTERS)).toEqual([]);
		expect(techniquePills(DEFAULT_TECHNIQUE_FILTERS)).toEqual([]);
		expect(hasNonDefaultPieceFilters(DEFAULT_PIECE_FILTERS)).toBe(false);
		expect(hasNonDefaultTechniqueFilters(DEFAULT_TECHNIQUE_FILTERS)).toBe(
			false,
		);
	});

	it("shows one pill per selected status once the selection deviates", () => {
		const pills = piecePills({
			...DEFAULT_PIECE_FILTERS,
			states: ["learning", "shelved"],
		});
		expect(pills.map((p) => p.id)).toEqual(["state:learning", "state:shelved"]);
		expect(
			hasNonDefaultPieceFilters({
				...DEFAULT_PIECE_FILTERS,
				states: ["learning", "shelved"],
			}),
		).toBe(true);
	});

	it("collapses a length range into a single pill carrying both bounds", () => {
		expect(
			piecePills({
				...DEFAULT_PIECE_FILTERS,
				lengthMinMin: 3,
				lengthMaxMin: 8,
			}),
		).toEqual([{ id: "length", kind: "length", min: 3, max: 8 }]);
		expect(piecePills({ ...DEFAULT_PIECE_FILTERS, lengthMinMin: 5 })).toEqual([
			{ id: "length", kind: "length", min: 5, max: null },
		]);
	});

	it("lists technique types in declared order", () => {
		const pills = techniquePills({
			...DEFAULT_TECHNIQUE_FILTERS,
			types: ["trill", "scale"],
		});
		expect(pills.map((p) => p.id)).toEqual(["type:scale", "type:trill"]);
		expect(TECHNIQUE_TYPES.indexOf("scale")).toBeLessThan(
			TECHNIQUE_TYPES.indexOf("trill"),
		);
	});
});

describe("removing pills", () => {
	it("removes exactly one value", () => {
		const filters = {
			...DEFAULT_PIECE_FILTERS,
			composers: ["Bach", "Chopin"],
		};
		const pill = piecePills(filters).find((p) => p.kind === "composer");
		if (!pill) throw new Error("expected a composer pill");
		expect(removePiecePill(filters, pill).composers).toEqual(["Chopin"]);
	});

	it("clears both length bounds with one tap", () => {
		const filters = {
			...DEFAULT_PIECE_FILTERS,
			lengthMinMin: 3,
			lengthMaxMin: 8,
		};
		const next = removePiecePill(filters, piecePills(filters)[0]);
		expect(next.lengthMinMin).toBeNull();
		expect(next.lengthMaxMin).toBeNull();
	});

	it("restores the default statuses rather than leaving an empty selection", () => {
		const filters = { ...DEFAULT_PIECE_FILTERS, states: ["shelved" as const] };
		const next = removePiecePill(filters, piecePills(filters)[0]);
		expect(next.states).toEqual(DEFAULT_PIECE_FILTERS.states);

		const tech = { ...DEFAULT_TECHNIQUE_FILTERS, states: ["retired" as const] };
		expect(removeTechniquePill(tech, techniquePills(tech)[0]).states).toEqual(
			DEFAULT_TECHNIQUE_FILTERS.states,
		);
	});
});
