jest.mock("firebase/firestore", () => ({
	collection: jest.fn(),
	getDocs: jest.fn(),
	limit: jest.fn(),
	orderBy: jest.fn(),
	query: jest.fn(),
}));
jest.mock("@/config/firebase", () => ({ db: {}, auth: {} }));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: null }),
}));

import { PracticeMistakes } from "@/models/practice";
import {
	groupLogsByMode,
	logModeKey,
	normalizeLastLog,
} from "./use-last-practice-log";

const makeTs = (isoDate: string) => ({ toDate: () => new Date(isoDate) });

describe("normalizeLastLog", () => {
	const ts = makeTs("2024-01-15T00:00:00.000Z");

	describe("piece scope", () => {
		it("normalizes all piece fields", () => {
			const log = normalizeLastLog(
				{
					date: ts,
					technicalMistakes: PracticeMistakes.few,
					memoryMistakes: PracticeMistakes.some,
					achievedBpm: 120,
				},
				"piece",
			);
			expect(log.date).toEqual(new Date("2024-01-15T00:00:00.000Z"));
			expect(log.technicalMistakes).toBe(PracticeMistakes.few);
			expect(log.memoryMistakes).toBe(PracticeMistakes.some);
			expect(log.achievedBpm).toBe(120);
		});

		it("maps missing piece fields to null", () => {
			const log = normalizeLastLog({ date: ts }, "piece");
			expect(log.technicalMistakes).toBeNull();
			expect(log.memoryMistakes).toBeNull();
			expect(log.achievedBpm).toBeNull();
		});

		it("returns the most-recent log's fields (limit(1) orderBy desc gives latest)", () => {
			const laterTs = makeTs("2024-06-01T00:00:00.000Z");
			const log = normalizeLastLog(
				{
					date: laterTs,
					technicalMistakes: PracticeMistakes.many,
					memoryMistakes: PracticeMistakes.none,
					achievedBpm: 90,
				},
				"piece",
			);
			expect(log.date).toEqual(new Date("2024-06-01T00:00:00.000Z"));
			expect(log.technicalMistakes).toBe(PracticeMistakes.many);
		});
	});

	describe("section scope", () => {
		it("normalizes section fields", () => {
			const log = normalizeLastLog(
				{ date: ts, quality: 4, effort: 3, achievedBpm: 80 },
				"section",
			);
			expect(log.quality).toBe(4);
			expect(log.effort).toBe(3);
			expect(log.achievedBpm).toBe(80);
		});

		it("maps missing section fields to null", () => {
			const log = normalizeLastLog({ date: ts }, "section");
			expect(log.quality).toBeNull();
			expect(log.effort).toBeNull();
			expect(log.achievedBpm).toBeNull();
		});
	});

	describe("technique scope", () => {
		it("normalizes technique fields", () => {
			const log = normalizeLastLog(
				{ date: ts, quality: 5, effort: 2, achievedBpm: 100 },
				"technique",
			);
			expect(log.quality).toBe(5);
			expect(log.effort).toBe(2);
			expect(log.achievedBpm).toBe(100);
		});

		it("maps missing technique fields to null", () => {
			const log = normalizeLastLog({ date: ts }, "technique");
			expect(log.quality).toBeNull();
			expect(log.effort).toBeNull();
			expect(log.achievedBpm).toBeNull();
		});

		it("reads the hands and drill tags", () => {
			const log = normalizeLastLog(
				{ date: ts, hands: "LH", drill: "staccato" },
				"technique",
			);
			expect(log.hands).toBe("LH");
			expect(log.drill).toBe("staccato");
		});
	});
});

describe("logModeKey", () => {
	const date = new Date("2024-01-15T00:00:00.000Z");

	it("builds the composite key from hands and drill", () => {
		expect(logModeKey({ date, hands: "LH", drill: "staccato" })).toBe(
			"LH.staccato",
		);
		expect(logModeKey({ date, hands: "RH", drill: null })).toBe("RH");
	});

	it("treats an untagged legacy log as hands together", () => {
		expect(logModeKey({ date })).toBe("HT");
	});
});

describe("groupLogsByMode", () => {
	const at = (iso: string) => new Date(iso);

	it("keeps the newest log per mode", () => {
		const logs = [
			{ date: at("2024-03-01"), hands: "LH" as const, achievedBpm: 111 },
			{ date: at("2024-02-01"), hands: "RH" as const, achievedBpm: 104 },
			{ date: at("2024-01-01"), hands: "LH" as const, achievedBpm: 90 },
		];
		const grouped = groupLogsByMode(logs);
		expect(grouped.LH.achievedBpm).toBe(111);
		expect(grouped.RH.achievedBpm).toBe(104);
	});

	it("separates a drill from its plain hands mode", () => {
		const logs = [
			{ date: at("2024-03-01"), hands: "LH" as const, drill: null },
			{
				date: at("2024-02-01"),
				hands: "LH" as const,
				drill: "staccato" as const,
			},
		];
		expect(Object.keys(groupLogsByMode(logs)).sort()).toEqual([
			"LH",
			"LH.staccato",
		]);
	});
});
