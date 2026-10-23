import { act, renderHook, waitFor } from "@testing-library/react-native";
import { getDocs, getDocsFromCache, onSnapshot } from "firebase/firestore";
import { useProgressMoved } from "@/hooks/use-progress-moved";
import type { ChartRange } from "@/utils/progress-chart";
import { rangeStart } from "@/utils/progress-chart";
import {
	buildProgressRows,
	type ProgressRow,
	progressRowId,
} from "@/utils/repertoire-progress";
import { makePiece, makeSection, makeTechnique } from "@/utils/test-factories";

let mockUser: { uid: string } | null = { uid: "u" };
let mockFocus: () => () => void;
let mockBlur: () => void;
jest.mock("expo-router", () => ({
	useFocusEffect: (effect: () => () => void) => {
		const { useEffect } = jest.requireActual<typeof import("react")>("react");
		useEffect(() => {
			mockFocus = effect;
			mockBlur = effect();
			return () => mockBlur();
		}, [effect]);
	},
}));
jest.mock("firebase/firestore", () => ({
	collection: jest.fn((_db, ...path) => path.join("/")),
	getDocs: jest.fn(),
	getDocsFromCache: jest.fn(),
	limit: jest.fn((value) => ({ kind: "limit", value })),
	orderBy: jest.fn((field, direction) => ({
		kind: "orderBy",
		field,
		direction,
	})),
	query: jest.fn((ref, ...constraints) => ({ ref, constraints })),
	where: jest.fn((field, operator, value) => ({
		kind: "where",
		field,
		operator,
		value,
	})),
	Timestamp: { fromDate: jest.fn((date) => ({ timestamp: date })) },
	onSnapshot: jest.fn(),
}));
jest.mock("@/config/firebase", () => ({ db: {} }));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: mockUser }),
}));

const snapshot = (logs: Record<string, unknown>[] = []) =>
	({
		docs: logs.map((data, index) => ({
			id: String(index),
			data: () => ({ date: { toDate: () => new Date(index + 1) }, ...data }),
		})),
	}) as unknown as Awaited<ReturnType<typeof getDocs>>;
const rows = (count = 1): ProgressRow[] =>
	buildProgressRows({
		pieces: [makePiece({ id: "p", targetTempoBpm: 100 })],
		sectionsByPiece: {
			p: Array.from({ length: count }, (_, index) =>
				makeSection({
					id: `s${index}`,
					pieceId: "p",
					byMode: { LH: { bpm: 80 } },
				}),
			),
		},
		techniques: [],
	}).rows;
const technique = buildProgressRows({
	pieces: [],
	sectionsByPiece: {},
	techniques: [
		makeTechnique({
			id: "t",
			targetTempoBpm: 100,
			byMode: { HT: { bpm: 100 } },
		}),
	],
}).atTarget[0];

beforeEach(() => {
	jest.clearAllMocks();
	mockUser = { uid: "u" };
	jest.mocked(getDocsFromCache).mockRejectedValue(new Error("Cache miss"));
	jest.mocked(getDocs).mockResolvedValue(snapshot());
});

