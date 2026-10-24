import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import ScalesScreen from "@/app/(app)/technique/scales";
import type { TechniqueItem } from "@/models/technique";
import { lightTheme } from "@/theme";

const mockAdd = jest.fn();
const mockBack = jest.fn();
let mockCompact = false;
let mockTechniques: TechniqueItem[] = [];
let mockLoading = false;

jest.mock("@/hooks/use-techniques", () => ({
	useTechniques: () => ({ techniques: mockTechniques, loading: mockLoading }),
	useAddCatalogTechnique: () => ({ addCatalogTechnique: mockAdd }),
}));
jest.mock("@/hooks/use-up-navigation", () => ({
	useUpNavigation: () => mockBack,
}));
jest.mock("@/hooks/use-is-compact", () => ({
	useIsCompact: () => mockCompact,
}));
jest.mock("@/hooks/use-page-inset", () => ({
	usePageInset: () => jest.requireActual("@/theme/tokens").inset.compact,
}));
jest.mock("react-native-paper", () => ({
	...jest.requireActual("react-native-paper"),
	ActivityIndicator: () => null,
	Menu: ({
		anchor,
		visible,
		children,
	}: {
		anchor: React.ReactNode;
		visible: boolean;
		children: React.ReactNode;
	}) => (
		<>
			{anchor}
			{visible && children}
		</>
	),
}));

const technique = (
	title: string,
	state: TechniqueItem["state"] = "active",
	curriculumKey?: string,
): TechniqueItem => ({
	id: title,
	title,
	state,
	curriculumKey,
	userId: "student",
	dateIntroduced: new Date(),
});
const page = () => (
	<PaperProvider theme={lightTheme}>
		<ScalesScreen />
	</PaperProvider>
);

beforeEach(() => {
	jest.clearAllMocks();
	mockCompact = false;
	mockLoading = false;
	mockTechniques = [];
	mockAdd.mockResolvedValue(undefined);
});

it("browses all 73 entries, changes grouping and keeps search across views", async () => {
	const screen = await render(page());
	expect(screen.getAllByLabelText(/^Add /)).toHaveLength(73);
	expect(screen.getByText("C major · A minor")).toBeTruthy();
	await fireEvent.changeText(
		screen.getByLabelText("Search scales and arpeggios"),
		"G minor",
	);
	expect(screen.getAllByLabelText(/^Add /)).toHaveLength(3);
	await fireEvent.press(screen.getByText("By type"));
	expect(screen.queryByText("B♭ major · G minor")).toBeNull();
	expect(screen.getAllByLabelText(/^Add /)).toHaveLength(3);
	for (const query of ["Gm", "G min"]) {
		await fireEvent.changeText(
			screen.getByLabelText("Search scales and arpeggios"),
			query,
		);
		expect(screen.getAllByLabelText(/^Add /)).toHaveLength(3);
		for (const title of [
			"G harmonic minor scale",
			"G melodic minor scale",
			"G minor arpeggio",
		])
			expect(screen.getByText(title)).toBeTruthy();
	}
});

it.each([true, false])(
	"keeps exact rows read-only and near matches addable, compact=%s",
	async (compact) => {
		mockCompact = compact;
		mockTechniques = [
			technique("C major scale"),
			technique("A harmonic minor scale", "not_started"),
			technique("G minor"),
		];
		const screen = await render(page());
		expect(screen.getByText("Active")).toBeTruthy();
		expect(screen.getByText("Not started")).toBeTruthy();
		expect(screen.queryByLabelText("Add C major scale")).toBeNull();
		expect(screen.queryByLabelText("Add A harmonic minor scale")).toBeNull();
		await fireEvent.changeText(
			screen.getByLabelText("Search scales and arpeggios"),
			"G min",
		);
		expect(screen.getAllByText("You have “G minor”")).toHaveLength(3);
		expect(screen.getAllByLabelText(/^Add /)).toHaveLength(3);
	},
);

it.each([
	["Start practicing now", "start", "active", "Active"],
	["Save for later", "later", "not_started", "Not started"],
] as const)(
	"adds through %s and waits for snapshot to mark ownership",
	async (label, mode, state, chip) => {
		const screen = await render(page());
		await fireEvent.press(screen.getByLabelText("Add C major scale"));
		expect(screen.getByText("Shows up in your plans from today")).toBeTruthy();
		expect(
			screen.getByText("Waits as Not started, in curriculum order"),
		).toBeTruthy();
		await fireEvent.press(screen.getByText(label));
		await waitFor(() =>
			expect(mockAdd).toHaveBeenCalledWith(
				expect.objectContaining({ key: "scale.major.C" }),
				"C major scale",
				mode,
			),
		);
		expect(screen.queryByText("In your list")).toBeNull();
		mockTechniques = [technique("C major scale", state, "scale.major.C")];
		await screen.rerender(page());
		expect(screen.getByText("In your list")).toBeTruthy();
		expect(screen.getByText(chip)).toBeTruthy();
		expect(screen.queryByLabelText("Add C major scale")).toBeNull();
	},
);

it("adds near matches as new techniques until confirmation lands in Phase 5", async () => {
	mockTechniques = [technique("G minor")];
	const screen = await render(page());
	await fireEvent.press(screen.getByLabelText("Add G harmonic minor scale"));
	await fireEvent.press(screen.getByText("Save for later"));
	await waitFor(() =>
		expect(mockAdd).toHaveBeenCalledWith(
			expect.objectContaining({ key: "scale.harmonicMinor.G" }),
			"G harmonic minor scale",
			"later",
		),
	);
});

it("blocks duplicate writes while pending, shows write failure, then permits retry", async () => {
	let rejectWrite!: (error: Error) => void;
	mockAdd.mockReturnValueOnce(
		new Promise((_, reject) => {
			rejectWrite = reject;
		}),
	);
	const screen = await render(page());
	await fireEvent.press(screen.getByLabelText("Add C major scale"));
	await fireEvent.press(screen.getByText("Save for later"));
	expect(screen.getByLabelText("Add C major scale")).toBeDisabled();
	await fireEvent.press(screen.getByLabelText("Add C major scale"));
	expect(mockAdd).toHaveBeenCalledTimes(1);
	rejectWrite(new Error("write failed"));
	await waitFor(() =>
		expect(
			screen.getByText("Could not add this technique. Try again."),
		).toBeTruthy(),
	);
	await fireEvent.press(screen.getByLabelText("Add C major scale"));
	await fireEvent.press(screen.getByText("Save for later"));
	await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(2));
});

it("explains empty search and offers back navigation", async () => {
	const screen = await render(page());
	await fireEvent.changeText(
		screen.getByLabelText("Search scales and arpeggios"),
		"Hanon",
	);
	expect(
		screen.getByText(
			"No scales or arpeggios match your search. Try another name or key.",
		),
	).toBeTruthy();
	await fireEvent.press(screen.getByLabelText("Back"));
	expect(mockBack).toHaveBeenCalledTimes(1);
});

it("waits for existing techniques before allowing adds", async () => {
	mockLoading = true;
	const screen = await render(page());
	expect(screen.queryByLabelText(/^Add /)).toBeNull();
});
