import { normalizeSightReadingLog } from "@/models/sight-reading";

describe("normalizeSightReadingLog", () => {
	const date = new Date("2026-09-11T07:30:00.000Z");

	it("reads Firestore timestamps and all stored fields", () => {
		expect(
			normalizeSightReadingLog({
				date: { toDate: () => date },
				elapsedSeconds: 180,
				achievedBpm: 60,
				keptGoing: 4,
			}),
		).toEqual({ date, elapsedSeconds: 180, achievedBpm: 60, keptGoing: 4 });
	});

	it("defaults missing optional fields to null and elapsed time to zero", () => {
		expect(normalizeSightReadingLog({ date: date.toISOString() })).toEqual({
			date,
			elapsedSeconds: 0,
			achievedBpm: null,
			keptGoing: null,
		});
	});

	it("preserves explicit nulls and zero elapsed time", () => {
		expect(
			normalizeSightReadingLog({
				date,
				elapsedSeconds: 0,
				achievedBpm: null,
				keptGoing: null,
			}),
		).toEqual({ date, elapsedSeconds: 0, achievedBpm: null, keptGoing: null });
	});
});
