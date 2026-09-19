jest.mock("firebase/firestore", () => ({
	addDoc: jest.fn(),
	collection: jest.fn(),
	deleteDoc: jest.fn(),
	doc: jest.fn(),
	getDocs: jest.fn(),
	onSnapshot: jest.fn(),
	query: jest.fn(),
	updateDoc: jest.fn(),
}));
jest.mock("@/config/firebase", () => ({ db: {}, auth: {} }));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: null }),
}));

import { fromFirestore } from "./use-pieces";

describe("fromFirestore durationSeconds mapping", () => {
	it("maps a present durationSeconds through", () => {
		const piece = fromFirestore(
			"id1",
			{ title: "A", composer: "C", durationSeconds: 240 },
			"user1",
		);
		expect(piece.durationSeconds).toBe(240);
	});

	it("maps an explicit null durationSeconds to null", () => {
		const piece = fromFirestore(
			"id1",
			{ title: "A", composer: "C", durationSeconds: null },
			"user1",
		);
		expect(piece.durationSeconds).toBeNull();
	});

	it("defaults a missing durationSeconds to null", () => {
		const piece = fromFirestore("id1", { title: "A", composer: "C" }, "user1");
		expect(piece.durationSeconds).toBeNull();
	});
});

describe("fromFirestore collectionName mapping", () => {
	it("maps a present collectionName through", () => {
		const piece = fromFirestore(
			"id1",
			{ title: "A", composer: "C", collectionName: "Final Fantasy VII" },
			"user1",
		);
		expect(piece.collectionName).toBe("Final Fantasy VII");
	});

	it("maps an explicit null collectionName to null", () => {
		const piece = fromFirestore(
			"id1",
			{ title: "A", composer: "C", collectionName: null },
			"user1",
		);
		expect(piece.collectionName).toBeNull();
	});

	it("defaults a missing collectionName to null", () => {
		const piece = fromFirestore("id1", { title: "A", composer: "C" }, "user1");
		expect(piece.collectionName).toBeNull();
	});
});

describe("fromFirestore timeSignature mapping", () => {
	it("maps a stored signature through", () => {
		const piece = fromFirestore(
			"id1",
			{
				title: "A",
				composer: "C",
				timeSignature: { beats: 7, noteValue: 8 },
			},
			"user1",
		);
		expect(piece.timeSignature).toEqual({ beats: 7, noteValue: 8 });
	});

	it("reads a malformed signature as null instead of poisoning the metronome", () => {
		const piece = fromFirestore(
			"id1",
			{ title: "A", composer: "C", timeSignature: "7/8" },
			"user1",
		);
		expect(piece.timeSignature).toBeNull();
	});

	it("defaults a missing signature to null", () => {
		const piece = fromFirestore("id1", { title: "A", composer: "C" }, "user1");
		expect(piece.timeSignature).toBeNull();
	});
});

describe("fromFirestore span cadence mapping", () => {
	const stamp = new Date("2026-09-01T10:00:00Z");
	const asTimestamp = { toDate: () => stamp } as unknown as Parameters<
		typeof fromFirestore
	>[1]["lastSpanPracticedAt"];

	it("maps a stored span stamp and counter through", () => {
		const piece = fromFirestore(
			"id1",
			{
				title: "A",
				composer: "C",
				lastSpanPracticedAt: asTimestamp,
				practiceDaysSinceSpan: 3,
			},
			"user1",
		);
		expect(piece.lastSpanPracticedAt).toEqual(stamp);
		expect(piece.practiceDaysSinceSpan).toBe(3);
	});

	it("defaults a piece that has never spanned", () => {
		const piece = fromFirestore("id1", { title: "A", composer: "C" }, "user1");
		expect(piece.lastSpanPracticedAt).toBeNull();
		expect(piece.practiceDaysSinceSpan).toBe(0);
	});
});
