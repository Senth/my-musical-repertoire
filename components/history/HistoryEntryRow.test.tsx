import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import { HistoryEntryRow } from "@/components/history/HistoryEntryRow";
import type { HistorySection } from "@/hooks/use-practice-history";
import { PracticeMistakes } from "@/models/practice";
import { lightTheme } from "@/theme";
import {
	groupHistoryLogs,
	type HistoryEntry,
	normalizeHistoryLog,
} from "@/utils/practice-history";
import { RUN_THROUGH_LOG_SOURCE } from "@/utils/run-through-credit";

const sections: HistorySection[] = [
	{
		id: "intro",
		label: "Intro",
		order: 0,
		startBar: 1,
		endBar: 7,
		archived: false,
	},
	{
		id: "coda",
		label: "Coda",
		order: 1,
		startBar: 208,
		endBar: 264,
		archived: false,
	},
];

function entry(
	type: "piece" | "section" | "technique",
	data: Record<string, unknown> = {},
): HistoryEntry {
	const scope =
		type === "piece"
			? { type, pieceId: "piece" }
			: type === "section"
				? { type, pieceId: "piece", sectionId: "coda" }
				: { type, techniqueId: "technique" };
	return groupHistoryLogs(scope, [
		normalizeHistoryLog(
			{
				id: "log",
				data: {
					date: "2026-10-04T12:00:00Z",
					quality: 4,
					effort: 3,
					achievedBpm: 72,
					...data,
				},
			},
			type,
		),
	])[0];
}

async function renderRow(value: HistoryEntry, catalog = sections) {
	return render(
		<PaperProvider theme={lightTheme}>
			<HistoryEntryRow entry={value} sections={catalog} />
		</PaperProvider>,
	);
}

it("reads section scope and ratings without offering an action when no note exists", async () => {
	const screen = await renderRow(entry("section", { hands: "LH" }));
	expect(screen.getByText("Coda")).toBeTruthy();
	expect(screen.getByText("Bars 208–264")).toBeTruthy();
	expect(screen.getByLabelText("Played sections: Coda")).toBeTruthy();
	expect(screen.getByLabelText("Left hand")).toBeTruthy();
	expect(screen.getByLabelText("Quality: Minor slips")).toBeTruthy();
	expect(screen.getByLabelText("Effort: Moderate")).toBeTruthy();
	expect(screen.getByText("72")).toBeTruthy();
	expect(screen.queryByRole("button")).toBeNull();
});

it("expands and collapses notes with readable ratings in the accessible row label", async () => {
	const note =
		"Left-hand leaps at 216. Slow them alone before pushing the tempo.";
	const screen = await renderRow(entry("section", { note }));
	const button = screen.getByRole("button", {
		name: /Coda.*Quality: Minor slips/,
	});
	expect(button.props.accessibilityHint).toBe("Expand note");
	expect(button.props.accessibilityState.expanded).toBe(false);
	expect(screen.getByText(note).props.numberOfLines).toBe(1);
	await fireEvent.press(button);
	expect(screen.getByRole("button").props.accessibilityState.expanded).toBe(
		true,
	);
	expect(screen.getByRole("button").props.accessibilityHint).toBe(
		"Collapse note",
	);
	expect(screen.getByText(note).props.numberOfLines).toBeUndefined();
	await fireEvent.press(screen.getByRole("button"));
	expect(screen.getByText(note).props.numberOfLines).toBe(1);
});

it("reads run-through mistakes, both hands, and named shaky sections", async () => {
	const screen = await renderRow(
		entry("piece", {
			technicalMistakes: PracticeMistakes.few,
			memoryMistakes: PracticeMistakes.none,
			flaggedSectionIds: ["coda", "intro"],
		}),
	);
	expect(screen.getByText("Run-through")).toBeTruthy();
	expect(screen.getByLabelText("Hands together")).toBeTruthy();
	expect(screen.getByLabelText("Technical: A slip or two")).toBeTruthy();
	expect(screen.getByLabelText("Memory: Clean run")).toBeTruthy();
	expect(screen.getByLabelText("Played sections: Intro, Coda")).toBeTruthy();
	expect(screen.getByText("Shaky: Coda, Intro")).toBeTruthy();
	expect(screen.getAllByText("72")).toHaveLength(1);
});

it("keeps credited and archived history readable without inventing a tempo", async () => {
	const screen = await renderRow(
		entry("section", { source: RUN_THROUGH_LOG_SOURCE, achievedBpm: null }),
		sections.map((section) => ({
			...section,
			archived: section.id === "coda",
		})),
	);
	expect(screen.getByText("From a run-through · archived")).toBeTruthy();
	expect(screen.getByText("Bars 208–264")).toBeTruthy();
	expect(screen.queryByText("BPM")).toBeNull();
});

it("omits missing bar metadata and names unavailable sections", async () => {
	const screen = await renderRow(entry("section"), []);
	expect(screen.getByText("Section no longer available")).toBeTruthy();
	expect(screen.queryByText(/^Bars/)).toBeNull();
	expect(screen.queryByLabelText(/^Played sections:/)).toBeNull();
});

it("keeps plain and drill technique modes separate without piece-only metadata", async () => {
	const value = entry("technique", { hands: "LH" });
	const drill = entry("technique", {
		hands: "RH",
		drill: "staccato",
		quality: 5,
	});
	value.drillGroups = drill.drillGroups;
	const screen = await renderRow(value);
	expect(screen.getByText("Staccato")).toBeTruthy();
	expect(screen.getByLabelText("Left hand")).toBeTruthy();
	expect(screen.getByLabelText("Right hand")).toBeTruthy();
	expect(screen.getByLabelText("Quality: Minor slips")).toBeTruthy();
	expect(screen.getByLabelText("Quality: Clean and secure")).toBeTruthy();
	expect(screen.queryByText("Coda")).toBeNull();
	expect(screen.queryByLabelText(/^Played sections:/)).toBeNull();
});
