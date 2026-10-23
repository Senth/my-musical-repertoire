import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import { ProgressHeader } from "@/components/progress/ProgressHeader";
import type { ProgressScope } from "@/hooks/use-progress-series";
import { PracticeMistakes } from "@/models/practice";
import { lightTheme } from "@/theme";
import { contentWidth } from "@/theme/tokens";
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

async function renderHeader(
	target?: number,
	chartScope: ProgressScope = scope,
) {
	return render(
		<PaperProvider theme={lightTheme}>
			<ProgressHeader scope={chartScope} target={target} />
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

it("keeps an achieved target below every tempo inside the chart", async () => {
	mockState.series = buildSeries(
		[
			{ date: new Date(2026, 9, 1), achievedBpm: 61, hands: "LH" },
			{ date: new Date(2026, 9, 2), achievedBpm: 80, hands: "LH" },
		],
		"section",
	);
	const screen = await renderHeader(40);
	await fireEvent(
		screen.container.queryAll(
			(node) => typeof node.props.onLayout === "function",
		)[0],
		"layout",
		{
			nativeEvent: { layout: { width: contentWidth.page } },
		},
	);
	const chart = screen.container.queryAll(
		(node) => node.props.accessibilityRole === "image",
	)[0];
	const stroke = chart.queryAll(
		(node) => node.props.strokeDasharray != null,
	)[0];
	const label = chart.queryAll((node) => node.props.content === "40")[0];
	expect(stroke).toBeDefined();
	expect(label).toBeDefined();
	expect(stroke?.props.y1).toBeGreaterThan(0);
	expect(stroke?.props.y1).toBeLessThan(chart.props.bbHeight);
	expect(Number(label?.parent?.props.y[0])).toBe(Number(stroke?.props.y1));
	expect(screen.getByText("80 BPM · at target")).toBeTruthy();
});

it("shows empty state for different hands with one day each until one hand spans two days", async () => {
	const logs = [
		{ date: new Date(2026, 9, 1), achievedBpm: 60, hands: "LH" as const },
		{ date: new Date(2026, 9, 2), achievedBpm: 64, hands: "RH" as const },
	];
	mockState.series = buildSeries(logs, "technique");
	const screen = await renderHeader(80);
	expect(
		screen.getByText("Log a tempo on two different days to see a chart."),
	).toBeTruthy();
	expect(screen.queryByTestId("progress-summary-LH")).toBeNull();
	expect(screen.queryByTestId("progress-summary-RH")).toBeNull();
	mockState.series = buildSeries(
		[...logs, { date: new Date(2026, 9, 2), achievedBpm: 64, hands: "LH" }],
		"technique",
	);
	await screen.rerender(
		<PaperProvider theme={lightTheme}>
			<ProgressHeader scope={scope} target={80} />
		</PaperProvider>,
	);
	expect(
		screen.queryByText("Log a tempo on two different days to see a chart."),
	).toBeNull();
	expect(screen.getByTestId("progress-summary-LH")).toBeTruthy();
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

it.each([96, undefined])(
	"shows run-through counts from the worse mistake with target %s",
	async (target) => {
		mockState.series = buildSeries(
			[
				{
					date: new Date(2026, 8, 1),
					achievedBpm: 60,
					technicalMistakes: PracticeMistakes.none,
					memoryMistakes: PracticeMistakes.few,
				},
				{
					date: new Date(2026, 9, 1),
					achievedBpm: 64,
					technicalMistakes: PracticeMistakes.few,
					memoryMistakes: PracticeMistakes.many,
				},
				{
					date: new Date(2026, 9, 2),
					achievedBpm: 72,
					technicalMistakes: PracticeMistakes.some,
					memoryMistakes: PracticeMistakes.none,
				},
			],
			"run-through",
		);
		const screen = await renderHeader(target, {
			type: "run-throughs",
			pieceId: "piece",
		});
		expect(screen.getByText("Run-throughs")).toBeTruthy();
		expect(screen.getByText("1 shaky · 1 some slips · 1 clean")).toBeTruthy();
		expect(screen.getByText("3 practices")).toBeTruthy();
		expect(
			screen.getByText("Line width: worst of technical and memory mistakes"),
		).toBeTruthy();
		for (const label of ["None or few", "Some", "Many or everywhere"])
			expect(screen.getByText(label)).toBeTruthy();
		expect(screen.getByText(/whole piece/)).toBeTruthy();
		expect(screen.queryByText("Left hand")).toBeNull();
		expect(screen.queryByText("Hands together")).toBeNull();
		if (target == null) {
			expect(screen.queryByText("Target")).toBeNull();
			expect(screen.queryByText(/to go/)).toBeNull();
		} else {
			expect(screen.getByText("72 BPM · 24 to go")).toBeTruthy();
		}
	},
);

it("shows sight-reading tempo and stops without target or hand legend", async () => {
	mockState.series = buildSeries(
		[
			{ date: new Date(2026, 8, 1), achievedBpm: 60, keptGoing: 2 },
			{ date: new Date(2026, 9, 1), achievedBpm: 64, keptGoing: 3 },
			{ date: new Date(2026, 9, 2), achievedBpm: 72, keptGoing: 5 },
		],
		"sight-reading",
	);
	const screen = await renderHeader(undefined, { type: "sight-reading" });
	expect(screen.getByText("Sight-reading")).toBeTruthy();
	expect(screen.getByText("1 shaky · 1 some slips · 1 clean")).toBeTruthy();
	for (const label of ["Kept going", "Some stops", "Lots of stops"])
		expect(screen.getByText(label)).toBeTruthy();
	expect(screen.queryByText("Target")).toBeNull();
	expect(screen.queryByText(/to go/)).toBeNull();
	expect(screen.queryByText("Left hand")).toBeNull();
	expect(
		screen.queryByText("Line width: worst of technical and memory mistakes"),
	).toBeNull();
	expect(screen.queryByText(/72 BPM {2}·/)).toBeNull();
});

it("drops target copy for a section without a resolved target", async () => {
	mockState.series = buildSeries(
		[
			{ date: new Date(2026, 8, 1), achievedBpm: 60, hands: "LH" },
			{ date: new Date(2026, 9, 1), achievedBpm: 64, hands: "LH" },
		],
		"section",
	);
	const screen = await renderHeader(undefined, {
		type: "section",
		pieceId: "piece",
		sectionId: "section",
	});
	expect(screen.getByTestId("progress-summary-LH")).toBeTruthy();
	expect(screen.queryByText("Target")).toBeNull();
	expect(screen.queryByText(/to go/)).toBeNull();
});
