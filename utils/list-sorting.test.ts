import {
	nextSort,
	PIECE_SORTS,
	sortPieces,
	sortTechniqueItems,
	TECHNIQUE_SORTS,
} from "./list-sorting";
import { makePiece, makeTechnique } from "./test-factories";

const ids = (items: { id?: string }[]) => items.map((i) => i.id);

describe("sortPieces", () => {
	it("orders by score, highest first", () => {
		const pieces = [
			makePiece({ id: "a" }),
			makePiece({ id: "b" }),
			makePiece({ id: "c" }),
		];
		const scores = { a: 5, b: 90, c: 40 };
		expect(
			ids(sortPieces(pieces, { key: "score", dir: "desc" }, scores)),
		).toEqual(["b", "c", "a"]);
		expect(
			ids(sortPieces(pieces, { key: "score", dir: "asc" }, scores)),
		).toEqual(["a", "c", "b"]);
	});

	it("treats a piece with no score as 0 rather than unknown", () => {
		const pieces = [makePiece({ id: "a" }), makePiece({ id: "b" })];
		expect(
			ids(sortPieces(pieces, { key: "score", dir: "desc" }, { a: -5 })),
		).toEqual(["b", "a"]);
	});

	it("puts never-practiced first when sorting oldest-first", () => {
		const pieces = [
			makePiece({ id: "recent", lastPracticed: new Date("2026-05-30") }),
			makePiece({ id: "never", lastPracticed: null }),
			makePiece({ id: "old", lastPracticed: new Date("2026-01-01") }),
		];
		expect(
			ids(sortPieces(pieces, { key: "lastPracticed", dir: "asc" }, {})),
		).toEqual(["never", "old", "recent"]);
	});

	it("puts never-practiced last when the direction is flipped", () => {
		const pieces = [
			makePiece({ id: "recent", lastPracticed: new Date("2026-05-30") }),
			makePiece({ id: "never", lastPracticed: null }),
			makePiece({ id: "old", lastPracticed: new Date("2026-01-01") }),
		];
		expect(
			ids(sortPieces(pieces, { key: "lastPracticed", dir: "desc" }, {})),
		).toEqual(["recent", "old", "never"]);
	});

	it("keeps missing length last in both directions", () => {
		const pieces = [
			makePiece({ id: "unknown", durationSeconds: null }),
			makePiece({ id: "long", durationSeconds: 900 }),
			makePiece({ id: "short", durationSeconds: 120 }),
		];
		expect(ids(sortPieces(pieces, { key: "length", dir: "asc" }, {}))).toEqual([
			"short",
			"long",
			"unknown",
		]);
		expect(ids(sortPieces(pieces, { key: "length", dir: "desc" }, {}))).toEqual(
			["long", "short", "unknown"],
		);
	});

	it("keeps missing difficulty last in both directions", () => {
		const pieces = [
			makePiece({ id: "hard", difficulty: 5 }),
			makePiece({ id: "unknown" }),
			makePiece({ id: "easy", difficulty: 1 }),
		];
		expect(
			ids(sortPieces(pieces, { key: "difficulty", dir: "asc" }, {})),
		).toEqual(["easy", "hard", "unknown"]);
		expect(
			ids(sortPieces(pieces, { key: "difficulty", dir: "desc" }, {})),
		).toEqual(["hard", "easy", "unknown"]);
	});

	it("keeps pieces with no collection last when sorting by collection", () => {
		const pieces = [
			makePiece({ id: "none", collectionName: null }),
			makePiece({ id: "wtc", collectionName: "Well-Tempered Clavier" }),
			makePiece({ id: "inv", collectionName: "Inventions" }),
		];
		expect(
			ids(sortPieces(pieces, { key: "collection", dir: "asc" }, {})),
		).toEqual(["inv", "wtc", "none"]);
	});

	it("breaks every tie on title, ascending, whatever the direction", () => {
		const pieces = [
			makePiece({ id: "b", title: "Beta", difficulty: 3 }),
			makePiece({ id: "a", title: "Alpha", difficulty: 3 }),
		];
		expect(
			ids(sortPieces(pieces, { key: "difficulty", dir: "asc" }, {})),
		).toEqual(["a", "b"]);
		expect(
			ids(sortPieces(pieces, { key: "difficulty", dir: "desc" }, {})),
		).toEqual(["a", "b"]);
	});

	it("sorts status in the declared PIECE_STATES order", () => {
		const pieces = [
			makePiece({ id: "shelved", state: "shelved" }),
			makePiece({ id: "learning", state: "learning" }),
			makePiece({ id: "perf", state: "performance" }),
		];
		expect(ids(sortPieces(pieces, { key: "state", dir: "asc" }, {}))).toEqual([
			"learning",
			"perf",
			"shelved",
		]);
	});

	it("does not mutate the input array", () => {
		const pieces = [makePiece({ id: "b" }), makePiece({ id: "a" })];
		sortPieces(pieces, { key: "title", dir: "asc" }, {});
		expect(ids(pieces)).toEqual(["b", "a"]);
	});
});

describe("sortTechniqueItems", () => {
	it("keeps techniques with no type last", () => {
		const items = [
			makeTechnique({ id: "none", type: null }),
			makeTechnique({ id: "scale", type: "scale" }),
			makeTechnique({ id: "trill", type: "trill" }),
		];
		expect(
			ids(sortTechniqueItems(items, { key: "type", dir: "asc" }, {})),
		).toEqual(["scale", "trill", "none"]);
		expect(
			ids(sortTechniqueItems(items, { key: "type", dir: "desc" }, {})),
		).toEqual(["trill", "scale", "none"]);
	});

	it("puts never-practiced first when sorting oldest-first", () => {
		const items = [
			makeTechnique({ id: "done", lastPracticedAt: new Date("2026-05-01") }),
			makeTechnique({ id: "never", lastPracticedAt: null }),
		];
		expect(
			ids(sortTechniqueItems(items, { key: "lastPracticed", dir: "asc" }, {})),
		).toEqual(["never", "done"]);
	});

	it("orders by score, highest first", () => {
		const items = [makeTechnique({ id: "a" }), makeTechnique({ id: "b" })];
		expect(
			ids(
				sortTechniqueItems(
					items,
					{ key: "score", dir: "desc" },
					{ a: 1, b: 9 },
				),
			),
		).toEqual(["b", "a"]);
	});
});

describe("nextSort", () => {
	it("flips direction when the active sort is tapped again", () => {
		expect(
			nextSort(PIECE_SORTS, { key: "score", dir: "desc" }, "score"),
		).toEqual({ key: "score", dir: "asc" });
	});

	it("switches to another sort at its own default direction", () => {
		expect(
			nextSort(PIECE_SORTS, { key: "score", dir: "asc" }, "title"),
		).toEqual({
			key: "title",
			dir: "asc",
		});
		expect(
			nextSort(TECHNIQUE_SORTS, { key: "title", dir: "desc" }, "score"),
		).toEqual({ key: "score", dir: "desc" });
	});
});
