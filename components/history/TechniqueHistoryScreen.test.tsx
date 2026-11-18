import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import TechniqueHistoryScreen from "@/app/(app)/technique/[id]/history";
import TechniqueDetailScreen from "@/app/(app)/technique/[id]/index";
import type { HistorySection } from "@/hooks/use-practice-history";
import type { TechniqueItem } from "@/models/technique";
import { lightTheme } from "@/theme";
import {
	groupHistoryLogs,
	type HistoryEntry,
	normalizeHistoryLog,
} from "@/utils/practice-history";
import type { ProgressionLog } from "@/utils/section-progression";

const mockPush = jest.fn();
const mockTechnique = {
	id: "technique",
	userId: "u1",
	title: "C major scale, 4 octaves",
	state: "active",
	type: "scale",
	dateIntroduced: new Date("2026-01-01"),
	handsMode: "together",
	targetTempoBpm: null,
	lastPracticedAt: null,
	notes: null,
} as TechniqueItem;
const mockCurriculumTechniques: TechniqueItem[] = [];
jest.mock("@/hooks/use-progress-series", () => ({
	useProgressSeries: () => ({ series: [], loading: false, error: null }),
}));
const mockBack = jest.fn();
const mockLoadMore = jest.fn();
const mockHistory = {
	entries: [] as HistoryEntry[],
	sections: [] as HistorySection[],
	loading: false,
	hasMore: false,
	error: null as Error | null,
	loadMore: mockLoadMore,
};
const mockReadHistory = jest.fn((_scope: unknown) => mockHistory);
const mockUpNavigation = jest.fn((_fallback: string) => mockBack);
const mockLastPracticeLogs: ProgressionLog[] = [];
let mockLoading = false;
let mockMissing = false;
let mockCurriculumLoading = false;
let mockLogsLoading = false;

