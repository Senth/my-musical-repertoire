import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import TechniqueHistoryScreen from "@/app/(app)/technique/[id]/history";
import TechniqueDetailScreen from "@/app/(app)/technique/[id]/index";
import type { HistorySection } from "@/hooks/use-practice-history";
import { lightTheme } from "@/theme";
import {
	groupHistoryLogs,
	type HistoryEntry,
	normalizeHistoryLog,
} from "@/utils/practice-history";

const mockPush = jest.fn();
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
let mockLoading = false;
let mockMissing = false;

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
	useTechniques: () => ({
		techniques: mockMissing
			? []
			: [
					{
						id: "technique",
						title: "C major scale, 4 octaves",
						state: "active",
						type: "scale",
					},
				],
		loading: mockLoading,
	}),
	useDeleteTechnique: () => ({ deleteTechnique: jest.fn() }),
}));
jest.mock("@/hooks/use-practice-history", () => ({
	usePracticeHistory: (scope: unknown) => mockReadHistory(scope),
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockLoading = false;
	mockMissing = false;
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
	await fireEvent.press(screen.getByText("Practice history"));
	expect(mockPush).toHaveBeenCalledWith("/technique/technique/history");
});
