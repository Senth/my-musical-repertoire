import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import OverviewScreen from "@/app/(app)/(tabs)/overview";
import TechniquesScreen from "@/app/(app)/(tabs)/technique";
import SightReadingHistoryScreen from "@/app/(app)/sight-reading/history";
import type { TechniqueItem } from "@/models/technique";
import { darkTheme, lightTheme } from "@/theme";
import type { TechniqueFilters } from "@/utils/list-filtering";

const mockPush = jest.fn();
const mockProgress = jest.fn((_scope: unknown, _range: unknown) => ({
	series: [],
	loading: false,
	error: null,
}));
jest.mock("@/hooks/use-progress-series", () => ({
	useProgressSeries: (scope: unknown, range: unknown) =>
		mockProgress(scope, range),
}));
const mockBack = jest.fn();
const mockSetOptions = jest.fn();
let mockCompact = true;
let mockTechniques: TechniqueItem[] = [];
let mockFilters: TechniqueFilters | undefined;
let mockLoading = false;
let mockHasAny: boolean | undefined = true;
let mockHasPracticedTechnique: boolean | undefined = false;
let mockInstallPromptAvailable = false;
let mockInstallDismissed = true;
const mockHasAnyTechnique = jest.fn((enabled: boolean) =>
	enabled ? mockHasAny : undefined,
);

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, canGoBack: () => true, back: mockBack }),
	useNavigation: () => ({ setOptions: mockSetOptions }),
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		jest
			.requireActual<typeof import("react")>("react")
			.useEffect(effect, [effect]);
	},
}));
jest.mock("expo-router/js-tabs", () => ({
	useBottomTabBarHeight: () => 0,
}));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: { uid: "u" } }),
}));
jest.mock("@/hooks/use-techniques", () => ({
	useTechniquesByState: () => ({
		techniques: mockTechniques,
		loading: mockLoading,
	}),
	useTechniquesByType: () => ({ techniques: [], loading: false }),
	useHasAnyTechnique: (enabled: boolean) => mockHasAnyTechnique(enabled),
	useHasPracticedTechnique: () => mockHasPracticedTechnique,
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
	useInstallPrompt: () => ({
		promptAvailable: mockInstallPromptAvailable,
		standalone: false,
	}),
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
		prefs: mockFilters ? { ...defaults, filters: mockFilters } : defaults,
		setPrefs: jest.fn(),
	}),
}));
jest.mock("@/utils/session-storage", () => ({
	readActiveSession: jest.fn().mockResolvedValue(null),
	readInstallPromptDismissed: jest.fn(() =>
		Promise.resolve(mockInstallDismissed),
	),
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
	mockFilters = undefined;
	mockLoading = false;
	mockHasAny = true;
	mockHasPracticedTechnique = false;
	mockInstallPromptAvailable = false;
	mockInstallDismissed = true;
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
		mockFilters = { states: ["retired"], types: [] };
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
		mockHasAny = false;
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

it("keeps settled technique rows through Status changes and waits for the empty-library probe", async () => {
	mockLoading = true;
	const view = () => (
		<PaperProvider theme={lightTheme}>
			<TechniquesScreen />
		</PaperProvider>
	);
	const screen = await render(view());
	expect(screen.getByRole("progressbar")).toBeTruthy();
	mockLoading = false;
	await screen.rerender(view());
	expect(screen.getByText("C major scale")).toBeTruthy();

	mockFilters = { states: ["retired"], types: [] };
	mockLoading = true;
	await screen.rerender(view());
	expect(screen.getByText("C major scale")).toBeTruthy();
	expect(screen.queryByRole("progressbar")).toBeNull();
	expect(mockHasAnyTechnique).toHaveBeenLastCalledWith(false);

	mockTechniques = [];
	mockLoading = false;
	mockHasAny = undefined;
	await screen.rerender(view());
	expect(mockHasAnyTechnique).toHaveBeenLastCalledWith(true);
	expect(screen.queryByText("No techniques yet")).toBeNull();
	expect(screen.queryByText("No techniques match your filters")).toBeNull();

	mockHasAny = true;
	mockFilters = { states: [], types: [] };
	await screen.rerender(view());
	expect(screen.getByText("No techniques match your filters")).toBeTruthy();
	expect(screen.queryByText("No techniques yet")).toBeNull();

	mockHasAny = false;
	await screen.rerender(view());
	expect(screen.getByRole("button", { name: "Add technique" })).toBeTruthy();
});

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
		expect(mockProgress).toHaveBeenLastCalledWith(
			{ type: "sight-reading" },
			"3m",
		);
		await fireEvent.press(history.getByRole("button", { name: "Back" }));
		expect(mockBack).toHaveBeenCalledTimes(1);
	},
);

it("preserves install eligibility when only a retired technique was practiced", async () => {
	mockTechniques = [];
	mockHasPracticedTechnique = true;
	mockInstallPromptAvailable = true;
	mockInstallDismissed = false;
	const screen = await render(
		<PaperProvider theme={lightTheme}>
			<OverviewScreen />
		</PaperProvider>,
	);

	await waitFor(() =>
		expect(screen.getByText("Install Repertoire")).toBeTruthy(),
	);
});
