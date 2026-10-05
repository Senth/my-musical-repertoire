import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import PieceHistoryScreen from "@/app/(app)/piece/[id]/history";
import type { HistorySection } from "@/hooks/use-practice-history";
import { lightTheme } from "@/theme";
import {
	groupHistoryLogs,
	type HistoryEntry,
	normalizeHistoryLog,
} from "@/utils/practice-history";
import { RUN_THROUGH_LOG_SOURCE } from "@/utils/run-through-credit";

const mockPush = jest.fn();
jest.mock("react-native-paper", () => ({
	...jest.requireActual("react-native-paper"),
	ActivityIndicator: () => null,
}));
const mockBack = jest.fn();
let mockParams: { id: string; sectionId?: string } = { id: "piece" };
const sections: HistorySection[] = [
	{
		id: "coda",
		label: "Coda",
		order: 1,
		archived: false,
		startBar: 208,
		endBar: 264,
	},
	{
		id: "intro",
		label: "Intro",
		order: 0,
		archived: false,
		startBar: 1,
		endBar: 7,
	},
	{ id: "old", label: "Old passage", order: 2, archived: true },
];
const mockHistory = {
	entries: [] as HistoryEntry[],
	sections,
	loading: false,
	hasMore: false,
	error: null as Error | null,
	loadMore: jest.fn(),
};
let mockPiecesLoading = false;
let mockMissingPiece = false;

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
	useLocalSearchParams: () => mockParams,
}));
jest.mock("@/hooks/use-up-navigation", () => ({
	useUpNavigation: () => mockBack,
}));
jest.mock("@/hooks/use-page-inset", () => ({
	usePageInset: () => jest.requireActual("@/theme/tokens").inset.compact,
}));
jest.mock("@/hooks/use-pieces", () => ({
	usePieces: () => ({
		pieces: mockMissingPiece ? [] : [{ id: "piece", title: "Ballade No. 1" }],
		loading: mockPiecesLoading,
	}),
}));
jest.mock("@/hooks/use-practice-history", () => ({
	usePracticeHistory: () => mockHistory,
}));

function entry(sectionId?: string, credited = false): HistoryEntry {
	const scope = sectionId
		? { type: "section" as const, pieceId: "piece", sectionId }
		: { type: "piece" as const, pieceId: "piece" };
	return groupHistoryLogs(scope, [
		normalizeHistoryLog(
			{
				id: sectionId ?? "run",
				data: {
					date: new Date().toISOString(),
					quality: 4,
					effort: 3,
					achievedBpm: 72,
					...(credited ? { source: RUN_THROUGH_LOG_SOURCE } : {}),
				},
			},
			scope.type,
		),
	])[0];
}

async function renderScreen() {
	return render(
		<PaperProvider theme={lightTheme}>
			<PieceHistoryScreen />
		</PaperProvider>,
	);
}

beforeEach(() => {
	mockParams = { id: "piece" };
	mockHistory.entries = [
		entry("coda"),
		entry(),
		entry("intro"),
		entry("coda", true),
	];
	mockHistory.sections = sections;
	mockHistory.loading = false;
	mockHistory.hasMore = false;
	mockHistory.error = null;
	mockPiecesLoading = false;
	mockMissingPiece = false;
	jest.clearAllMocks();
});

it("groups a day's rows once, hides credited rows on All, and filters run-throughs", async () => {
	const screen = await renderScreen();
	expect(screen.getByText("History")).toBeTruthy();
	expect(screen.getByText("Ballade No. 1")).toBeTruthy();
	expect(screen.getAllByText("Today")).toHaveLength(1);
	expect(screen.queryByText("From a run-through")).toBeNull();
	expect(screen.queryByLabelText("Old passage")).toBeNull();
	await fireEvent.press(screen.getByLabelText("Run-throughs"));
	expect(screen.getByText("Run-through")).toBeTruthy();
	expect(screen.queryByText("Bars 208–264")).toBeNull();
	await fireEvent.press(screen.getByLabelText("Back"));
	expect(mockBack).toHaveBeenCalledTimes(1);
});

it("preselects a live section and includes its run-through credits", async () => {
	mockParams.sectionId = "coda";
	const screen = await renderScreen();
	expect(screen.getByLabelText("Coda").props.accessibilityState.selected).toBe(
		true,
	);
	expect(screen.getByText("From a run-through")).toBeTruthy();
	expect(screen.queryByText("Run-through")).toBeNull();
	await fireEvent.press(screen.getByLabelText("All"));
	expect(screen.queryByText("From a run-through")).toBeNull();
});

it.each(["old", "unknown"])(
	"falls back to All for %s section parameter",
	async (sectionId) => {
		mockParams.sectionId = sectionId;
		const screen = await renderScreen();
		expect(screen.getByLabelText("All").props.accessibilityState.selected).toBe(
			true,
		);
		expect(screen.getByText("Run-through")).toBeTruthy();
	},
);

it("waits for live sections before settling route preselection", async () => {
	mockParams.sectionId = "coda";
	mockHistory.sections = [];
	mockHistory.entries = [];
	mockHistory.loading = true;
	const screen = await renderScreen();
	expect(screen.queryByText("Nothing practiced yet")).toBeNull();
	mockHistory.sections = sections;
	mockHistory.entries = [entry("coda")];
	mockHistory.loading = false;
	await screen.rerender(
		<PaperProvider theme={lightTheme}>
			<PieceHistoryScreen />
		</PaperProvider>,
	);
	expect(screen.getByLabelText("Coda").props.accessibilityState.selected).toBe(
		true,
	);
});

it("offers supported practice navigation only for an empty overall history", async () => {
	mockHistory.entries = [];
	const screen = await renderScreen();
	expect(screen.getByText("Nothing practiced yet")).toBeTruthy();
	expect(
		screen.getByText(
			"Every run-through and section you log for this piece shows up here, newest first.",
		),
	).toBeTruthy();
	await fireEvent.press(screen.getByRole("button", { name: "Practice" }));
	expect(mockPush).toHaveBeenCalledWith(
		"/piece/piece/practice?from=piece-detail",
	);
	await fireEvent.press(screen.getByLabelText("Coda"));
	expect(screen.getByText("No practice on Coda yet.")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Practice" })).toBeNull();
	await fireEvent.press(screen.getByLabelText("Run-throughs"));
	expect(screen.getByText("No run-throughs yet.")).toBeTruthy();
});

it("loads older pages without changing the filter or hiding existing rows", async () => {
	mockHistory.hasMore = true;
	const screen = await renderScreen();
	await fireEvent.press(screen.getByLabelText("Coda"));
	await fireEvent.press(screen.getByRole("button", { name: "Show older" }));
	expect(mockHistory.loadMore).toHaveBeenCalledTimes(1);
	expect(screen.getByLabelText("Coda").props.accessibilityState.selected).toBe(
		true,
	);
	expect(screen.getByText("From a run-through")).toBeTruthy();
});

it("offers retry rather than falsely reporting no practice after a read failure", async () => {
	mockHistory.entries = [];
	mockHistory.error = new Error("read failed");
	const screen = await renderScreen();
	expect(
		screen.getByText("Could not load practice history. Try again."),
	).toBeTruthy();
	expect(screen.queryByText("Nothing practiced yet")).toBeNull();
	await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
	expect(mockHistory.loadMore).toHaveBeenCalledTimes(1);
});

it("shows a missing-piece message without a practice action", async () => {
	mockMissingPiece = true;
	const screen = await renderScreen();
	expect(screen.getByText("Piece not found")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Practice" })).toBeNull();
});
