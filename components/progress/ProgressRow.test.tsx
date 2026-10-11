import { fireEvent, render } from "@testing-library/react-native";
import { Animated } from "react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import ProgressScreen from "@/app/(app)/(tabs)/progress";
import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";
import type { TechniqueItem } from "@/models/technique";
import { lightTheme } from "@/theme";
import { makePiece, makeSection, makeTechnique } from "@/utils/test-factories";

const mockPush = jest.fn();
let mockPieces: Piece[];
let mockSections: Section[];
let mockTechniques: TechniqueItem[];
let mockLoading = false;

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/hooks/use-pieces", () => ({
	usePieces: () => ({ pieces: mockPieces, loading: mockLoading }),
}));
jest.mock("@/hooks/use-sections", () => ({
	useAllSections: () => ({ sections: mockSections, loading: false }),
}));
jest.mock("@/hooks/use-techniques", () => ({
	useTechniques: () => ({ techniques: mockTechniques, loading: false }),
}));

beforeEach(() => {
	jest.clearAllMocks();
	jest
		.spyOn(Animated, "loop")
		.mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
	jest
		.spyOn(Animated, "timing")
		.mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
	mockLoading = false;
	mockPieces = [
		makePiece({ id: "piece", title: "Invention", targetTempoBpm: 100 }),
	];
	mockSections = [
		makeSection({
			id: "section",
			pieceId: "piece",
			label: "Exposition",
			byMode: { RH: { bpm: 80 }, LH: { bpm: 60 }, HT: { bpm: 20 } },
		}),
	];
	mockTechniques = [
		makeTechnique({
			id: "scale",
			title: "C major scale",
			targetTempoBpm: 120,
			byMode: {
				LH: { bpm: 120 },
				RH: { bpm: 132 },
				"LH.staccato": { bpm: 72 },
			},
		}),
	];
});

afterEach(() => jest.restoreAllMocks());

function renderProgress() {
	return render(
		<PaperProvider theme={lightTheme}>
			<ProgressScreen />
		</PaperProvider>,
	);
}

it("uses 20 BPM as zero, keeps hand order and opens section history", async () => {
	const screen = await renderProgress();
	expect(
		["LH", "RH", "HT"].map(
			(hands) =>
				screen.getByTestId(`progress-fill-${hands}`).props.accessibilityValue
					.now,
		),
	).toEqual([50, 75, 0]);
	const link = screen.getByRole("link", {
		name: /^Exposition\. Invention\. target 100\. Left hand: 60 BPM\. Right hand: 80 BPM\. Hands together: 20 BPM$/,
	});
	await fireEvent.press(link);
	expect(mockPush).toHaveBeenLastCalledWith(
		"/piece/piece/history?sectionId=section",
	);
});

it("expands and collapses at-target rows without including drills or missing hands", async () => {
	const screen = await renderProgress();
	const toggle = screen.getByRole("button", {
		name: "At target in every hand: 1 passage",
	});
	expect(screen.queryByRole("link", { name: /^C major scale\./ })).toBeNull();
	await fireEvent.press(toggle);
	expect(toggle.props.accessibilityState.expanded).toBe(true);
	const scale = screen.getByRole("link", {
		name: /^C major scale\. Techniques\. target 120\. Left hand: 120 BPM\. Right hand: 132 BPM$/,
	});
	for (const hands of ["LH", "RH"])
		expect(
			screen.getAllByTestId(`progress-fill-${hands}`)[1].props
				.accessibilityValue.now,
		).toBe(100);
	await fireEvent.press(scale);
	expect(mockPush).toHaveBeenLastCalledWith("/technique/scale/history");
	await fireEvent.press(toggle);
	expect(screen.queryByRole("link", { name: /^C major scale\./ })).toBeNull();
});

it("still offers expansion when every qualifying passage is at target", async () => {
	mockSections = [];
	const screen = await renderProgress();
	expect(screen.queryByText(/Set a target tempo/)).toBeNull();
	await fireEvent.press(
		screen.getByRole("button", { name: "At target in every hand: 1 passage" }),
	);
	expect(screen.getByRole("link", { name: /^C major scale\./ })).toBeTruthy();
});

it("hides the at-target toggle when no passage is at target", async () => {
	mockTechniques = [];
	const screen = await renderProgress();
	expect(screen.queryByText(/At target in every hand/)).toBeNull();
	expect(screen.getByRole("link", { name: /^Exposition\./ })).toBeTruthy();
});

it("offers Pieces for an empty repertoire, but not while data is loading", async () => {
	mockPieces = [];
	mockSections = [];
	mockTechniques = [];
	mockLoading = true;
	const screen = await renderProgress();
	expect(screen.queryByText(/Set a target tempo/)).toBeNull();
	mockLoading = false;
	await screen.rerender(
		<PaperProvider theme={lightTheme}>
			<ProgressScreen />
		</PaperProvider>,
	);
	expect(
		screen.getByText(
			"Set a target tempo on a piece or technique and log a practice at tempo to see it here.",
		),
	).toBeTruthy();
	await fireEvent.press(screen.getByRole("button", { name: "Pieces" }));
	expect(mockPush).toHaveBeenLastCalledWith("/piece");
});
