import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import OverviewScreen from "@/app/(app)/(tabs)/overview";
import TechniquesScreen from "@/app/(app)/(tabs)/technique";
import SightReadingHistoryScreen from "@/app/(app)/sight-reading/history";
import type { TechniqueItem } from "@/models/technique";
import { darkTheme, lightTheme } from "@/theme";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockSetOptions = jest.fn();
let mockCompact = true;
let mockTechniques: TechniqueItem[] = [];
let mockFiltered = false;

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, canGoBack: () => true, back: mockBack }),
	useNavigation: () => ({ setOptions: mockSetOptions }),
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		jest
			.requireActual<typeof import("react")>("react")
			.useEffect(effect, [effect]);
	},
}));
jest.mock("@react-navigation/bottom-tabs", () => ({
	useBottomTabBarHeight: () => 0,
}));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: { uid: "u" } }),
}));
jest.mock("@/hooks/use-techniques", () => ({
	useTechniques: () => ({ techniques: mockTechniques, loading: false }),
	useDeleteTechnique: () => ({ deleteTechnique: jest.fn() }),
}));
jest.mock("@/hooks/use-pieces", () => ({
	usePieces: () => ({ pieces: [], loading: false }),
}));
jest.mock("@/hooks/use-sections", () => ({
	useAllSections: () => ({ sections: [], loading: false }),
}));
jest.mock("@/hooks/use-session-presets", () => ({
	useSessionPresets: () => ({ presets: [], scratch: null, loading: false }),
	useSessionPresetActions: () => ({
		addPreset: jest.fn(),
		deletePreset: jest.fn(),
	}),
}));
jest.mock("@/hooks/use-install-prompt", () => ({
	useInstallPrompt: () => ({ promptAvailable: false, standalone: false }),
}));
jest.mock("@/hooks/use-fab-visible", () => ({ useFabVisible: () => false }));
jest.mock("@/hooks/use-fab-style", () => ({ useFabStyleTabs: () => ({}) }));
jest.mock("@/hooks/use-is-compact", () => ({
	useIsCompact: () => mockCompact,
}));
jest.mock("@/hooks/use-page-inset", () => ({
	usePageInset: () => {
		const { inset } = jest.requireActual("@/theme/tokens");
		return mockCompact ? inset.compact : inset.roomy;
	},
}));
jest.mock("@/hooks/use-list-prefs", () => ({
	useListPrefs: (
		defaults: typeof import("@/utils/list-prefs").DEFAULT_TECHNIQUE_LIST_PREFS,
	) => ({
		prefs: mockFiltered
			? { ...defaults, filters: { ...defaults.filters, states: ["dormant"] } }
			: defaults,
		setPrefs: jest.fn(),
	}),
}));
jest.mock("@/utils/session-storage", () => ({
	readActiveSession: jest.fn().mockResolvedValue(null),
	readInstallPromptDismissed: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/hooks/use-sight-reading-logs", () => ({
	fetchLastSightReading: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/hooks/use-sight-reading-history", () => ({
	useSightReadingHistory: () => ({
		entries: [],
		loading: false,
		hasMore: false,
		error: null,
		loadMore: jest.fn(),
	}),
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockCompact = true;
	mockFiltered = false;
	mockTechniques = [
		{
			id: "scale",
			userId: "u",
			title: "C major scale",
			state: "active",
			type: "scale",
			dateIntroduced: new Date(),
		},
	];
});

it.each([
	[true, lightTheme],
	[false, darkTheme],
] as const)(
	"keeps technique history available with populated, searched, filtered and empty lists",
	async (compact, theme) => {
		mockCompact = compact;
		const screen = await render(
			<PaperProvider theme={theme}>
				<TechniquesScreen />
			</PaperProvider>,
		);
		await waitFor(() => expect(screen.getByText("Not read yet")).toBeTruthy());
		await fireEvent.press(
			screen.getByRole("link", { name: "Sight-reading history" }),
		);
		expect(mockPush).toHaveBeenCalledWith("/sight-reading/history");
		await fireEvent.changeText(
			screen.getByPlaceholderText("Search techniques..."),
			"no matching technique",
		);
		expect(screen.queryByText("C major scale")).toBeNull();
		expect(
			screen.getByRole("link", { name: "Sight-reading history" }),
		).toBeTruthy();
		await fireEvent.changeText(
			screen.getByPlaceholderText("Search techniques..."),
			"",
		);
		mockFiltered = true;
		await screen.rerender(
			<PaperProvider theme={theme}>
				<TechniquesScreen />
			</PaperProvider>,
		);
		expect(screen.queryByText("C major scale")).toBeNull();
		expect(
			screen.getByRole("link", { name: "Sight-reading history" }),
		).toBeTruthy();
		mockTechniques = [];
		await screen.rerender(
			<PaperProvider theme={theme}>
				<TechniquesScreen />
			</PaperProvider>,
		);
		expect(screen.getByRole("button", { name: "Add technique" })).toBeTruthy();
		await fireEvent.press(
			screen.getByRole("link", { name: "Sight-reading history" }),
		);
		expect(mockPush).toHaveBeenCalledTimes(2);
	},
);

it.each([lightTheme, darkTheme])(
	"opens history from Overview and returns through stack back",
	async (theme) => {
		const screen = await render(
			<PaperProvider theme={theme}>
				<OverviewScreen />
			</PaperProvider>,
		);
		await waitFor(() => expect(screen.getByText("Not read yet")).toBeTruthy());
		expect(screen.getByText("See all techniques")).toBeTruthy();
		await fireEvent.press(
			screen.getByRole("link", { name: "Sight-reading history" }),
		);
		expect(mockPush).toHaveBeenCalledWith("/sight-reading/history");
		await screen.unmount();
		const history = await render(
			<PaperProvider theme={theme}>
				<SightReadingHistoryScreen />
			</PaperProvider>,
		);
		await fireEvent.press(history.getByRole("button", { name: "Back" }));
		expect(mockBack).toHaveBeenCalledTimes(1);
	},
);
