import type { ByMode } from "@/models/practice";
import {
	availableHandsModes,
	byModeFromFirestore,
	deriveCurrentBpm,
	deriveFromByMode,
	deriveLastPracticed,
	deriveLastRating,
	hsTarget,
	isHtReady,
	mergeByMode,
	modeKey,
	parseModeKey,
	pickPreselectedHands,
	targetForMode,
} from "./practice-modes";

const D = (iso: string) => new Date(iso);

describe("practice-modes", () => {
	describe("modeKey / parseModeKey", () => {
		it("omits the drill part for the normal drill", () => {
			expect(modeKey("LH")).toBe("LH");
			expect(modeKey("HT", null)).toBe("HT");
		});

		it("round-trips a drill key", () => {
			expect(modeKey("LH", "staccato")).toBe("LH.staccato");
			expect(parseModeKey("LH.staccato")).toEqual({
				hands: "LH",
				drill: "staccato",
			});
		});

		it("parses a plain key with a null drill", () => {
			expect(parseModeKey("RH")).toEqual({ hands: "RH", drill: null });
		});
	});

	describe("targets", () => {
		it("rounds the hands-separate target to 115%", () => {
			expect(hsTarget(96)).toBe(110);
			expect(hsTarget(100)).toBe(115);
			expect(hsTarget(null)).toBeNull();
		});

		it("uses the plain target for HT and the raised one for LH/RH", () => {
			expect(targetForMode("HT", 96)).toBe(96);
			expect(targetForMode("LH", 96)).toBe(110);
			expect(targetForMode("RH", 96)).toBe(110);
			expect(targetForMode("LH", null)).toBeNull();
		});
	});

	describe("availableHandsModes", () => {
		it("maps each technique hands mode", () => {
			expect(availableHandsModes("together")).toEqual(["HT"]);
			expect(availableHandsModes("separate")).toEqual(["LH", "RH"]);
			expect(availableHandsModes("both")).toEqual(["LH", "RH", "HT"]);
		});

		it("defaults to separate when absent", () => {
			expect(availableHandsModes(undefined)).toEqual(["LH", "RH"]);
			expect(availableHandsModes(null)).toEqual(["LH", "RH"]);
		});
	});

	describe("isHtReady", () => {
		it("is true when both hands reach the hands-separate target", () => {
			const byMode: ByMode = { LH: { bpm: 110 }, RH: { bpm: 120 } };
			expect(isHtReady(byMode, 96)).toBe(true);
		});

		it("is false when one hand lags", () => {
			const byMode: ByMode = { LH: { bpm: 109 }, RH: { bpm: 120 } };
			expect(isHtReady(byMode, 96)).toBe(false);
		});

		it("is false when a hand was never practised", () => {
			expect(isHtReady({ LH: { bpm: 130 } }, 96)).toBe(false);
		});

		it("is false without a target", () => {
			expect(isHtReady({ LH: { bpm: 130 }, RH: { bpm: 130 } }, null)).toBe(
				false,
			);
		});
	});

	describe("pickPreselectedHands", () => {
		const all = ["LH", "RH", "HT"] as const;

		it("picks the hand furthest from the hands-separate target", () => {
			const byMode: ByMode = { LH: { bpm: 100 }, RH: { bpm: 80 } };
			expect(pickPreselectedHands(byMode, [...all], 96)).toBe("RH");
		});

		it("prefers a never-practised hand over any lagging one", () => {
			const byMode: ByMode = { RH: { bpm: 40 } };
			expect(pickPreselectedHands(byMode, [...all], 96)).toBe("LH");
		});

		it("breaks an equal gap on lower quality", () => {
			const byMode: ByMode = {
				LH: { bpm: 90, quality: 4 },
				RH: { bpm: 90, quality: 2 },
			};
			expect(pickPreselectedHands(byMode, [...all], 96)).toBe("RH");
		});

		it("treats unknown quality as better than a known-bad one", () => {
			const byMode: ByMode = {
				LH: { bpm: 90 },
				RH: { bpm: 90, quality: 3 },
			};
			expect(pickPreselectedHands(byMode, [...all], 96)).toBe("RH");
		});

		it("breaks an equal gap and quality on staleness", () => {
			const byMode: ByMode = {
				LH: { bpm: 90, quality: 3, lastPracticed: D("2026-01-01") },
				RH: { bpm: 90, quality: 3, lastPracticed: D("2026-01-05") },
			};
			expect(pickPreselectedHands(byMode, [...all], 96)).toBe("LH");
		});

		it("overrides to HT when both hands are ready", () => {
			const byMode: ByMode = { LH: { bpm: 110 }, RH: { bpm: 111 } };
			expect(pickPreselectedHands(byMode, [...all], 96)).toBe("HT");
		});

		it("never picks HT when it is not available", () => {
			const byMode: ByMode = { LH: { bpm: 110 }, RH: { bpm: 111 } };
			expect(pickPreselectedHands(byMode, ["LH", "RH"], 96)).toBe("LH");
		});

		it("returns HT when it is the only mode", () => {
			expect(pickPreselectedHands({}, ["HT"], 96)).toBe("HT");
		});

		it("falls back to the first hand on an empty byMode", () => {
			expect(pickPreselectedHands(undefined, [...all], 96)).toBe("LH");
			expect(pickPreselectedHands({}, [...all], null)).toBe("LH");
		});

		it("ignores drill keys when ranking hands", () => {
			const byMode: ByMode = {
				LH: { bpm: 100 },
				RH: { bpm: 80 },
				"LH.staccato": { bpm: 40 },
			};
			expect(pickPreselectedHands(byMode, [...all], 96)).toBe("RH");
		});
	});

	describe("deriveCurrentBpm", () => {
		it("takes the minimum across hands modes", () => {
			const byMode: ByMode = {
				LH: { bpm: 111 },
				RH: { bpm: 104 },
				HT: { bpm: 72 },
			};
			expect(deriveCurrentBpm(byMode)).toBe(72);
		});

		it("excludes drill keys", () => {
			const byMode: ByMode = {
				LH: { bpm: 111 },
				"LH.staccato": { bpm: 60 },
			};
			expect(deriveCurrentBpm(byMode)).toBe(111);
		});

		it("ignores modes without a bpm", () => {
			const byMode: ByMode = { LH: { bpm: 111 }, RH: { quality: 3 } };
			expect(deriveCurrentBpm(byMode)).toBe(111);
		});

		it("returns null for an empty or absent byMode", () => {
			expect(deriveCurrentBpm({})).toBeNull();
			expect(deriveCurrentBpm(undefined)).toBeNull();
		});
	});

	describe("deriveLastPracticed", () => {
		it("takes the maximum across all modes, drills included", () => {
			const byMode: ByMode = {
				LH: { lastPracticed: D("2026-01-01T10:00:00Z") },
				"RH.staccato": { lastPracticed: D("2026-01-04T10:00:00Z") },
				HT: { lastPracticed: D("2026-01-02T10:00:00Z") },
			};
			expect(deriveLastPracticed(byMode)).toEqual(D("2026-01-04T10:00:00Z"));
		});

		it("returns null when nothing was practised", () => {
			expect(deriveLastPracticed({ LH: { bpm: 90 } })).toBeNull();
			expect(deriveLastPracticed(undefined)).toBeNull();
		});
	});

	describe("deriveLastRating", () => {
		it("returns the ratings of the most recently practised mode", () => {
			const byMode: ByMode = {
				LH: { quality: 2, effort: 5, lastPracticed: D("2026-01-01T10:00:00Z") },
				RH: { quality: 4, effort: 1, lastPracticed: D("2026-01-03T10:00:00Z") },
			};
			expect(deriveLastRating(byMode)).toEqual({ quality: 4, effort: 1 });
		});

		it("returns nulls when nothing was practised", () => {
			expect(deriveLastRating({})).toEqual({ quality: null, effort: null });
		});
	});

	describe("mergeByMode", () => {
		const saved = D("2026-02-01T10:00:00Z");

		it("adds one entry per mode and leaves other modes alone", () => {
			const existing: ByMode = {
				HT: { bpm: 72, quality: 2, effort: 4, lastPracticed: D("2026-01-01") },
			};
			const merged = mergeByMode(
				existing,
				[
					{ hands: "LH", drill: null, bpm: 111, quality: 4, effort: 2 },
					{ hands: "RH", drill: "staccato", bpm: 90, quality: 3, effort: 3 },
				],
				saved,
			);
			expect(merged.LH).toEqual({
				bpm: 111,
				quality: 4,
				effort: 2,
				lastPracticed: saved,
			});
			expect(merged["RH.staccato"].bpm).toBe(90);
			expect(merged.HT).toEqual(existing.HT);
		});

		it("keeps the previous bpm when none was logged", () => {
			const merged = mergeByMode(
				{ LH: { bpm: 104 } },
				[{ hands: "LH", drill: null, bpm: null, quality: 5, effort: 1 }],
				saved,
			);
			expect(merged.LH.bpm).toBe(104);
			expect(merged.LH.quality).toBe(5);
		});

		it("does not mutate the input map", () => {
			const existing: ByMode = { LH: { bpm: 104 } };
			mergeByMode(
				existing,
				[{ hands: "RH", drill: null, bpm: 90, quality: 3, effort: 3 }],
				saved,
			);
			expect(existing).toEqual({ LH: { bpm: 104 } });
		});
	});

	describe("deriveFromByMode", () => {
		it("returns the min bpm plus the newest mode's ratings", () => {
			const byMode: ByMode = {
				LH: { bpm: 111, quality: 4, effort: 2, lastPracticed: D("2026-01-01") },
				HT: { bpm: 72, quality: 2, effort: 5, lastPracticed: D("2026-01-03") },
			};
			expect(deriveFromByMode(byMode)).toEqual({
				bpm: 72,
				quality: 2,
				effort: 5,
				lastPracticed: D("2026-01-03"),
			});
		});

		it("returns all nulls for an empty map", () => {
			expect(deriveFromByMode({})).toEqual({
				bpm: null,
				quality: null,
				effort: null,
				lastPracticed: null,
			});
		});
	});

	describe("byModeFromFirestore", () => {
		it("converts Timestamps to Dates and fills missing fields with null", () => {
			const raw = {
				LH: {
					bpm: 111,
					quality: 4,
					lastPracticed: { toDate: () => D("2026-01-01T09:00:00Z") },
				},
			};
			expect(byModeFromFirestore(raw)).toEqual({
				LH: {
					bpm: 111,
					quality: 4,
					effort: null,
					lastPracticed: D("2026-01-01T09:00:00Z"),
				},
			});
		});

		it("returns an empty map for absent or non-object input", () => {
			expect(byModeFromFirestore(undefined)).toEqual({});
			expect(byModeFromFirestore(null)).toEqual({});
			expect(byModeFromFirestore("nope")).toEqual({});
		});
	});
});