jest.mock("expo-router", () => ({
	useLocalSearchParams: () => ({ id: "technique" }),
	useRouter: () => ({ push: mockPush }),
}));
jest.mock("react-native-paper", () => ({
	...jest.requireActual("react-native-paper"),
	ActivityIndicator: () => null,
}));
jest.mock("@/hooks/use-up-navigation", () => ({
	useUpNavigation: (fallback: string) => mockUpNavigation(fallback),
}));
jest.mock("@/hooks/use-page-inset", () => ({
	usePageInset: () => jest.requireActual("@/theme/tokens").inset.compact,
}));
jest.mock("@/hooks/use-techniques", () => ({
	useTechnique: () => ({
		technique: mockMissing ? undefined : mockTechnique,
		loading: mockLoading,
	}),
	useCurriculumTechniques: () => ({
		techniques: mockCurriculumTechniques,
		failed: false,
		loading: mockCurriculumLoading,
	}),
	useDeleteTechnique: () => ({ deleteTechnique: jest.fn() }),
	useAdvanceTechnique: () => ({ advance: jest.fn() }),
	useSnoozeTechniqueNudge: () => ({ snooze: jest.fn() }),
}));
jest.mock("@/hooks/use-last-practice-log", () => ({
	useLastPracticeLog: () => ({
		logs: mockLastPracticeLogs,
		loading: mockLogsLoading,
	}),
}));
jest.mock("@/hooks/use-practice-history", () => ({
	usePracticeHistory: (scope: unknown) => mockReadHistory(scope),
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockLoading = false;
	mockMissing = false;
	mockCurriculumLoading = false;
	mockLogsLoading = false;
	mockCurriculumTechniques.splice(0);
	mockLastPracticeLogs.splice(0);
	mockTechnique.dateIntroduced = new Date("2026-01-01");
	mockHistory.loading = false;
	mockHistory.hasMore = false;
	mockHistory.error = null;
	const date = new Date().toISOString();
	mockHistory.entries = groupHistoryLogs(
		{ type: "technique", techniqueId: "technique" },
		[
			{
				id: "lh",
				hands: "LH",
				drill: null,
				quality: 4,
				effort: 3,
				achievedBpm: 112,
			},
			{
				id: "rh",
				hands: "RH",
				drill: null,
				quality: 5,
				effort: 2,
				achievedBpm: 120,
			},
			{
				id: "staccato-lh",
				hands: "LH",
				drill: "staccato",
				quality: 3,
				effort: 4,
				achievedBpm: 96,
			},
			{
				id: "staccato-rh",
				hands: "RH",
				drill: "staccato",
				quality: 4,
				effort: 3,
				achievedBpm: 104,
			},
		].map(({ id, ...data }) =>
			normalizeHistoryLog({ id, data: { date, ...data } }, "technique"),
		),
	);
});

async function renderHistory() {
	return render(
		<PaperProvider theme={lightTheme}>
			<TechniqueHistoryScreen />
		</PaperProvider>,
	);
}

it("reads technique modes and drill groups without piece filters or section bars", async () => {
	const screen = await renderHistory();
	expect(mockReadHistory).toHaveBeenCalledWith({
		type: "technique",
		techniqueId: "technique",
	});
	expect(screen.getByText("History")).toBeTruthy();
	expect(screen.getByText("C major scale, 4 octaves")).toBeTruthy();
	expect(screen.getAllByText("Today")).toHaveLength(1);
	expect(screen.getByText("Staccato")).toBeTruthy();
	expect(screen.getAllByLabelText("Left hand")).toHaveLength(2);
	expect(screen.getAllByLabelText("Right hand")).toHaveLength(2);
	expect(screen.getByLabelText("Quality: Clean and secure")).toBeTruthy();
	expect(screen.getByLabelText("Quality: Shaky but OK")).toBeTruthy();
	expect(screen.getByLabelText("Effort: Demanding")).toBeTruthy();
	for (const bpm of ["112", "120", "96", "104"])
		expect(screen.getByText(bpm)).toBeTruthy();
	expect(screen.queryByLabelText("All")).toBeNull();
	expect(screen.queryByLabelText("Run-throughs")).toBeNull();
	expect(screen.queryByLabelText(/^Played sections:/)).toBeNull();
	expect(screen.queryByText("Technical")).toBeNull();
	expect(screen.queryByText("Memory")).toBeNull();
	await fireEvent.press(screen.getByLabelText("Back"));
	expect(mockBack).toHaveBeenCalledTimes(1);
	expect(mockUpNavigation).toHaveBeenCalledWith("/technique/technique");
});

it("explains empty technique history and opens its supported practice route", async () => {
	mockHistory.entries = [];
	const screen = await renderHistory();
	expect(screen.getByText("Nothing practiced yet")).toBeTruthy();
	expect(
		screen.getByText(
			"Every time you practice this technique it shows up here, newest first.",
		),
	).toBeTruthy();
	await fireEvent.press(screen.getByRole("button", { name: "Practice" }));
	expect(mockPush).toHaveBeenCalledWith(
		"/technique/technique/practice?from=technique-detail",
	);
});

it("loads older technique pages through the shared footer", async () => {
	mockHistory.hasMore = true;
	const screen = await renderHistory();
	await fireEvent.press(screen.getByRole("button", { name: "Show older" }));
	expect(mockLoadMore).toHaveBeenCalledTimes(1);
	expect(screen.getByText("Staccato")).toBeTruthy();
});

it("offers retry rather than a false empty history after a read error", async () => {
	mockHistory.entries = [];
	mockHistory.error = new Error("read failed");
	const screen = await renderHistory();
	expect(
		screen.getByText("Could not load practice history. Try again."),
	).toBeTruthy();
	expect(screen.queryByText("Nothing practiced yet")).toBeNull();
	await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
	expect(mockLoadMore).toHaveBeenCalledTimes(1);
});

it("waits for technique data rather than reporting a missing technique", async () => {
	mockLoading = true;
	const screen = await renderHistory();
	expect(screen.queryByText("Technique not found")).toBeNull();
	expect(screen.queryByText("Nothing practiced yet")).toBeNull();
});

it("handles missing techniques without offering practice", async () => {
	mockMissing = true;
	const screen = await renderHistory();
	expect(screen.getByText("Technique not found")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Practice" })).toBeNull();
});

it("opens technique history from the detail entry", async () => {
	const screen = await render(
		<PaperProvider theme={lightTheme}>
			<TechniqueDetailScreen />
		</PaperProvider>,
	);
	await fireEvent.press(screen.getByRole("link", { name: "Practice history" }));
	expect(mockPush).toHaveBeenCalledWith("/technique/technique/history");
});

it("holds detail until delayed curriculum queue snapshot arrives", async () => {
	mockCurriculumLoading = true;
	const now = new Date();
	mockTechnique.dateIntroduced = new Date(now.getTime() - 10 * 86_400_000);
	mockLastPracticeLogs.push(
		...[1, 2, 3].map((daysAgo) => {
			const date = new Date(now);
			date.setHours(12, 0, 0, 0);
			date.setDate(date.getDate() - daysAgo);
			return { date, quality: 4 as const };
		}),
	);
	mockCurriculumTechniques.push({
		...mockTechnique,
		id: "next",
		title: "G major scale",
		state: "not_started",
	});
	const view = () => (
		<PaperProvider theme={lightTheme}>
			<TechniqueDetailScreen />
		</PaperProvider>
	);
	const screen = await render(view());

	expect(screen.queryByText(mockTechnique.title)).toBeNull();
	expect(screen.queryByText("Start G major scale")).toBeNull();

	mockCurriculumLoading = false;
	await screen.rerender(view());

	expect(screen.getByText(mockTechnique.title)).toBeTruthy();
	expect(screen.getByText("Start G major scale")).toBeTruthy();
});

it("holds detail until delayed practice logs determine the curriculum nudge", async () => {
	mockLogsLoading = true;
	const now = new Date();
	mockTechnique.dateIntroduced = new Date(now.getTime() - 10 * 86_400_000);
	mockLastPracticeLogs.push(
		...[1, 2, 3].map((daysAgo) => {
			const date = new Date(now);
			date.setHours(12, 0, 0, 0);
			date.setDate(date.getDate() - daysAgo);
			return { date, quality: 4 as const };
		}),
	);
	mockCurriculumTechniques.push({
		...mockTechnique,
		id: "next",
		title: "G major scale",
		state: "not_started",
	});
	const view = () => (
		<PaperProvider theme={lightTheme}>
			<TechniqueDetailScreen />
		</PaperProvider>
	);
	const screen = await render(view());

	expect(screen.queryByText(mockTechnique.title)).toBeNull();
	expect(screen.queryByRole("button", { name: "Practice" })).toBeNull();

	mockLogsLoading = false;
	await screen.rerender(view());

	expect(screen.getByText(mockTechnique.title)).toBeTruthy();
	expect(screen.getByText("Start G major scale")).toBeTruthy();
});
