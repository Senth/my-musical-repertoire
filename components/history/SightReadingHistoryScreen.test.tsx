import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import SightReadingHistoryScreen from "@/app/(app)/sight-reading/history";
import type { SightReadingLog } from "@/models/sight-reading";
import { darkTheme, lightTheme } from "@/theme";

const mockBack = jest.fn();
const mockLoadMore = jest.fn();
const mockUpNavigation = jest.fn((_fallback: string) => mockBack);
const mockHistory = {
	entries: [] as (SightReadingLog & { id: string })[],
	loading: false,
	hasMore: false,
	error: null as Error | null,
	loadMore: mockLoadMore,
};

jest.mock("@/hooks/use-sight-reading-history", () => ({
	useSightReadingHistory: () => mockHistory,
}));
jest.mock("@/hooks/use-up-navigation", () => ({
	useUpNavigation: (fallback: string) => mockUpNavigation(fallback),
}));
jest.mock("@/hooks/use-page-inset", () => ({
	usePageInset: () => jest.requireActual("@/theme/tokens").inset.compact,
}));
jest.mock("react-native-paper", () => ({
	...jest.requireActual("react-native-paper"),
	ActivityIndicator: () => null,
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockHistory.loading = false;
	mockHistory.hasMore = false;
	mockHistory.error = null;
	mockHistory.entries = [
		{
			id: "rated",
			date: new Date(),
			elapsedSeconds: 540,
			achievedBpm: 72,
			keptGoing: 3,
		},
		{
			id: "unrated",
			date: new Date(),
			elapsedSeconds: 281,
			achievedBpm: null,
			keptGoing: null,
		},
	];
});

it.each([
	lightTheme,
	darkTheme,
])("shows day, minutes, full rating and optional tempo without a legend", async (theme) => {
	const screen = await render(
		<PaperProvider theme={theme}>
			<SightReadingHistoryScreen />
		</PaperProvider>,
	);
	expect(screen.getByText("History")).toBeTruthy();
	expect(screen.getByText("Sight-reading")).toBeTruthy();
	expect(screen.getAllByText("Today")).toHaveLength(1);
	expect(screen.getByText("9 min")).toBeTruthy();
	expect(screen.getByText("~5 min")).toBeTruthy();
	expect(screen.getByText("A few stops")).toBeTruthy();
	expect(screen.getByText("Not rated")).toBeTruthy();
	expect(screen.getByText("72")).toBeTruthy();
	expect(screen.getAllByText("BPM")).toHaveLength(1);
	expect(screen.queryByText("Quality")).toBeNull();
	expect(screen.queryByText("Effort")).toBeNull();
	expect(screen.queryByText("Kept going")).toBeNull();
	expect(screen.queryByRole("button", { name: "Practice" })).toBeNull();
	await fireEvent.press(screen.getByLabelText("Back"));
	expect(mockBack).toHaveBeenCalledTimes(1);
	expect(mockUpNavigation).toHaveBeenCalledWith("/technique");
});

it("explains empty history without a Practice action", async () => {
	mockHistory.entries = [];
	const screen = await render(
		<PaperProvider>
			<SightReadingHistoryScreen />
		</PaperProvider>,
	);
	expect(screen.getByText("Nothing practiced yet")).toBeTruthy();
	expect(
		screen.getByText(
			"Every sight-reading block you finish in a session shows up here, newest first.",
		),
	).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Practice" })).toBeNull();
	expect(screen.queryByRole("button", { name: "Show older" })).toBeNull();
});

it("loads older pages through the shared footer", async () => {
	mockHistory.hasMore = true;
	const screen = await render(
		<PaperProvider>
			<SightReadingHistoryScreen />
		</PaperProvider>,
	);
	await fireEvent.press(screen.getByRole("button", { name: "Show older" }));
	expect(mockLoadMore).toHaveBeenCalledTimes(1);
});

it.each([
	true,
	false,
])("offers retry after a read failure, retaining any loaded rows", async (empty) => {
	if (empty) mockHistory.entries = [];
	mockHistory.error = new Error("read failed");
	const screen = await render(
		<PaperProvider>
			<SightReadingHistoryScreen />
		</PaperProvider>,
	);
	expect(
		screen.getByText("Could not load practice history. Try again."),
	).toBeTruthy();
	expect(screen.queryByText("Nothing practiced yet")).toBeNull();
	if (!empty) expect(screen.getByText("9 min")).toBeTruthy();
	await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
	expect(mockLoadMore).toHaveBeenCalledTimes(1);
});

it("does not claim empty history while loading", async () => {
	mockHistory.entries = [];
	mockHistory.loading = true;
	const screen = await render(
		<PaperProvider>
			<SightReadingHistoryScreen />
		</PaperProvider>,
	);
	expect(screen.queryByText("Nothing practiced yet")).toBeNull();
});
