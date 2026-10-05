import { fireEvent, render } from "@testing-library/react-native";
import { Animated } from "react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import SectionEditScreen from "@/app/(app)/piece/[id]/section/[sectionId]";
import { lightTheme } from "@/theme";

const mockPush = jest.fn();
let mockSectionId = "coda";
beforeEach(() => {
	jest
		.spyOn(Animated, "timing")
		.mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
});
afterEach(() => jest.restoreAllMocks());
jest.mock("expo-router", () => ({
	useFocusEffect: jest.fn(),
	useLocalSearchParams: () => ({ id: "piece", sectionId: mockSectionId }),
	useRouter: () => ({ push: mockPush }),
}));
jest.mock("@/hooks/use-up-navigation", () => ({
	useUpNavigation: () => jest.fn(),
}));
jest.mock("@/hooks/use-pieces", () => ({
	usePieces: () => ({
		pieces: [
			{ id: "piece", title: "Ballade", composer: "Chopin", state: "learning" },
		],
	}),
}));
jest.mock("@/hooks/use-sections", () => ({
	useSections: () => ({
		sections: [{ id: "coda", label: "Coda", state: "learning" }],
		loading: false,
	}),
	useAddSection: () => ({ addSection: jest.fn() }),
	useUpdateSection: () => ({ updateSection: jest.fn() }),
	useArchiveSection: () => ({ archiveSection: jest.fn() }),
}));

it("opens existing section history with its section parameter", async () => {
	mockSectionId = "coda";
	const screen = await render(
		<PaperProvider theme={lightTheme}>
			<SectionEditScreen />
		</PaperProvider>,
	);
	await fireEvent.press(screen.getByText("Practice history"));
	expect(mockPush).toHaveBeenCalledWith({
		pathname: "/piece/[id]/history",
		params: { id: "piece", sectionId: "coda" },
	});
});

it("does not offer history while adding a new section", async () => {
	mockSectionId = "new";
	const screen = await render(
		<PaperProvider theme={lightTheme}>
			<SectionEditScreen />
		</PaperProvider>,
	);
	expect(screen.queryByText("Practice history")).toBeNull();
});
