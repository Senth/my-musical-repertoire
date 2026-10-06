import { act, renderHook, waitFor } from "@testing-library/react-native";
import { getDocs, onSnapshot, startAfter } from "firebase/firestore";
import { usePracticeHistory } from "@/hooks/use-practice-history";
import { useSections } from "@/hooks/use-sections";
import type { Section } from "@/models/section";

let mockUser: { uid: string } | null = { uid: "u" };
let mockSections: Section[] = [];
let mockSectionsLoading = false;
let mockFocus: () => undefined | (() => void);
let mockBlur: () => void;

jest.mock("firebase/firestore", () => ({
	collection: jest.fn((_db, ...path) => path.join("/")),
	getDocs: jest.fn(),
	limit: jest.fn((value) => ({ kind: "limit", value })),
	orderBy: jest.fn((field, direction) => ({
		kind: "orderBy",
		field,
		direction,
	})),
	query: jest.fn((ref, ...constraints) => ({ ref, constraints })),
	startAfter: jest.fn((value) => ({ kind: "startAfter", value })),
	where: jest.fn((field, operator, value) => ({
		kind: "where",
		field,
		operator,
		value,
	})),
	onSnapshot: jest.fn(),
}));
jest.mock("@/config/firebase", () => ({ db: {} }));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: mockUser }),
}));
jest.mock("@/hooks/use-sections", () => ({
	useSections: jest.fn(() => ({
		sections: mockSections,
		loading: mockSectionsLoading,
	})),
}));
jest.mock("expo-router", () => ({
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const { useEffect } = jest.requireActual<typeof import("react")>("react");
		useEffect(() => {
			mockFocus = effect;
			mockBlur = effect() ?? (() => {});
			return () => mockBlur();
		}, [effect]);
	},
}));

type LogDoc = { id: string; data: () => Record<string, unknown> };
type MockQuery = {
	ref: string;
	constraints: {
		kind: string;
		value?: unknown;
		field?: string;
		direction?: string;
	}[];
};
const pages = new Map<string, LogDoc[][]>();
const piecePath = "users/u/pieces/p/practiceLogs";
const archivePath = "users/u/pieces/p/sections";
const techniquePath = "users/u/techniques/t/practiceLogs";
const sectionPath = (id: string) =>
	`users/u/pieces/p/sections/${id}/practiceLogs`;
const snapshot = (docs: LogDoc[]) =>
	({ docs }) as unknown as Awaited<ReturnType<typeof getDocs>>;
const log = (
	id: string,
	time: number,
	data: Record<string, unknown> = {},
): LogDoc => ({
	id,
	data: () => ({ date: { toDate: () => new Date(time) }, ...data }),
});
const logs = (prefix: string, newest: number, count = 30) =>
	Array.from({ length: count }, (_, index) =>
		log(`${prefix}-${index}`, newest - index),
	);
const queries = () =>
	jest
		.mocked(getDocs)
		.mock.calls.map(([value]) => value as unknown as MockQuery);
const liveSection = (id: string, order = 0): Section => ({
	id,
	pieceId: "p",
	userId: "u",
	label: id,
	order,
	state: "learning",
	archived: false,
});

beforeEach(() => {
	jest.clearAllMocks();
	pages.clear();
	mockUser = { uid: "u" };
	mockSections = [];
	mockSectionsLoading = false;
	jest
		.mocked(getDocs)
		.mockImplementation(async (value) =>
			snapshot(pages.get((value as unknown as MockQuery).ref)?.shift() ?? []),
		);
});

