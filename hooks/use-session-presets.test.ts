const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

jest.mock("firebase/firestore", () => ({
	addDoc: jest.fn(),
	collection: jest.fn((_db, ...path: string[]) => ({ path: path.join("/") })),
	deleteDoc: jest.fn(),
	doc: jest.fn((ref: { path: string }, id: string) => ({
		path: `${ref.path}/${id}`,
		id,
	})),
	onSnapshot: jest.fn(),
	query: jest.fn(),
	serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
	updateDoc: jest.fn(),
	writeBatch: jest.fn(() => ({
		set: mockBatchSet,
		update: mockBatchUpdate,
		commit: mockBatchCommit,
	})),
}));
jest.mock("@/config/firebase", () => ({ db: {}, auth: {} }));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: null }),
}));
jest.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

import type { SessionPreset } from "@/models/session-preset";
import {
	defaultPresetDocId,
	fromFirestore,
	linesFromFirestore,
	restoreDefaultPresets,
	seedDefaultPresets,
	sortPresets,
} from "./use-session-presets";

const NAMES: Record<string, string> = {
	balanced: "Balanced",
	"reading-focused": "Reading focused",
	"technique-focused": "Technique focused",
	"repertoire-focused": "Repertoire focused",
};
const nameFor = (key: string) => NAMES[key];

function preset(partial: Partial<SessionPreset>): SessionPreset {
	return {
		id: partial.id ?? "id",
		userId: "u1",
		name: partial.name ?? "",
		order: partial.order ?? 0,
		lines: partial.lines ?? {},
		scratch: partial.scratch,
	};
}

beforeEach(() => {
	mockBatchSet.mockClear();
	mockBatchUpdate.mockClear();
	mockBatchCommit.mockClear();
});

describe("linesFromFirestore", () => {
	it("keeps numeric lines and drops nulls", () => {
		expect(
			linesFromFirestore({ warmup: 3, sightReading: null, technique: 6 }),
		).toEqual({ warmup: 3, technique: 6 });
	});

	it("drops unknown keys", () => {
		expect(linesFromFirestore({ warmup: 3, bogus: 9 })).toEqual({ warmup: 3 });
	});

	it("survives a missing or malformed lines field", () => {
		expect(linesFromFirestore(undefined)).toEqual({});
		expect(linesFromFirestore("nope")).toEqual({});
	});
});

describe("fromFirestore", () => {
	it("defaults scratch to false and order to 0", () => {
		const p = fromFirestore("p1", { name: "A" }, "u1");
		expect(p).toEqual({
			id: "p1",
			userId: "u1",
			name: "A",
			order: 0,
			lines: {},
			scratch: false,
		});
	});

	it("carries scratch through", () => {
		expect(fromFirestore("custom", { scratch: true }, "u1").scratch).toBe(true);
	});
});

describe("sortPresets", () => {
	it("sorts by order, then name", () => {
		const sorted = sortPresets([
			preset({ id: "c", name: "Zed", order: 1 }),
			preset({ id: "a", name: "Beta", order: 0 }),
			preset({ id: "b", name: "Alpha", order: 0 }),
		]);
		expect(sorted.map((p) => p.id)).toEqual(["b", "a", "c"]);
	});
});

describe("seedDefaultPresets", () => {
	it("writes the four built-ins plus the scratch doc in one batch", async () => {
		await seedDefaultPresets("u1", nameFor);
		expect(mockBatchCommit).toHaveBeenCalledTimes(1);
		expect(mockBatchSet).toHaveBeenCalledTimes(5);
		const ids = mockBatchSet.mock.calls.map((c) => c[0].id);
		expect(ids).toEqual([
			"default-balanced",
			"default-reading-focused",
			"default-technique-focused",
			"default-repertoire-focused",
			"custom",
		]);
	});

	it("is idempotent — a second seed targets the same document ids", async () => {
		await seedDefaultPresets("u1", nameFor);
		const first = mockBatchSet.mock.calls.map((c) => c[0].path);
		mockBatchSet.mockClear();
		await seedDefaultPresets("u1", nameFor);
		expect(mockBatchSet.mock.calls.map((c) => c[0].path)).toEqual(first);
	});

	it("writes disabled lines as explicit nulls", async () => {
		await seedDefaultPresets("u1", nameFor);
		const balanced = mockBatchSet.mock.calls.find(
			(c) => c[0].id === defaultPresetDocId("balanced"),
		)?.[1];
		expect(balanced.lines).toEqual({
			warmup: null,
			sightReading: 5,
			technique: 6,
			repertoireLearning: 11,
			repertoireStabilizing: 5,
			repertoireMaintenance: 3,
		});
		expect(balanced.scratch).toBe(false);
	});
});

describe("restoreDefaultPresets", () => {
	const existingAll = Object.values(NAMES).map((name, i) =>
		preset({ id: `p${i}`, name, order: i }),
	);

	it("writes nothing when every built-in is present", async () => {
		const restored = await restoreDefaultPresets("u1", existingAll, nameFor);
		expect(restored).toBe(0);
		expect(mockBatchCommit).not.toHaveBeenCalled();
	});

	it("re-adds only the missing built-in, appended after existing presets", async () => {
		const existing = existingAll.filter((p) => p.name !== "Reading focused");
		const restored = await restoreDefaultPresets("u1", existing, nameFor);
		expect(restored).toBe(1);
		expect(mockBatchSet).toHaveBeenCalledTimes(1);
		expect(mockBatchSet.mock.calls[0][0].id).toBe("default-reading-focused");
		expect(mockBatchSet.mock.calls[0][1].order).toBe(4);
	});

	it("ignores the scratch doc's name when matching", async () => {
		const restored = await restoreDefaultPresets(
			"u1",
			[preset({ id: "custom", name: "Weekday quick", scratch: true })],
			nameFor,
		);
		expect(restored).toBe(4);
	});
});
