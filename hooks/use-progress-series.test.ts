import { act, renderHook, waitFor } from "@testing-library/react-native";
import { getDocs, onSnapshot, Timestamp } from "firebase/firestore";
import {
	type ProgressScope,
	useProgressSeries,
} from "@/hooks/use-progress-series";
import { PracticeMistakes } from "@/models/practice";
import {
	CHART_LOG_CAP,
	type ChartRange,
	rangeStart,
} from "@/utils/progress-chart";

let mockUser: { uid: string } | null = { uid: "u" };
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

const scopes: [ProgressScope, string][] = [
	[
		{ type: "section", pieceId: "p", sectionId: "s" },
		"users/u/pieces/p/sections/s/practiceLogs",
	],
	[{ type: "run-throughs", pieceId: "p" }, "users/u/pieces/p/practiceLogs"],
	[
		{ type: "technique", techniqueId: "t" },
		"users/u/techniques/t/practiceLogs",
	],
	[{ type: "sight-reading" }, "users/u/sightReadingLogs"],
];
const snapshot = (data: Record<string, unknown>[] = []) =>
	({
		docs: data.map((value, index) => ({
			id: String(index),
			data: () => value,
		})),
	}) as unknown as Awaited<ReturnType<typeof getDocs>>;
const log = (time: number, data: Record<string, unknown> = {}) => ({
	date: { toDate: () => new Date(time) },
	achievedBpm: 80,
	...data,
});

beforeEach(() => {
	jest.clearAllMocks();
	mockUser = { uid: "u" };
	jest.mocked(getDocs).mockResolvedValue(snapshot());
});

describe("useProgressSeries", () => {
	it.each(
		scopes.flatMap(([scope, path]) =>
			(["1m", "3m", "1y", "all"] as ChartRange[]).map((range) => ({
				scope,
				path,
				range,
			})),
		),
	)("reads exactly once with bounded constraints for $scope.type / $range", async ({
		scope,
		path,
		range,
	}) => {
		const before = rangeStart(range, new Date());
		const { result, rerender } = await renderHook(() =>
			useProgressSeries({ ...scope }, range),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(getDocs).toHaveBeenCalledTimes(1);
		expect(getDocs).toHaveBeenCalledWith({
			ref: path,
			constraints: [
				...(before
					? [
							{
								kind: "where",
								field: "date",
								operator: ">=",
								value: { timestamp: before },
							},
						]
					: []),
				{ kind: "orderBy", field: "date", direction: "desc" },
				{ kind: "limit", value: 500 },
			],
		});
		expect(Timestamp.fromDate).toHaveBeenCalledTimes(range === "all" ? 0 : 1);
		expect(onSnapshot).not.toHaveBeenCalled();
		await rerender(undefined);
		expect(getDocs).toHaveBeenCalledTimes(1);
		expect(result.current).toEqual({
			series: [],
			loading: false,
			error: null,
		});
	});

	it("normalizes hands, includes credits, excludes drills and missing tempos, and sorts oldest first", async () => {
		jest
			.mocked(getDocs)
			.mockResolvedValue(
				snapshot([
					log(300, { hands: "LH", quality: 2, source: "run-through" }),
					log(200, { hands: "RH", quality: 3 }),
					log(100, { hands: "LH", quality: 5 }),
					log(90, { hands: "HT", drill: "staccato" }),
					log(80, { achievedBpm: null }),
				]),
			);
		const { result } = await renderHook(() => useProgressSeries(scopes[0][0]));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.series).toEqual([
			{
				hands: "LH",
				points: [
					{ date: new Date(100), bpm: 80, accuracy: "clean" },
					{ date: new Date(300), bpm: 80, accuracy: "shaky" },
				],
			},
			{
				hands: "RH",
				points: [{ date: new Date(200), bpm: 80, accuracy: "slips" }],
			},
		]);
	});

	it.each([
		{
			scope: scopes[1][0],
			data: {
				technicalMistakes: PracticeMistakes.few,
				memoryMistakes: PracticeMistakes.many,
			},
			accuracy: "shaky",
		},
		{ scope: scopes[3][0], data: { keptGoing: 3 }, accuracy: "slips" },
	])("normalizes single-series $scope.type accuracy", async ({
		scope,
		data,
		accuracy,
	}) => {
		jest.mocked(getDocs).mockResolvedValue(snapshot([log(100, data)]));
		const { result } = await renderHook(() => useProgressSeries(scope));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.series).toEqual([
			{ hands: null, points: [{ date: new Date(100), bpm: 80, accuracy }] },
		]);
	});

	it("accepts a full cap without pagination or errors", async () => {
		jest
			.mocked(getDocs)
			.mockResolvedValue(
				snapshot(
					Array.from({ length: CHART_LOG_CAP }, (_, i) =>
						log(CHART_LOG_CAP - i),
					),
				),
			);
		const { result } = await renderHook(() =>
			useProgressSeries(scopes[2][0], "all"),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.series[0].points).toHaveLength(500);
		expect(result.current.series[0].points[0].date).toEqual(new Date(1));
		expect(result.current.error).toBeNull();
		expect(getDocs).toHaveBeenCalledTimes(1);
	});

	it("refetches once on range, section, and focus changes", async () => {
		const { result, rerender } = await renderHook(
			({ sectionId, range }: { sectionId: string; range: ChartRange }) =>
				useProgressSeries({ type: "section", pieceId: "p", sectionId }, range),
			{ initialProps: { sectionId: "s", range: "3m" } },
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		await rerender({ sectionId: "s", range: "1m" });
		await waitFor(() => expect(result.current.loading).toBe(false));
		await rerender({ sectionId: "other", range: "1m" });
		await waitFor(() => expect(result.current.loading).toBe(false));
		jest.mocked(getDocs).mockResolvedValueOnce(snapshot([log(100)]));
		await act(() => {
			mockBlur();
			mockBlur = mockFocus() ?? (() => {});
		});
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(getDocs).toHaveBeenCalledTimes(4);
		expect(result.current.series[0].points).toHaveLength(1);
	});

	it("does no signed-out reads and discards stale scope and user results", async () => {
		mockUser = null;
		const { result, rerender } = await renderHook(
			(techniqueId: string) =>
				useProgressSeries({ type: "technique", techniqueId }),
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
		jest.mocked(getDocs).mockResolvedValueOnce(snapshot([log(200)]));
		await rerender("other");
		await waitFor(() => expect(result.current.loading).toBe(false));
		await act(async () => {
			resolve(snapshot([log(100)]));
		});
		expect(result.current.series[0].points[0].date).toEqual(new Date(200));
		mockUser = null;
		await rerender("other");
		expect(result.current).toEqual({ series: [], loading: false, error: null });
	});

	it.each([
		"unavailable",
		"permission-denied",
	])("handles %s without treating offline cache misses as errors", async (code) => {
		const failure = Object.assign(new Error("Read failed"), { code });
		jest.mocked(getDocs).mockRejectedValueOnce(failure);
		const { result } = await renderHook(() => useProgressSeries(scopes[2][0]));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current).toEqual({
			series: [],
			loading: false,
			error: code === "unavailable" ? null : failure,
		});
	});
});
