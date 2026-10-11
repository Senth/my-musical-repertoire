import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import { ProgressHeader } from "@/components/progress/ProgressHeader";
import { lightTheme } from "@/theme";
import { buildSeries, type ChartSeries } from "@/utils/progress-chart";

const scope = { type: "technique" as const, techniqueId: "together" };
const mockProgress = jest.fn((_scope: unknown, _range: unknown) => mockState);
let mockState = {
	series: [] as ChartSeries[],
	loading: false,
	error: null as Error | null,
};
jest.mock("@/hooks/use-progress-series", () => ({
	useProgressSeries: (scope: unknown, range: unknown) =>
		mockProgress(scope, range),
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockState = { series: [], loading: false, error: null };
});

async function renderHeader(target?: number) {
	return render(
		<PaperProvider theme={lightTheme}>
			<ProgressHeader scope={scope} target={target} />
		</PaperProvider>,
	);
}

it("keeps ranges but no chart or summary for drills and one-day tempos", async () => {
	const logs = [1, 2].map((day) => ({
		date: new Date(2026, 9, day),
		achievedBpm: 80,
		hands: "HT" as const,
		drill: "staccato" as const,
	}));
	mockState.series = buildSeries(logs, "technique");
	const screen = await renderHeader();
	expect(
		screen.getByText("Log a tempo on two different days to see a chart."),
	).toBeTruthy();
	expect(screen.queryByTestId("progress-summary-HT")).toBeNull();
	await fireEvent.press(screen.getByLabelText("All time"));
	expect(mockProgress).toHaveBeenLastCalledWith(scope, "all");
	mockState.series = buildSeries(
		logs.map((log) => ({ ...log, drill: null, date: logs[0].date })),
		"technique",
	);
	await screen.rerender(
		<PaperProvider theme={lightTheme}>
			<ProgressHeader scope={scope} />
		</PaperProvider>,
	);
	expect(
		screen.getByText("Log a tempo on two different days to see a chart."),
	).toBeTruthy();
	expect(screen.queryByTestId("progress-summary-HT")).toBeNull();
});

it("shows only hands together and accurate counts, target gap, and first tempo", async () => {
	mockState.series = buildSeries(
		[
			{ date: new Date(2026, 8, 1), achievedBpm: 72, hands: "HT", quality: 2 },
			{ date: new Date(2026, 9, 1), achievedBpm: 96, hands: "HT", quality: 3 },
			{ date: new Date(2026, 9, 2), achievedBpm: 120, hands: "HT", quality: 5 },
		],
		"technique",
	);
	const screen = await renderHeader(120);
	expect(screen.getByTestId("progress-summary-HT")).toBeTruthy();
	expect(screen.queryByTestId("progress-summary-LH")).toBeNull();
	expect(screen.queryByTestId("progress-summary-RH")).toBeNull();
	expect(screen.getByText("120 BPM · at target")).toBeTruthy();
	expect(screen.getByText("1 shaky · 1 some slips · 1 clean")).toBeTruthy();
	expect(screen.getByText("3 practices")).toBeTruthy();
	expect(screen.getByText(/target 120 · 72 BPM in September/)).toBeTruthy();
	await screen.rerender(
		<PaperProvider theme={lightTheme}>
			<ProgressHeader scope={scope} target={132} />
		</PaperProvider>,
	);
	expect(screen.getByText("120 BPM · 12 to go")).toBeTruthy();
});

it("does not claim an empty chart when a read fails", async () => {
	mockState.error = new Error("read failed");
	const screen = await renderHeader();
	expect(
		screen.getByText("Could not load the tempo chart. Try another range."),
	).toBeTruthy();
	expect(
		screen.queryByText("Log a tempo on two different days to see a chart."),
	).toBeNull();
	await fireEvent.press(screen.getByLabelText("1 year"));
	expect(mockProgress).toHaveBeenLastCalledWith(scope, "1y");
});
