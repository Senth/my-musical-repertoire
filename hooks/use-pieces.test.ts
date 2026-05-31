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