describe("usePracticeHistory", () => {
	it("uses one bounded descending stream for a technique and never subscribes", async () => {
		pages.set(techniquePath, [
			[log("new", 100, { hands: "LH" }), log("old", 90)],
		]);
		const { result } = await renderHook(() =>
			usePracticeHistory({ type: "technique", techniqueId: "t" }),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(queries()).toEqual([
			{
				ref: techniquePath,
				constraints: [
					{ kind: "orderBy", field: "date", direction: "desc" },
					{ kind: "limit", value: 30 },
				],
			},
		]);
		expect(result.current.entries.map((entry) => entry.date.getTime())).toEqual(
			[100, 90],
		);
		expect(result.current.sections).toEqual([]);
		expect(result.current.hasMore).toBe(false);
		expect(result.current.error).toBeNull();
		expect(useSections).toHaveBeenCalledWith("");
		expect(onSnapshot).not.toHaveBeenCalled();
		await act(() => result.current.loadMore());
		expect(getDocs).toHaveBeenCalledTimes(1);
	});

	it("waits for live sections, fetches archives once, and merges all piece streams", async () => {
		mockSectionsLoading = true;
		mockSections = [liveSection("live")];
		pages.set(archivePath, [
			[
				{
					id: "archived",
					data: () => ({
						label: "Old passage",
						order: 2,
						archived: true,
						startBar: 10,
						endBar: 20,
					}),
				},
			],
		]);
		pages.set(piecePath, [[log("run", 100)]]);
		pages.set(sectionPath("live"), [[log("practice", 90)]]);
		pages.set(sectionPath("archived"), [[log("old", 80)]]);
		const { result, rerender } = await renderHook(() =>
			usePracticeHistory({ type: "piece", pieceId: "p" }),
		);
		expect(getDocs).not.toHaveBeenCalled();
		mockSectionsLoading = false;
		await rerender(undefined);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(queries().map((value) => value.ref)).toEqual([
			archivePath,
			piecePath,
			sectionPath("live"),
			sectionPath("archived"),
		]);
		for (const value of queries().filter((value) =>
			value.ref.endsWith("practiceLogs"),
		)) {
			expect(value.constraints).toEqual([
				{ kind: "orderBy", field: "date", direction: "desc" },
				{ kind: "limit", value: 30 },
			]);
		}
		expect(queries()[0].constraints).toContainEqual({
			kind: "where",
			field: "archived",
			operator: "==",
			value: true,
		});
		expect(result.current.sections).toMatchObject([
			{ id: "live", archived: false },
			{
				id: "archived",
				label: "Old passage",
				archived: true,
				startBar: 10,
				endBar: 20,
			},
		]);
		expect(result.current.entries.map((entry) => entry.date.getTime())).toEqual(
			[100, 90, 80],
		);
		await act(() => result.current.loadMore());
		await rerender(undefined);
		expect(queries().filter((value) => value.ref === archivePath)).toHaveLength(
			1,
		);
	});

	it("uses each stream's last fetched document as cursor and never refetches archives on loadMore", async () => {
		mockSections = [liveSection("s")];
		const pieceDocs = logs("piece", 200);
		const sectionDocs = logs("section", 199.5);
		pages.set(piecePath, [pieceDocs, [log("piece-last", 160)]]);
		pages.set(sectionPath("s"), [sectionDocs, [log("section-last", 159)]]);
		const { result } = await renderHook(() =>
			usePracticeHistory({ type: "piece", pieceId: "p" }),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		for (let index = 0; index < 4 && result.current.hasMore; index++)
			await act(() => result.current.loadMore());
		expect(result.current.entries).toHaveLength(62);
		expect(result.current.hasMore).toBe(false);
		expect(startAfter).toHaveBeenCalledWith(pieceDocs[29]);
		expect(startAfter).toHaveBeenCalledWith(sectionDocs[29]);
		expect(queries().filter((value) => value.ref === archivePath)).toHaveLength(
			1,
		);
		expect(result.current.entries.map((entry) => entry.date.getTime())).toEqual(
			[
				...pieceDocs,
				...sectionDocs,
				log("piece-last", 160),
				log("section-last", 159),
			]
				.map((doc) =>
					(doc.data().date as { toDate: () => Date }).toDate().getTime(),
				)
				.sort((a, b) => b - a),
		);
	});

	it("refills a held save without splitting hands across displayed pages", async () => {
		const first = [...logs("new", 100, 29), log("lh", 50, { hands: "LH" })];
		pages.set(techniquePath, [
			first,
			[log("rh", 50, { hands: "RH" }), log("ht", 50)],
		]);
		const { result } = await renderHook(() =>
			usePracticeHistory({ type: "technique", techniqueId: "t" }),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.entries).toHaveLength(29);
		await act(() => result.current.loadMore());
		expect(result.current.entries).toHaveLength(30);
		expect(result.current.entries[29].modes.map((mode) => mode.hands)).toEqual([
			"LH",
			"RH",
			"HT",
		]);
		expect(startAfter).toHaveBeenCalledWith(first[29]);
	});

	it("automatically refills when a full fetch contains only one incomplete save", async () => {
		const first = Array.from({ length: 30 }, (_, i) => log(`mode-${i}`, 100));
		pages.set(techniquePath, [first, [log("final-mode", 100)]]);
		const { result } = await renderHook(() =>
			usePracticeHistory({ type: "technique", techniqueId: "t" }),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.entries).toHaveLength(1);
		expect(result.current.entries[0].modes).toHaveLength(31);
		expect(result.current.hasMore).toBe(false);
		expect(getDocs).toHaveBeenCalledTimes(2);
	});

	it("bounds archived metadata reads and advances their own cursor", async () => {
		const archived = Array.from({ length: 30 }, (_, index) => ({
			id: `a-${index}`,
			data: () => ({ label: `Archive ${index}`, order: index, archived: true }),
		}));
		pages.set(archivePath, [
			archived,
			[
				{
					id: "last",
					data: () => ({ label: "Last archive", order: 30, archived: true }),
				},
			],
		]);
		const { result } = await renderHook(() =>
			usePracticeHistory({ type: "piece", pieceId: "p" }),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.sections).toHaveLength(31);
		expect(startAfter).toHaveBeenCalledWith(archived[29]);
		for (const value of queries().filter((value) => value.ref === archivePath))
			expect(value.constraints).toContainEqual({ kind: "limit", value: 30 });
		expect(
			queries().filter((value) => value.ref.endsWith("practiceLogs")),
		).toHaveLength(32);
	});

	it("refetches first pages on focus, replacing old entries and resetting cursors", async () => {
		pages.set(techniquePath, [
			logs("initial", 100),
			[log("older", 50)],
			[log("new-save", 200)],
		]);
		const { result } = await renderHook(() =>
			usePracticeHistory({ type: "technique", techniqueId: "t" }),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		await act(() => result.current.loadMore());
		await act(() => {
			mockBlur();
			mockBlur = mockFocus() ?? (() => {});
		});
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.entries.map((entry) => entry.date.getTime())).toEqual(
			[200],
		);
		expect(
			queries()[2].constraints.some((value) => value.kind === "startAfter"),
		).toBe(false);
	});

	it("exposes read errors and lets loadMore retry without losing displayed entries", async () => {
		pages.set(techniquePath, [logs("initial", 100), [log("older", 50)]]);
		const { result } = await renderHook(() =>
			usePracticeHistory({ type: "technique", techniqueId: "t" }),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		const failure = new Error("Missing or insufficient permissions.");
		jest.mocked(getDocs).mockRejectedValueOnce(failure);
		await act(() => result.current.loadMore());
		expect(result.current.error).toBe(failure);
		expect(result.current.entries).toHaveLength(29);
		expect(result.current.loading).toBe(false);
		await act(() => result.current.loadMore());
		expect(result.current.entries).toHaveLength(31);
		expect(result.current.error).toBeNull();
	});

	it("exposes initial archive errors and retries full initialization", async () => {
		jest
			.mocked(getDocs)
			.mockRejectedValueOnce(new Error("Archive read failed"));
		const { result } = await renderHook(() =>
			usePracticeHistory({ type: "piece", pieceId: "p" }),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error?.message).toBe("Archive read failed");
		await act(() => result.current.loadMore());
		expect(result.current.error).toBeNull();
		expect(queries().filter((value) => value.ref === archivePath)).toHaveLength(
			2,
		);
	});

	it("does no reads signed out and discards in-flight results when scope changes", async () => {
		mockUser = null;
		const { result, rerender } = await renderHook(
			(techniqueId: string) =>
				usePracticeHistory({ type: "technique", techniqueId }),
			{ initialProps: "t" },
		);
		expect(result.current.loading).toBe(false);
		expect(getDocs).not.toHaveBeenCalled();
		mockUser = { uid: "u" };
		let resolve!: (value: Awaited<ReturnType<typeof getDocs>>) => void;
		jest.mocked(getDocs).mockImplementationOnce(
			() =>
				new Promise((done) => {
					resolve = done;
				}),
		);
		await rerender("t");
		pages.set("users/u/techniques/other/practiceLogs", [[log("other", 200)]]);
		await rerender("other");
		await waitFor(() => expect(result.current.loading).toBe(false));
		await act(async () => {
			resolve(snapshot([log("stale", 100)]));
		});
		expect(result.current.entries.map((entry) => entry.date.getTime())).toEqual(
			[200],
		);
		mockUser = null;
		await rerender("other");
		expect(result.current.entries).toEqual([]);
		expect(result.current.sections).toEqual([]);
	});
});
