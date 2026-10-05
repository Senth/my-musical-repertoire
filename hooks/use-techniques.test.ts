jest.mock("firebase/firestore", () => ({
	addDoc: jest.fn(),
	collection: jest.fn(),
	deleteDoc: jest.fn(),
	doc: jest.fn((_db, ...path: string[]) => path.join("/")),
	getDoc: jest.fn(),
	onSnapshot: jest.fn(),
	query: jest.fn(),
	Timestamp: {},
	updateDoc: jest.fn(() => Promise.resolve()),
	writeBatch: jest.fn(() => mockBatch),
}));

const mockBatch = {
	update: jest.fn(),
	commit: jest.fn(() => Promise.resolve()),
};
jest.mock("@/config/firebase", () => ({ db: {}, auth: {} }));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: { uid: "u1" } }),
}));

import { updateDoc } from "firebase/firestore";
import type { TechniqueState } from "@/models/technique";
import {
	fromFirestore,
	useAdvanceTechnique,
	useSnoozeTechniqueNudge,
	useUpdateTechnique,
} from "./use-techniques";

const written = () =>
	(updateDoc as jest.Mock).mock.calls.at(-1)?.[1] as Record<string, unknown>;

describe("useUpdateTechnique dateIntroduced", () => {
	const { updateTechnique } = useUpdateTechnique();

	it.each<TechniqueState>([
		"not_started",
		"maintenance",
	])("stamps dateIntroduced when %s becomes active", async (previous) => {
		await updateTechnique("t1", { state: "active" }, previous);
		expect(written().dateIntroduced).toBeInstanceOf(Date);
	});

	it("leaves dateIntroduced alone when the technique was already active", async () => {
		await updateTechnique("t1", { state: "active" }, "active");
		expect(written()).not.toHaveProperty("dateIntroduced");
	});

	it("leaves dateIntroduced alone when the state does not become active", async () => {
		await updateTechnique("t1", { state: "maintenance" }, "active");
		expect(written()).not.toHaveProperty("dateIntroduced");
	});
});

describe("fromFirestore nudgeSnoozedUntil", () => {
	const map = (nudgeSnoozedUntil?: unknown) =>
		fromFirestore(
			"t1",
			{
				title: "C major",
				state: "active",
				dateIntroduced: { toDate: () => new Date(0) },
				nudgeSnoozedUntil,
			} as unknown as Parameters<typeof fromFirestore>[1],
			"u1",
		).nudgeSnoozedUntil;

	it("maps a stored snooze to a Date", () => {
		const until = new Date("2026-06-01T00:00:00Z");
		expect(map({ toDate: () => until })).toBe(until);
	});

	it("reads a missing snooze as null", () => {
		expect(map()).toBeNull();
	});
});

describe("useAdvanceTechnique", () => {
	const { advance } = useAdvanceTechnique();

	beforeEach(() => jest.clearAllMocks());

	it("moves the secure technique to maintenance and starts the next in one batch", async () => {
		await advance("from", "to");
		expect(mockBatch.update).toHaveBeenCalledWith("users/u1/techniques/from", {
			state: "maintenance",
			nudgeSnoozedUntil: null,
		});
		expect(mockBatch.update).toHaveBeenCalledWith("users/u1/techniques/to", {
			state: "active",
			dateIntroduced: expect.any(Date),
		});
		expect(mockBatch.commit).toHaveBeenCalledTimes(1);
	});

	it("only retires the secure technique when there is no next one", async () => {
		await advance("from", null);
		expect(mockBatch.update).toHaveBeenCalledTimes(1);
		expect(mockBatch.commit).toHaveBeenCalledTimes(1);
	});
});

describe("useSnoozeTechniqueNudge", () => {
	it("writes nudgeSnoozedUntil the given number of days ahead", async () => {
		const { snooze } = useSnoozeTechniqueNudge();
		const before = Date.now();
		await snooze("t1", 14);
		const until = written().nudgeSnoozedUntil as Date;
		expect(until.getTime() - before).toBeGreaterThanOrEqual(14 * 86_400_000);
		expect(until.getTime() - before).toBeLessThan(14 * 86_400_000 + 1000);
	});
});
