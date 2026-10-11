import { fireEvent, render } from "@testing-library/react-native";
import { Animated } from "react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import SectionEditScreen from "@/app/(app)/piece/[id]/section/[sectionId]";
import { lightTheme } from "@/theme";
import { makePiece, makeSection } from "@/utils/test-factories";

const mockBack = jest.fn();
const mockUpdateSection = jest.fn();
const mockSection = makeSection({
	id: "middle",
	pieceId: "invention",
	label: "Middle entries",
	state: "stabilizing",
});
const mockPiece = makePiece({ id: "invention", title: "Invention No. 1" });

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: jest.fn() }),
	useLocalSearchParams: () => ({ id: "invention", sectionId: "middle" }),
}));
jest.mock("@/hooks/use-auto-focus-on-mount", () => ({
	useAutoFocusOnMount: () => ({ current: null }),
}));
jest.mock("@/hooks/use-up-navigation", () => ({
	useUpNavigation: () => mockBack,
}));
jest.mock("@/hooks/use-pieces", () => ({
	usePieces: () => ({ pieces: [mockPiece] }),
}));
jest.mock("@/hooks/use-sections", () => ({
	useSections: () => ({ sections: [mockSection], loading: false }),
	useAddSection: () => ({ addSection: jest.fn() }),
	useUpdateSection: () => ({ updateSection: mockUpdateSection }),
	useArchiveSection: () => ({ archiveSection: jest.fn() }),
}));
jest.mock("react-native-paper", () => {
	const actual = jest.requireActual("react-native-paper");
	const { Text } = require("react-native");
	return {
		...actual,
		HelperText: ({
			children,
			visible,
			type,
		}: {
			children: React.ReactNode;
			visible: boolean;
			type: string;
		}) => (visible ? <Text accessibilityHint={type}>{children}</Text> : null),
	};
});

const hint =
	"Add both bars to practise this section combined with its neighbours.";

beforeEach(() => {
	jest.spyOn(Animated, "timing").mockReturnValue({
		start: jest.fn(),
		stop: jest.fn(),
		reset: jest.fn(),
	});
});
afterEach(() => jest.restoreAllMocks());

it("shows the hint for trimmed empty bars, replaces it with validation, and saves both bars", async () => {
	const screen = await render(
		<PaperProvider theme={lightTheme}>
			<SectionEditScreen />
		</PaperProvider>,
	);
	expect(screen.getByText("Bars (optional)")).toBeTruthy();
	expect(screen.getByText(hint)).toBeTruthy();
	expect(screen.getByText(hint).props.accessibilityHint).toBe("info");
	await fireEvent.changeText(screen.getByLabelText("Start"), "   ");
	await fireEvent.changeText(screen.getByLabelText("End"), "24");
	expect(screen.getByText(hint)).toBeTruthy();
	await fireEvent(screen.getByLabelText("End"), "blur");
	expect(screen.getByText("End bar requires a start bar.")).toBeTruthy();
	expect(screen.queryByText(hint)).toBeNull();
	expect(
		screen.getByText("End bar requires a start bar.").props.accessibilityHint,
	).toBe("error");
	await fireEvent.press(screen.getByText("Save"));
	expect(mockUpdateSection).not.toHaveBeenCalled();
	await fireEvent.changeText(screen.getByLabelText("Start"), "17");
	await fireEvent(screen.getByLabelText("Start"), "blur");
	expect(screen.queryByText(hint)).toBeNull();
	expect(screen.queryByText("End bar requires a start bar.")).toBeNull();
	await fireEvent.changeText(screen.getByLabelText("End"), " ");
	expect(screen.getByText(hint)).toBeTruthy();
	await fireEvent.changeText(screen.getByLabelText("End"), "24");
	await fireEvent.press(screen.getByText("Save"));
	expect(mockUpdateSection).toHaveBeenCalledWith(
		"invention",
		"middle",
		expect.objectContaining({ startBar: 17, endBar: 24 }),
	);
	expect(mockBack).toHaveBeenCalledTimes(1);
});
