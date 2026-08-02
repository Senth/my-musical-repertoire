import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ActiveSession } from "@/models/session";
import { planPresetName } from "@/models/session";
import {
	DEFAULT_PIECE_LIST_PREFS,
	DEFAULT_TECHNIQUE_LIST_PREFS,
} from "./list-prefs";
import {
	clearActiveSession,
	readActiveSession,
	readPieceListPrefs,
	readPieceScores,
	readSightReadingBpm,
	readTechniqueListPrefs,
	writeActiveSession,
	writePieceListPrefs,
	writePieceScores,
	writeSightReadingBpm,
	writeTechniqueListPrefs,
} from "./session-storage";

jest.mock("@react-native-async-storage/async-storage", () => {
	const store = new Map<string, string>();
	return {
		__esModule: true,
		default: {
			getItem: jest.fn(async (k: string) => store.get(k) ?? null),
			setItem: jest.fn(async (k: string, v: string) => {
				store.set(k, v);
			}),
			removeItem: jest.fn(async (k: string) => {
				store.delete(k);
			}),
			__store: store,
		},
	};
});

const mocked = AsyncStorage as unknown as {
	__store: Map<string, string>;
	getItem: jest.Mock;
	setItem: jest.Mock;
	removeItem: jest.Mock;
};

describe("session-storage", () => {
	beforeEach(() => {
		mocked.__store.clear();
		mocked.getItem.mockClear();
		mocked.setItem.mockClear();
		mocked.removeItem.mockClear();
	});

	it("round trips active session and clears it", async () => {
		const session: ActiveSession = {
			plan: {
				presetId: "p1",
				presetName: "Weekday quick",
				totalMinutes: 30,
				blocks: [],
				generatedAt: "2026-05-27T00:00:00.000Z",
			},
			startedAt: "2026-05-27T00:00:00.000Z",
			sessionId: "test-session-id",
			currentBlockIndex: 0,
			blockStates: [],
			sessionElapsedSeconds: 0,
		};
		await writeActiveSession("u1", session);
		expect(await readActiveSession("u1")).toEqual(session);
		await clearActiveSession("u1");
		expect(await readActiveSession("u1")).toBeNull();
	});

	it("keeps a session stored before presets existed, with a fallback label", async () => {
		// Plans persisted by an older build carry `emphasis` and no `presetName`.
		// Someone mid-session during an update should not lose it.
		mocked.__store.set(
			"active-session:u1",
			JSON.stringify({
				plan: {
					emphasis: "balanced",
					totalMinutes: 30,
					blocks: [],
					generatedAt: "2026-05-27T00:00:00.000Z",
				},
				inputs: { emphasis: "balanced", totalMinutes: 30 },
				startedAt: "2026-05-27T00:00:00.000Z",
				sessionId: "legacy",
				currentBlockIndex: 0,
				blockStates: [],
				sessionElapsedSeconds: 0,
			}),
		);
		const restored = await readActiveSession("u1");
		if (!restored) throw new Error("legacy session was discarded");
		expect(restored.sessionId).toBe("legacy");
		expect(restored.plan.totalMinutes).toBe(30);
		expect(planPresetName(restored.plan, "Practice session")).toBe(
			"Practice session",
		);
	});

	it("returns null for malformed active session", async () => {
		mocked.__store.set("active-session:u1", "{broken");
		expect(await readActiveSession("u1")).toBeNull();
	});

	it("round trips sight-reading bpm per uid", async () => {
		expect(await readSightReadingBpm("u1")).toBeNull();
		await writeSightReadingBpm("u1", "72");
		expect(await readSightReadingBpm("u1")).toBe("72");
		expect(await readSightReadingBpm("u2")).toBeNull();
		await writeSightReadingBpm("u1", "120");
		expect(await readSightReadingBpm("u1")).toBe("120");
	});

	it("round trips cached piece scores per uid", async () => {
		expect(await readPieceScores("u1")).toBeNull();
		const cache = { scores: { p1: 42, p2: 0 }, computedAt: 1_700_000_000_000 };
		await writePieceScores("u1", cache);
		expect(await readPieceScores("u1")).toEqual(cache);
		expect(await readPieceScores("u2")).toBeNull();
	});

	it("discards a piece score cache that is malformed or non-numeric", async () => {
		mocked.__store.set("piece-scores:u1", "{broken");
		expect(await readPieceScores("u1")).toBeNull();

		mocked.__store.set(
			"piece-scores:u1",
			JSON.stringify({ scores: { p1: "high", p2: 3 }, computedAt: 5 }),
		);
		expect(await readPieceScores("u1")).toEqual({
			scores: { p2: 3 },
			computedAt: 5,
		});

		mocked.__store.set("piece-scores:u1", JSON.stringify({ scores: {} }));
		expect(await readPieceScores("u1")).toBeNull();
	});

	it("round trips list prefs per uid and per list", async () => {
		expect(await readPieceListPrefs("u1")).toBeNull();
		await writePieceListPrefs("u1", DEFAULT_PIECE_LIST_PREFS);
		expect(await readPieceListPrefs("u1")).toEqual(DEFAULT_PIECE_LIST_PREFS);
		// Separate key: the technique list is untouched by a pieces write.
		expect(await readTechniqueListPrefs("u1")).toBeNull();
		expect(await readPieceListPrefs("u2")).toBeNull();

		await writeTechniqueListPrefs("u1", DEFAULT_TECHNIQUE_LIST_PREFS);
		expect(await readTechniqueListPrefs("u1")).toEqual(
			DEFAULT_TECHNIQUE_LIST_PREFS,
		);
		expect(await readPieceListPrefs("u1")).toEqual(DEFAULT_PIECE_LIST_PREFS);
	});

	it("falls back to the defaults for unparseable list prefs", async () => {
		mocked.__store.set("pieces-list-prefs:u1", "{broken");
		expect(await readPieceListPrefs("u1")).toBeNull();
		mocked.__store.set("technique-list-prefs:u1", JSON.stringify({ v: 0 }));
		expect(await readTechniqueListPrefs("u1")).toBeNull();
	});
});
