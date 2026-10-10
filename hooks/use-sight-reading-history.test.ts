import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { useSightReadingHistory } from "@/hooks/use-sight-reading-history";
import { fetchSightReadingPage } from "@/hooks/use-sight-reading-logs";

let mockUser: { uid: string } | null = { uid: "u" };
let mockFocus: () => undefined | (() => void);
let mockBlur: () => void;

jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: mockUser }),
}));
jest.mock("@/hooks/use-sight-reading-logs", () => ({
	fetchSightReadingPage: jest.fn(),
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

const entry = (id: string) => ({
	id,
	date: new Date(),
	elapsedSeconds: 540,
	achievedBpm: 72,
	keptGoing: 3 as const,
});
const cursor = { id: "cursor" } as QueryDocumentSnapshot;
const firstPage = {
	entries: Array.from({ length: 30 }, (_, index) => entry(`log-${index}`)),
	cursor,
	hasMore: true,
};
const lastPage = {
	entries: [entry("older")],
	cursor: { id: "older" } as QueryDocumentSnapshot,
	hasMore: false,
};

beforeEach(() => {
	jest.resetAllMocks();
	mockUser = { uid: "u" };
	jest.mocked(fetchSightReadingPage).mockResolvedValue(lastPage);
});

it("appends 30-log pages using their cursor and stops when exhausted", async () => {
	jest.mocked(fetchSightReadingPage).mockResolvedValueOnce(firstPage);
	const { result } = await renderHook(useSightReadingHistory);
	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.entries).toHaveLength(30);
	expect(result.current.hasMore).toBe(true);
	expect(fetchSightReadingPage).toHaveBeenNthCalledWith(1, "u", undefined);
	await act(() => result.current.loadMore());
	expect(fetchSightReadingPage).toHaveBeenNthCalledWith(2, "u", cursor);
	expect(result.current.entries).toEqual([
		...firstPage.entries,
		...lastPage.entries,
	]);
	expect(result.current.hasMore).toBe(false);
	await act(() => result.current.loadMore());
	expect(fetchSightReadingPage).toHaveBeenCalledTimes(2);
});

it("retries initial and later read failures without losing entries or cursor", async () => {
	const failure = new Error("Missing or insufficient permissions.");
	jest
		.mocked(fetchSightReadingPage)
		.mockRejectedValueOnce(failure)
		.mockResolvedValueOnce(firstPage)
		.mockRejectedValueOnce(failure);
	const { result } = await renderHook(useSightReadingHistory);
	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.error).toBe(failure);
	expect(result.current.entries).toEqual([]);
	await act(() => result.current.loadMore());
	expect(result.current.error).toBeNull();
	await act(() => result.current.loadMore());
	expect(result.current.error).toBe(failure);
	expect(result.current.entries).toEqual(firstPage.entries);
	await act(() => result.current.loadMore());
	expect(fetchSightReadingPage).toHaveBeenNthCalledWith(4, "u", cursor);
	expect(result.current.entries).toHaveLength(31);
	expect(result.current.error).toBeNull();
});

it("refreshes on focus and discards results from blurred requests", async () => {
	jest.mocked(fetchSightReadingPage).mockResolvedValueOnce(firstPage);
	const { result } = await renderHook(useSightReadingHistory);
	await waitFor(() => expect(result.current.loading).toBe(false));
	let resolve!: (page: typeof lastPage) => void;
	jest.mocked(fetchSightReadingPage).mockImplementationOnce(
		() =>
			new Promise((done) => {
				resolve = done;
			}),
	);
	let pending!: Promise<void>;
	await act(() => {
		pending = result.current.loadMore();
	});
	await act(() => result.current.loadMore());
	expect(fetchSightReadingPage).toHaveBeenCalledTimes(2);
	await act(() => {
		mockBlur();
		mockBlur = mockFocus() ?? (() => {});
	});
	await waitFor(() => expect(result.current.loading).toBe(false));
	await act(async () => {
		resolve({ ...lastPage, entries: [entry("stale")] });
		await pending;
	});
	expect(fetchSightReadingPage).toHaveBeenNthCalledWith(3, "u", undefined);
	expect(result.current.entries).toEqual(lastPage.entries);
});

it("does no reads signed out and discards another user's in-flight results", async () => {
	mockUser = null;
	const { result, rerender } = await renderHook(useSightReadingHistory);
	expect(result.current.loading).toBe(false);
	expect(fetchSightReadingPage).not.toHaveBeenCalled();
	let resolve!: (page: typeof lastPage) => void;
	jest.mocked(fetchSightReadingPage).mockImplementationOnce(
		() =>
			new Promise((done) => {
				resolve = done;
			}),
	);
	mockUser = { uid: "u" };
	await rerender(undefined);
	mockUser = { uid: "other" };
	await rerender(undefined);
	await waitFor(() => expect(result.current.loading).toBe(false));
	await act(() => {
		resolve({ ...lastPage, entries: [entry("stale")] });
	});
	expect(fetchSightReadingPage).toHaveBeenLastCalledWith("other", undefined);
	expect(result.current.entries).toEqual(lastPage.entries);
	mockUser = null;
	await rerender(undefined);
	expect(result.current.entries).toEqual([]);
});