it.each(["1m", "3m", "1y", "all"] as ChartRange[])(
	"reads only rendered scopes once with a 50-log ascending cap for %s",
	async (range) => {
		const start = rangeStart(range, new Date());
		const visible = [...rows(), technique];
		jest
			.mocked(getDocs)
			.mockResolvedValue(
				snapshot([
					{ hands: "LH", achievedBpm: 10, drill: "staccato" },
					{ hands: "LH", achievedBpm: null },
					{ hands: "LH", achievedBpm: 60, source: "run-through" },
					{ hands: "LH", achievedBpm: 80 },
					{ hands: "RH", achievedBpm: Number.NaN },
					{ hands: "RH", achievedBpm: 64 },
					{ achievedBpm: 72 },
				]),
			);
		const { result, rerender } = await renderHook(() =>
			useProgressMoved(visible, range),
		);
		await waitFor(() =>
			expect(Object.keys(result.current.baselines)).toHaveLength(2),
		);
		expect(result.current.baselines[progressRowId(visible[0])]).toEqual({
			LH: 60,
			RH: 64,
			HT: 72,
		});
		for (const row of visible)
			expect(getDocs).toHaveBeenCalledWith({
				ref: `users/u/${progressRowId(row)}/practiceLogs`,
				constraints: [
					...(start
						? [
								{
									kind: "where",
									field: "date",
									operator: ">=",
									value: { timestamp: start },
								},
							]
						: []),
					{ kind: "orderBy", field: "date", direction: "asc" },
					{ kind: "limit", value: 50 },
				],
			});
		await rerender(undefined);
		expect(getDocs).toHaveBeenCalledTimes(2);
		expect(getDocsFromCache).toHaveBeenCalledTimes(2);
		expect(onSnapshot).not.toHaveBeenCalled();
	},
);

it("caches each range and scope until focus, fetching collapsed rows only on expand", async () => {
	const section = rows()[0];
	const { result, rerender } = await renderHook(
		({ visible, range }: { visible: ProgressRow[]; range: ChartRange }) =>
			useProgressMoved(visible, range),
		{ initialProps: { visible: [section], range: "3m" } },
	);
	await waitFor(() =>
		expect(Object.keys(result.current.baselines)).toHaveLength(1),
	);
	await rerender({
		visible: [{ ...section, hands: [{ hands: "LH", bpm: 84, fill: 0.8 }] }],
		range: "3m",
	});
	expect(getDocs).toHaveBeenCalledTimes(1);
	await rerender({ visible: [section], range: "1m" });
	await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(2));
	await waitFor(() =>
		expect(Object.keys(result.current.baselines)).toHaveLength(1),
	);
	await rerender({ visible: [section], range: "3m" });
	await waitFor(() =>
		expect(Object.keys(result.current.baselines)).toHaveLength(1),
	);
	expect(getDocs).toHaveBeenCalledTimes(2);
	await rerender({ visible: [section, technique], range: "3m" });
	await waitFor(() =>
		expect(Object.keys(result.current.baselines)).toHaveLength(2),
	);
	expect(getDocs).toHaveBeenCalledTimes(3);
	await rerender({ visible: [section], range: "3m" });
	await rerender({ visible: [section, technique], range: "3m" });
	await waitFor(() =>
		expect(Object.keys(result.current.baselines)).toHaveLength(2),
	);
	expect(getDocs).toHaveBeenCalledTimes(3);
	await act(() => mockBlur());
	await act(() => {
		mockBlur = mockFocus();
	});
	await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(5));
	expect(onSnapshot).not.toHaveBeenCalled();
});

it("publishes the offline cache before awaiting fresh logs", async () => {
	let resolve!: (value: Awaited<ReturnType<typeof getDocs>>) => void;
	jest
		.mocked(getDocsFromCache)
		.mockResolvedValueOnce(snapshot([{ hands: "LH", achievedBpm: 70 }]));
	jest.mocked(getDocs).mockImplementationOnce(
		() =>
			new Promise((done) => {
				resolve = done;
			}),
	);
	const { result } = await renderHook(() => useProgressMoved(rows(), "3m"));
	await waitFor(() =>
		expect(result.current.baselines["pieces/p/sections/s0"]).toEqual({
			LH: 70,
		}),
	);
	await act(async () => resolve(snapshot([{ hands: "LH", achievedBpm: 60 }])));
	expect(result.current.baselines["pieces/p/sections/s0"]).toEqual({ LH: 60 });
	expect(getDocs).toHaveBeenCalledTimes(1);
});

