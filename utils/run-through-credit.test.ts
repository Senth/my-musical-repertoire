import type { Piece } from "@/models/piece";
import type { ByMode } from "@/models/practice";
import { PracticeMistakes } from "@/models/practice";
import type { Section } from "@/models/section";
import {
	computeRunThroughEffects,
	type RunThroughInput,
} from "./run-through-credit";
import { makePiece, makeSection } from "./test-factories";

const NOW = new Date("2026-08-08T10:00:00Z");
const EARLIER = new Date("2026-08-01T10:00:00Z");

function ht(over: Partial<ByMode["HT"]> = {}): ByMode {
	return {
		HT: { bpm: 100, quality: 3, effort: 3, lastPracticed: EARLIER, ...over },
	};
}

function run(over: Partial<RunThroughInput> & { sections: Section[] }) {
	const piece: Piece =
		over.piece ?? makePiece({ id: "p1", state: "maintenance" });
	return computeRunThroughEffects({
		piece,
		flaggedSectionIds: [],
		technicalMistakes: PracticeMistakes.none,
		memoryMistakes: PracticeMistakes.none,
		achievedBpm: null,
		now: NOW,
		...over,
		sections: over.sections,
	});
}

/** A maintenance-phase section with a full prior HT rating. */
function maintenanceSection(over: Partial<Section> & { id: string }): Section {
	return makeSection({
		pieceId: "p1",
		phase: "maintenance",
		byMode: ht(),
		...over,
	});
}

