import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import ScalesScreen from "@/app/(app)/technique/scales";
import i18n from "@/i18n";
import type { TechniqueItem } from "@/models/technique";
import { lightTheme } from "@/theme";
import { catalogEntries, catalogTitle } from "@/utils/technique-catalog";

const mockAdd = jest.fn();
const mockAddAll = jest.fn();
const mockLink = jest.fn();
const mockBack = jest.fn();
let mockCompact = false;
let mockTechniques: TechniqueItem[] = [];
let mockLoading = false;

jest.mock("@/hooks/use-techniques", () => ({
	useTechniques: () => ({ techniques: mockTechniques, loading: mockLoading }),
	useAddCatalogTechnique: () => ({ addCatalogTechnique: mockAdd }),
	useAddAllCatalog: () => ({ addAllCatalog: mockAddAll }),
	useLinkCatalogTechnique: () => ({ linkCatalogTechnique: mockLink }),
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
		visible,
		children,
	}: {
		visible: boolean;
		children: React.ReactNode;
	}) => (visible ? children : null),
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
	mockAddAll.mockResolvedValue(undefined);
	mockLink.mockResolvedValue(undefined);
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

it.each(["start", "later"] as const)(
	"confirms a new near match using the chosen %s mode",
	async (mode) => {
		mockTechniques = [technique("G minor")];
		const screen = await render(page());
		await fireEvent.press(screen.getByLabelText("Add G harmonic minor scale"));
		await fireEvent.press(
			screen.getByText(
				mode === "start" ? "Start practicing now" : "Save for later",
			),
		);
		expect(
			screen.getByText("Is “G minor” the same as G harmonic minor scale?"),
		).toBeTruthy();
		expect(
			screen.getByText("You already have a technique called “G minor”."),
		).toBeTruthy();
		expect(mockAdd).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByText("No, add G harmonic minor scale too"),
		);
		await waitFor(() =>
			expect(mockAdd).toHaveBeenCalledWith(
				expect.objectContaining({ key: "scale.harmonicMinor.G" }),
				"G harmonic minor scale",
				mode,
			),
		);
		expect(mockLink).not.toHaveBeenCalled();
		mockTechniques = [
			...mockTechniques,
			technique(
				"G harmonic minor scale",
				mode === "start" ? "active" : "not_started",
				"scale.harmonicMinor.G",
			),
		];
		await screen.rerender(page());
		expect(screen.queryByLabelText("Add G harmonic minor scale")).toBeNull();
		expect(screen.getByText("In your list")).toBeTruthy();
	},
);

it.each([false, true])(
	"links first near match with rename=%s and preserves ownership after later edits",
	async (rename) => {
		mockTechniques = [technique("G minor"), technique("G min")];
		const screen = await render(page());
		await fireEvent.press(screen.getByLabelText("Add G harmonic minor scale"));
		await fireEvent.press(screen.getByText("Start practicing now"));
		await fireEvent.press(
			screen.getByText(
				rename
					? "Yes, rename it to “G harmonic minor scale”"
					: "Yes, keep the name “G minor”",
			),
		);
		await waitFor(() =>
			expect(mockLink).toHaveBeenCalledWith(
				"G minor",
				expect.objectContaining({ key: "scale.harmonicMinor.G" }),
				rename,
				undefined,
			),
		);
		expect(mockAdd).not.toHaveBeenCalled();
		expect(
			screen.queryByText("Is “G min” the same as G harmonic minor scale?"),
		).toBeNull();
		mockTechniques = [
			technique("My renamed scale", "maintenance", "scale.harmonicMinor.G"),
		];
		await screen.rerender(page());
		expect(screen.getByText("In your list")).toBeTruthy();
		expect(screen.queryByLabelText("Add G harmonic minor scale")).toBeNull();
	},
);

it("cancels a single near match without writing", async () => {
	mockTechniques = [technique("G minor")];
	const screen = await render(page());
	await fireEvent.press(screen.getByLabelText("Add G harmonic minor scale"));
	await fireEvent.press(screen.getByText("Save for later"));
	await fireEvent.press(screen.getByText("Cancel"));
	expect(mockAdd).not.toHaveBeenCalled();
	expect(mockLink).not.toHaveBeenCalled();
	await fireEvent.press(screen.getByLabelText("Add G harmonic minor scale"));
	await fireEvent.press(screen.getByText("Save for later"));
	expect(
		screen.getByText("Is “G minor” the same as G harmonic minor scale?"),
	).toBeTruthy();
});

const twoMissing = () => {
	const missing = ["scale.harmonicMinor.A", "scale.harmonicMinor.G"];
	mockTechniques = catalogEntries()
		.filter((entry) => !missing.includes(entry.key))
		.map((entry) =>
			technique(catalogTitle(entry, i18n.t), "not_started", entry.key),
		);
	mockTechniques.push(
		technique("A minor", "maintenance"),
		technique("G minor"),
	);
};