it("bounds sixty rendered-row reads to eight simultaneous requests", async () => {
	let running = 0;
	let maximum = 0;
	let completed = 0;
	const pending: (() => void)[] = [];
	jest.mocked(getDocs).mockImplementation(
		() =>
			new Promise((resolve) => {
				running++;
				maximum = Math.max(maximum, running);
				pending.push(() => {
					running--;
					completed++;
					resolve(snapshot());
				});
			}),
	);
	const { result } = await renderHook(() => useProgressMoved(rows(60), "3m"));
	await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(8));
	while (completed < 60) {
		await act(async () => {
			for (const resolve of pending.splice(0)) resolve();
		});
		await waitFor(() =>
			expect(getDocs).toHaveBeenCalledTimes(Math.min(completed + 8, 60)),
		);
	}
	await waitFor(() =>
		expect(Object.keys(result.current.baselines)).toHaveLength(60),
	);
	expect(maximum).toBe(8);
	expect(onSnapshot).not.toHaveBeenCalled();
});

it("cancels queued old-range reads and waits for in-flight reads before scheduling new rows", async () => {
	const pending: ((value: Awaited<ReturnType<typeof getDocs>>) => void)[] = [];
	jest.mocked(getDocs).mockImplementation(
		() =>
			new Promise((resolve) => {
				pending.push(resolve);
			}),
	);
	const { result, rerender } = await renderHook(
		({ visible, range }: { visible: ProgressRow[]; range: ChartRange }) =>
			useProgressMoved(visible, range),
		{ initialProps: { visible: rows(60), range: "3m" } },
	);
	await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(8));
	await rerender({ visible: rows(), range: "1m" });
	expect(result.current.baselines).toEqual({});
	expect(getDocs).toHaveBeenCalledTimes(8);
	await act(async () => {
		for (const resolve of pending.splice(0))
			resolve(snapshot([{ hands: "LH", achievedBpm: 40 }]));
	});
	await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(9));
	expect(result.current.baselines).toEqual({});
	await act(async () =>
		pending[0](snapshot([{ hands: "LH", achievedBpm: 72 }])),
	);
	expect(result.current.baselines).toEqual({
		"pieces/p/sections/s0": { LH: 72 },
	});
});

it("does no signed-out reads and never reuses another user's cache", async () => {
	mockUser = null;
	const { result, rerender } = await renderHook(() =>
		useProgressMoved(rows(), "3m"),
	);
	expect(getDocs).not.toHaveBeenCalled();
	jest
		.mocked(getDocs)
		.mockResolvedValueOnce(snapshot([{ hands: "LH", achievedBpm: 60 }]));
	mockUser = { uid: "u" };
	await rerender(undefined);
	await waitFor(() =>
		expect(result.current.baselines["pieces/p/sections/s0"]).toEqual({
			LH: 60,
		}),
	);
	mockUser = null;
	await rerender(undefined);
	expect(result.current.baselines).toEqual({});
	mockUser = { uid: "other" };
	await rerender(undefined);
	await waitFor(() =>
		expect(result.current.baselines["pieces/p/sections/s0"]).toEqual({}),
	);
	expect(getDocs).toHaveBeenCalledTimes(2);
	expect(jest.mocked(getDocs).mock.calls[1][0]).toMatchObject({
		ref: "users/other/pieces/p/sections/s0/practiceLogs",
	});
});

it.each(["unavailable", "permission-denied"])(
	"keeps cached baselines and reports only non-offline failures: %s",
	async (code) => {
		const failure = Object.assign(new Error("Read failed"), { code });
		jest
			.mocked(getDocsFromCache)
			.mockResolvedValue(snapshot([{ hands: "LH", achievedBpm: 70 }]));
		jest.mocked(getDocs).mockRejectedValueOnce(failure);
		const { result } = await renderHook(() => useProgressMoved(rows(), "3m"));
		await waitFor(() =>
			expect(result.current.baselines["pieces/p/sections/s0"]).toEqual({
				LH: 70,
			}),
		);
		await waitFor(() =>
			expect(result.current.error).toBe(
				code === "unavailable" ? null : failure,
			),
		);
	},
);