describe("computeRunThroughEffects", () => {
	describe("piece-state gating", () => {
		it.each([
			"maintenance",
			"performance",
		] as const)("acts on a %s piece", (state) => {
			const result = run({
				piece: makePiece({ id: "p1", state }),
				sections: [maintenanceSection({ id: "s1" })],
			});
			expect(result.credits).toHaveLength(1);
		});

		it.each([
			"learning",
			"stabilizing",
			"on_hold",
			"shelved",
		] as const)("writes nothing for a %s piece", (state) => {
			const result = run({
				piece: makePiece({ id: "p1", state }),
				sections: [maintenanceSection({ id: "s1" })],
				flaggedSectionIds: ["s1"],
			});
			expect(result).toEqual({ credits: [], demotions: [] });
		});
	});

	describe("phase gating", () => {
		it.each([
			"learning",
			"stabilizing",
		] as const)("leaves a %s-phase section alone whether ticked or not", (phase) => {
			const sections = [
				maintenanceSection({ id: "s1", phase }),
				maintenanceSection({ id: "s2", phase }),
			];
			const result = run({ sections, flaggedSectionIds: ["s2"] });
			expect(result).toEqual({ credits: [], demotions: [] });
		});

		it("skips archived sections", () => {
			const result = run({
				sections: [maintenanceSection({ id: "s1", archived: true })],
			});
			expect(result).toEqual({ credits: [], demotions: [] });
		});

		it("returns an empty result for a piece with no maintenance-phase sections", () => {
			const result = run({
				sections: [
					maintenanceSection({ id: "s1", phase: "learning" }),
					maintenanceSection({ id: "s2", phase: "stabilizing" }),
				],
			});
			expect(result).toEqual({ credits: [], demotions: [] });
		});
	});

	describe("ticked vs unticked", () => {
		it("credits the unticked and demotes the ticked", () => {
			const result = run({
				sections: [
					maintenanceSection({ id: "s1" }),
					maintenanceSection({ id: "s2" }),
					maintenanceSection({ id: "s3" }),
				],
				flaggedSectionIds: ["s2"],
			});
			expect(result.credits.map((c) => c.sectionId)).toEqual(["s1", "s3"]);
			expect(result.demotions).toEqual(["s2"]);
		});

		it("writes no log and no byMode for a ticked section", () => {
			const result = run({
				sections: [maintenanceSection({ id: "s1" })],
				flaggedSectionIds: ["s1"],
			});
			expect(result.credits).toEqual([]);
			expect(result.demotions).toEqual(["s1"]);
		});
	});

	describe("credit", () => {
		it("only touches HT, leaving LH and RH untouched", () => {
			const byMode: ByMode = {
				...ht(),
				LH: { bpm: 90, quality: 2, effort: 4, lastPracticed: EARLIER },
				RH: { bpm: 95, quality: 4, effort: 2, lastPracticed: EARLIER },
			};
			const result = run({
				sections: [maintenanceSection({ id: "s1", byMode })],
			});
			expect(result.credits[0].byMode.LH).toEqual(byMode.LH);
			expect(result.credits[0].byMode.RH).toEqual(byMode.RH);
			expect(result.credits[0].byMode.HT?.lastPracticed).toEqual(NOW);
		});

		it("always refreshes lastPracticed, even after a bad run", () => {
			const result = run({
				sections: [maintenanceSection({ id: "s1" })],
				technicalMistakes: PracticeMistakes.everywhere,
				memoryMistakes: PracticeMistakes.many,
			});
			expect(result.credits[0].byMode.HT?.lastPracticed).toEqual(NOW);
		});

		it("preserves effort — a run-through says nothing about it", () => {
			const result = run({
				sections: [maintenanceSection({ id: "s1", byMode: ht({ effort: 4 }) })],
			});
			expect(result.credits[0].byMode.HT?.effort).toBe(4);
			expect(result.credits[0].log.effort).toBe(4);
		});

		it("recomputes the derived display fields", () => {
			const byMode: ByMode = {
				...ht({ bpm: 120 }),
				LH: { bpm: 80, quality: 2, effort: 4, lastPracticed: EARLIER },
			};
			const result = run({
				sections: [maintenanceSection({ id: "s1", byMode })],
			});
			expect(result.credits[0].derived).toEqual({
				// Minimum across practised hands modes.
				bpm: 80,
				// Most recently practised mode is now HT.
				quality: 4,
				effort: 3,
				lastPracticed: NOW,
			});
		});
	});

	describe("bpm", () => {
		it("writes nothing when the achieved BPM is blank", () => {
			const result = run({
				sections: [maintenanceSection({ id: "s1", byMode: ht({ bpm: 100 }) })],
				achievedBpm: null,
			});
			expect(result.credits[0].byMode.HT?.bpm).toBe(100);
			expect(result.credits[0].log.achievedBpm).toBeNull();
		});

		it("never lowers the stored BPM", () => {
			const result = run({
				sections: [maintenanceSection({ id: "s1", byMode: ht({ bpm: 100 }) })],
				achievedBpm: 80,
			});
			expect(result.credits[0].byMode.HT?.bpm).toBe(100);
			// The log still records the tempo actually played.
			expect(result.credits[0].log.achievedBpm).toBe(80);
		});

		it("raises the stored BPM when the run-through was faster", () => {
			const result = run({
				sections: [maintenanceSection({ id: "s1", byMode: ht({ bpm: 100 }) })],
				achievedBpm: 112,
			});
			expect(result.credits[0].byMode.HT?.bpm).toBe(112);
		});

		it("sets the first BPM on a section that had none", () => {
			const result = run({
				sections: [maintenanceSection({ id: "s1", byMode: {} })],
				achievedBpm: 90,
			});
			expect(result.credits[0].byMode.HT?.bpm).toBe(90);
		});
	});

	describe("quality", () => {
		it("stays null when the section was never rated", () => {
			const result = run({
				sections: [maintenanceSection({ id: "s1", byMode: {} })],
			});
			expect(result.credits[0].byMode.HT?.quality).toBeNull();
			expect(result.credits[0].log.quality).toBeNull();
		});

		it.each([
			PracticeMistakes.none,
			PracticeMistakes.few,
		])("rises one step after a clean run (mistakes level %s)", (level) => {
			const result = run({
				sections: [
					maintenanceSection({ id: "s1", byMode: ht({ quality: 3 }) }),
				],
				technicalMistakes: level,
				memoryMistakes: level,
			});
			expect(result.credits[0].byMode.HT?.quality).toBe(4);
		});

		it.each([
			PracticeMistakes.some,
			PracticeMistakes.many,
			PracticeMistakes.everywhere,
		])("does not rise at mistakes level %s", (level) => {
			const result = run({
				sections: [
					maintenanceSection({ id: "s1", byMode: ht({ quality: 3 }) }),
				],
				technicalMistakes: level,
				memoryMistakes: PracticeMistakes.none,
			});
			expect(result.credits[0].byMode.HT?.quality).toBe(3);
		});

		it("takes the worse of the two mistake levels", () => {
			const result = run({
				sections: [
					maintenanceSection({ id: "s1", byMode: ht({ quality: 3 }) }),
				],
				technicalMistakes: PracticeMistakes.none,
				memoryMistakes: PracticeMistakes.some,
			});
			expect(result.credits[0].byMode.HT?.quality).toBe(3);
		});

		it("caps at 5", () => {
			const result = run({
				sections: [
					maintenanceSection({ id: "s1", byMode: ht({ quality: 5 }) }),
				],
			});
			expect(result.credits[0].byMode.HT?.quality).toBe(5);
		});
	});

	describe("log payload", () => {
		it("is hands-together, drill-free and marked as a run-through", () => {
			const result = run({
				sections: [maintenanceSection({ id: "s1" })],
				achievedBpm: 104,
			});
			expect(result.credits[0].log).toEqual({
				date: NOW,
				hands: "HT",
				drill: null,
				quality: 4,
				effort: 3,
				achievedBpm: 104,
				source: "run-through",
			});
		});
	});
});