it("collects Add all answers in curriculum order before one batch", async () => {
	twoMissing();
	const screen = await render(page());
	await fireEvent.changeText(
		screen.getByLabelText("Search scales and arpeggios"),
		"G minor",
	);
	await fireEvent.press(screen.getByText("By type"));
	await fireEvent.press(screen.getByText("Add all 2"));
	expect(
		screen.getByText("Is “A minor” the same as A harmonic minor scale?"),
	).toBeTruthy();
	expect(
		screen.getByText(
			"1 of 2 possible matches. Adding all 0 others as Not started.",
		),
	).toBeTruthy();
	await fireEvent.press(screen.getByText("Yes, keep the name “A minor”"));
	expect(mockLink).not.toHaveBeenCalled();
	expect(mockAddAll).not.toHaveBeenCalled();
	expect(
		screen.getByText(
			"2 of 2 possible matches. Adding all 0 others as Not started.",
		),
	).toBeTruthy();
	await fireEvent.press(screen.getByText("No, add G harmonic minor scale too"));
	await waitFor(() =>
		expect(mockAddAll).toHaveBeenCalledWith(
			[expect.objectContaining({ key: "scale.harmonicMinor.G" })],
			["G harmonic minor scale"],
			[
				{
					id: "A minor",
					entry: expect.objectContaining({ key: "scale.harmonicMinor.A" }),
					rename: false,
					currentType: undefined,
				},
			],
		),
	);
	expect(mockAdd).not.toHaveBeenCalled();
	mockTechniques = mockTechniques.map((item) =>
		item.id === "A minor"
			? { ...item, curriculumKey: "scale.harmonicMinor.A" }
			: item,
	);
	mockTechniques.push(
		technique("G harmonic minor scale", "not_started", "scale.harmonicMinor.G"),
	);
	await screen.rerender(page());
	expect(screen.queryByText(/^Add all /)).toBeNull();
});

it("discards all earlier answers when Add all is cancelled", async () => {
	twoMissing();
	const screen = await render(page());
	await fireEvent.press(screen.getByText("Add all 2"));
	await fireEvent.press(
		screen.getByText("Yes, rename it to “A harmonic minor scale”"),
	);
	await fireEvent.press(screen.getByText("Cancel, add nothing"));
	expect(mockAddAll).not.toHaveBeenCalled();
	expect(mockLink).not.toHaveBeenCalled();
	expect(mockAdd).not.toHaveBeenCalled();
	await fireEvent.press(screen.getByText("Add all 2"));
	expect(
		screen.getByText("Is “A minor” the same as A harmonic minor scale?"),
	).toBeTruthy();
});

it.each([false, true])(
	"adds every missing technique independent of search, compact=%s",
	async (compact) => {
		mockCompact = compact;
		mockTechniques = [technique("C major scale")];
		const screen = await render(page());
		await fireEvent.changeText(
			screen.getByLabelText("Search scales and arpeggios"),
			"Hanon",
		);
		await fireEvent.press(screen.getByText("Add all 72"));
		await waitFor(() => expect(mockAddAll).toHaveBeenCalledTimes(1));
		expect(mockAddAll.mock.calls[0][0]).toEqual(catalogEntries().slice(1));
		expect(mockAddAll.mock.calls[0][1]).toHaveLength(72);
		expect(mockAddAll.mock.calls[0][2]).toEqual([]);
	},
);

it("hides Add all when nothing is missing", async () => {
	mockTechniques = catalogEntries().map((entry) =>
		technique("Renamed", "active", entry.key),
	);
	const screen = await render(page());
	expect(screen.queryByText(/^Add all /)).toBeNull();
});

it("does not link one ambiguous title to multiple entries in Add all", async () => {
	mockTechniques = [technique("G minor")];
	const screen = await render(page());
	await fireEvent.press(screen.getByText("Add all 73"));
	await fireEvent.press(screen.getByText("Yes, keep the name “G minor”"));
	await waitFor(() => expect(mockAddAll).toHaveBeenCalledTimes(1));
	expect(mockAddAll.mock.calls[0][0]).toHaveLength(72);
	expect(mockAddAll.mock.calls[0][2]).toHaveLength(1);
});

it("fills an earlier title-only match when Add all links it to another technique", async () => {
	mockTechniques = [technique("C major")];
	const screen = await render(page());
	await fireEvent.press(screen.getByText("Add all 72"));
	await fireEvent.press(screen.getByText("Yes, keep the name “C major”"));
	await waitFor(() => expect(mockAddAll).toHaveBeenCalledTimes(1));
	expect(mockAddAll.mock.calls[0][0]).toEqual(
		catalogEntries().filter((entry) => entry.key !== "arpeggio.major.C"),
	);
	expect(mockAddAll.mock.calls[0][2]).toEqual([
		expect.objectContaining({
			id: "C major",
			entry: expect.objectContaining({ key: "arpeggio.major.C" }),
		}),
	]);
});

it("shows Add all failure and permits retry", async () => {
	mockAddAll.mockRejectedValueOnce(new Error("permission-denied"));
	const screen = await render(page());
	await fireEvent.press(screen.getByText("Add all 73"));
	await waitFor(() =>
		expect(
			screen.getByText("Could not add these techniques. Try again."),
		).toBeTruthy(),
	);
	await fireEvent.press(screen.getByText("Add all 73"));
	await waitFor(() => expect(mockAddAll).toHaveBeenCalledTimes(2));
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
