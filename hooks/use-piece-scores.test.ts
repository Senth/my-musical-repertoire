jest.mock("@/config/firebase", () => ({ db: {}, auth: {} }));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: null }),
}));
jest.mock("firebase/firestore", () => ({
	collection: jest.fn(),
	doc: jest.fn(),
	getDocs: jest.fn(),
	increment: jest.fn(),
	onSnapshot: jest.fn(),
	orderBy: jest.fn(),
	query: jest.fn(),
	serverTimestamp: jest.fn(),
	updateDoc: jest.fn(),
	where: jest.fn(),
	writeBatch: jest.fn(),
	addDoc: jest.fn(),
	deleteDoc: jest.fn(),
}));

import { makePiece } from "@/utils/test-factories";
import {
	PIECE_SCORE_MAX_AGE_MS,
	shouldRecomputeScores,
} from "./use-piece-scores";

const NOW = new Date("2026-06-01T12:00:00Z").getTime();

describe("shouldRecomputeScores", () => {
	const cache = { scores: { p1: 12 }, computedAt: NOW - 60_000 };
	const pieces = [makePiece({ id: "p1" })];

	it("recomputes when there is nothing cached", () => {
		expect(shouldRecomputeScores(null, pieces, 0, NOW)).toBe(true);
	});

	it("keeps the cache when nothing has been practised since", () => {
		expect(
			shouldRecomputeScores(cache, pieces, cache.computedAt - 1, NOW),
		).toBe(false);
	});

	it("recomputes after a practice newer than the cache", () => {
		expect(
			shouldRecomputeScores(cache, pieces, cache.computedAt + 1, NOW),
		).toBe(true);
	});

	it("recomputes once the cache passes its max age", () => {
		const old = {
			scores: { p1: 12 },
			computedAt: NOW - PIECE_SCORE_MAX_AGE_MS - 1,
		};
		expect(shouldRecomputeScores(old, pieces, 0, NOW)).toBe(true);

		const justFresh = {
			scores: { p1: 12 },
			computedAt: NOW - PIECE_SCORE_MAX_AGE_MS + 1,
		};
		expect(shouldRecomputeScores(justFresh, pieces, 0, NOW)).toBe(false);
	});

	it("recomputes for a piece added since the last computation", () => {
		const withNewPiece = [...pieces, makePiece({ id: "p2" })];
		expect(shouldRecomputeScores(cache, withNewPiece, 0, NOW)).toBe(true);
	});

	it("does not recompute for a legitimately zero score", () => {
		const zeroed = { scores: { p1: 0 }, computedAt: NOW - 60_000 };
		expect(shouldRecomputeScores(zeroed, pieces, 0, NOW)).toBe(false);
	});
});
