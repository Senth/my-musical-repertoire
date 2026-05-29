import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ActiveSession, SessionInputs } from "@/models/session";
import {
	clearActiveSession,
	readActiveSession,
	readSessionInputs,
	writeActiveSession,
	writeSessionInputs,
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

	it("round trips session inputs per emphasis", async () => {
		const inputs: SessionInputs = {
			emphasis: "balanced",
			totalMinutes: 30,
			techniqueEnabled: true,
			sightReadingEnabled: false,
		};
		await writeSessionInputs("u1", inputs);
		expect(await readSessionInputs("u1", "balanced")).toEqual(inputs);
		expect(await readSessionInputs("u1", "technique-heavy")).toBeNull();
		expect(await readSessionInputs("u2", "balanced")).toBeNull();
	});

	it("returns null for malformed inputs", async () => {
		mocked.__store.set("session-inputs:u1:balanced", "{not json");
		expect(await readSessionInputs("u1", "balanced")).toBeNull();
	});

	it("round trips active session and clears it", async () => {
		const session: ActiveSession = {
			plan: {
				emphasis: "balanced",
				totalMinutes: 30,
				blocks: [],
				generatedAt: "2026-05-27T00:00:00.000Z",
			},
			inputs: {
				emphasis: "balanced",
				totalMinutes: 30,
				techniqueEnabled: true,
				sightReadingEnabled: true,
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

	it("returns null for malformed active session", async () => {
		mocked.__store.set("active-session:u1", "{broken");
		expect(await readActiveSession("u1")).toBeNull();
	});
});
