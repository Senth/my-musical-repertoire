jest.mock("firebase/firestore", () => ({
	addDoc: jest.fn().mockResolvedValue({ id: "sr1" }),
	collection: jest.fn((_db, ...path: string[]) => ({ path: path.join("/") })),
	getDocs: jest.fn(),
	limit: jest.fn((count: number) => ({ limit: count })),
	orderBy: jest.fn((field: string, direction: string) => ({
		field,
		direction,
	})),
	query: jest.fn((ref, ...constraints) => ({ ...ref, constraints })),
	startAfter: jest.fn((cursor) => ({ cursor })),
	Timestamp: { fromDate: jest.fn((date: Date) => ({ toDate: () => date })) },
}));
jest.mock("@/config/firebase", () => ({ db: {} }));
jest.mock("@/utils/firestore-write", () => ({
	awaitWrite: jest.fn().mockResolvedValue(undefined),
}));

import {
	addDoc,
	getDocs,
	type QueryDocumentSnapshot,
	Timestamp,
} from "firebase/firestore";
import {
	addSightReadingLog,
	fetchLastSightReading,
	fetchSightReadingPage,
} from "@/hooks/use-sight-reading-logs";
import { awaitWrite } from "@/utils/firestore-write";
import { PAGE_SIZE } from "@/utils/practice-history";

const date = new Date("2026-09-11T07:30:00.000Z");
const stored = (id: string) => ({
	id,
	data: () => ({ date: { toDate: () => date }, elapsedSeconds: 180 }),
});

beforeEach(() => {
	jest.clearAllMocks();
});

describe("addSightReadingLog", () => {
	it("stores a timestamp and nullable ratings through awaitWrite", async () => {
		await addSightReadingLog("u1", {
			date,
			elapsedSeconds: 180,
			achievedBpm: null,
			keptGoing: null,
		});
		expect(addDoc).toHaveBeenCalledWith(
			{ path: "users/u1/sightReadingLogs" },
			{
				date: expect.objectContaining({ toDate: expect.any(Function) }),
				elapsedSeconds: 180,
				achievedBpm: null,
				keptGoing: null,
			},
		);
		expect(Timestamp.fromDate).toHaveBeenCalledWith(date);
		expect(awaitWrite).toHaveBeenCalledWith(
			jest.mocked(addDoc).mock.results[0].value,
		);
	});

	it("does not wait for server acknowledgement outside awaitWrite", async () => {
		jest.mocked(addDoc).mockReturnValueOnce(new Promise(() => {}));
		await expect(
			addSightReadingLog("u1", {
				date,
				elapsedSeconds: 180,
				achievedBpm: 60,
				keptGoing: 5,
			}),
		).resolves.toBeUndefined();
	});

	it("propagates write failures", async () => {
		const error = new Error("permission-denied");
		jest.mocked(awaitWrite).mockRejectedValueOnce(error);
		await expect(
			addSightReadingLog("u1", {
				date,
				elapsedSeconds: 180,
				achievedBpm: null,
				keptGoing: null,
			}),
		).rejects.toBe(error);
	});
});

describe("fetchSightReadingPage", () => {
	it("bounds newest-first reads and normalizes a full page", async () => {
		const docs = Array.from({ length: PAGE_SIZE }, (_, i) => stored(`sr${i}`));
		jest.mocked(getDocs).mockResolvedValueOnce({ docs } as never);
		const page = await fetchSightReadingPage("u1");
		expect(getDocs).toHaveBeenCalledWith({
			path: "users/u1/sightReadingLogs",
			constraints: [{ field: "date", direction: "desc" }, { limit: PAGE_SIZE }],
		});
		expect(page.entries).toHaveLength(PAGE_SIZE);
		expect(page.entries[0]).toEqual({
			id: "sr0",
			date,
			elapsedSeconds: 180,
			achievedBpm: null,
			keptGoing: null,
		});
		expect(page.cursor).toBe(docs[PAGE_SIZE - 1]);
		expect(page.hasMore).toBe(true);
	});

	it("starts after the cursor and finishes on a short page", async () => {
		const cursor = stored("previous") as unknown as QueryDocumentSnapshot;
		const last = stored("last");
		jest.mocked(getDocs).mockResolvedValueOnce({ docs: [last] } as never);
		const page = await fetchSightReadingPage("u1", cursor);
		expect(getDocs).toHaveBeenCalledWith({
			path: "users/u1/sightReadingLogs",
			constraints: [
				{ field: "date", direction: "desc" },
				{ limit: PAGE_SIZE },
				{ cursor },
			],
		});
		expect(page.cursor).toBe(last);
		expect(page.hasMore).toBe(false);
	});

	it("returns an empty page for an empty collection", async () => {
		jest.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);
		await expect(fetchSightReadingPage("u1")).resolves.toEqual({
			entries: [],
			cursor: undefined,
			hasMore: false,
		});
	});
});

describe("fetchLastSightReading", () => {
	it("reads only the newest log", async () => {
		jest
			.mocked(getDocs)
			.mockResolvedValueOnce({ docs: [stored("sr1")] } as never);
		await expect(fetchLastSightReading("u1")).resolves.toEqual({
			id: "sr1",
			date,
			elapsedSeconds: 180,
			achievedBpm: null,
			keptGoing: null,
		});
		expect(getDocs).toHaveBeenCalledWith({
			path: "users/u1/sightReadingLogs",
			constraints: [{ field: "date", direction: "desc" }, { limit: 1 }],
		});
	});

	it("returns null when no log exists", async () => {
		jest.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);
		await expect(fetchLastSightReading("u1")).resolves.toBeNull();
	});

	it("propagates read failures", async () => {
		const error = new Error("permission-denied");
		jest.mocked(getDocs).mockRejectedValueOnce(error);
		await expect(fetchLastSightReading("u1")).rejects.toBe(error);
	});
});
