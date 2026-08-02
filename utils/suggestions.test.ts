import type { Piece } from "@/models/piece";
import {
	collectionSuggestions,
	composerSuggestions,
	dedupeSuggestions,
} from "./suggestions";

function piece(
	composer: string,
	collectionName?: string | null,
	title = "T",
): Piece {
	return {
		userId: "u1",
		title,
		composer,
		collectionName: collectionName ?? null,
		state: "learning",
	};
}

describe("dedupeSuggestions", () => {
	it("dedupes case-insensitively keeping the first-seen variant", () => {
		expect(dedupeSuggestions(["Uematsu", "uematsu", "UEMATSU"])).toEqual([
			"Uematsu",
		]);
	});

	it("sorts alphabetically case-insensitively", () => {
		expect(dedupeSuggestions(["chopin", "Bach", "debussy"])).toEqual([
			"Bach",
			"chopin",
			"debussy",
		]);
	});

	it("drops blank and nullish values and trims", () => {
		expect(dedupeSuggestions(["  Bach  ", "", "   ", null, undefined])).toEqual(
			["Bach"],
		);
	});
});

describe("composerSuggestions", () => {
	const pieces = [
		piece("Nobuo Uematsu"),
		piece("nobuo uematsu"),
		piece("Frédéric Chopin"),
		piece("Claude Debussy"),
	];

	it("returns nothing for an empty query", () => {
		expect(composerSuggestions(pieces, "")).toEqual([]);
		expect(composerSuggestions(pieces, "   ")).toEqual([]);
	});

	it("matches case-insensitive substrings and dedupes", () => {
		expect(composerSuggestions(pieces, "uema")).toEqual(["Nobuo Uematsu"]);
	});

	it("caps at 5", () => {
		const many = ["a1", "a2", "a3", "a4", "a5", "a6"].map((c) => piece(c));
		expect(composerSuggestions(many, "a")).toHaveLength(5);
	});
});

describe("collectionSuggestions", () => {
	const pieces = [
		piece("Nobuo Uematsu", "Final Fantasy VII"),
		piece("Nobuo Uematsu", "final fantasy vii"),
		piece("Nobuo Uematsu", "Final Fantasy VII Piano Collections"),
		piece("Nobuo Uematsu", null),
		piece("Joe Hisaishi", "Spirited Away"),
		piece("Various Artists", "Final Fantasy VII Remake"),
	];

	it("returns nothing when both composer and query are empty", () => {
		expect(collectionSuggestions(pieces, "", "")).toEqual([]);
	});

	it("returns the composer's collections alphabetically on an empty query", () => {
		expect(collectionSuggestions(pieces, "Nobuo Uematsu", "")).toEqual([
			"Final Fantasy VII",
			"Final Fantasy VII Piano Collections",
		]);
	});

	it("matches the composer case-insensitively and trimmed", () => {
		expect(collectionSuggestions(pieces, "  nobuo uematsu  ", "")).toEqual([
			"Final Fantasy VII",
			"Final Fantasy VII Piano Collections",
		]);
	});

	it("returns nothing on an empty query for a composer with no collections", () => {
		expect(collectionSuggestions(pieces, "Erik Satie", "")).toEqual([]);
	});

	it("ranks same-composer matches before other composers' matches", () => {
		expect(collectionSuggestions(pieces, "Various Artists", "final")).toEqual([
			"Final Fantasy VII Remake",
			"Final Fantasy VII",
			"Final Fantasy VII Piano Collections",
		]);
	});

	it("searches all collections when a query is typed, even for an empty composer", () => {
		expect(collectionSuggestions(pieces, "", "spirited")).toEqual([
			"Spirited Away",
		]);
	});

	it("does not repeat a collection shared by the current composer and others", () => {
		const shared = [
			piece("A", "Shared"),
			piece("B", "Shared"),
			piece("B", "Other"),
		];
		expect(collectionSuggestions(shared, "A", "s")).toEqual(["Shared"]);
	});

	it("caps at 5 total across both groups", () => {
		const many = [
			piece("A", "x1"),
			piece("A", "x2"),
			piece("A", "x3"),
			piece("B", "x4"),
			piece("B", "x5"),
			piece("B", "x6"),
		];
		const result = collectionSuggestions(many, "A", "x");
		expect(result).toHaveLength(5);
		expect(result.slice(0, 3)).toEqual(["x1", "x2", "x3"]);
	});
});
