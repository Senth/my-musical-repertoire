import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import { HistoryLink } from "@/components/history/HistoryLink";
import { SightReadingHistoryLink } from "@/components/history/SightReadingHistoryLink";
import { fetchLastSightReading } from "@/hooks/use-sight-reading-logs";
import type { SightReadingLog } from "@/models/sight-reading";
import { darkTheme, lightTheme } from "@/theme";

const mockPush = jest.fn();
let mockUser: { uid: string } | null = { uid: "u" };
let mockFocus: () => undefined | (() => void);
let mockBlur: () => void;

jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: mockUser }),
}));
jest.mock("@/hooks/use-sight-reading-logs", () => ({
	fetchLastSightReading: jest.fn(),
}));
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const { useEffect } = jest.requireActual<typeof import("react")>("react");
		useEffect(() => {
			mockFocus = effect;
			mockBlur = effect() ?? (() => {});
			return () => mockBlur();
		}, [effect]);
	},
}));

const log = (date: Date): SightReadingLog => ({
	date,
	elapsedSeconds: 180,
	achievedBpm: 60,
	keptGoing: null,
});
const twoDaysAgo = new Date();
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
const row = (theme = lightTheme) => (
	<PaperProvider theme={theme}>
		<SightReadingHistoryLink />
	</PaperProvider>
);

beforeEach(() => {
	jest.clearAllMocks();
	mockUser = { uid: "u" };
	jest
		.mocked(fetchLastSightReading)
		.mockReset()
		.mockResolvedValue(log(twoDaysAgo));
});

it.each([
	lightTheme,
	darkTheme,
])("shows recency and opens history through the shared link", async (theme) => {
	const screen = await render(row(theme));
	await waitFor(() =>
		expect(screen.getByText("Last read 2 days ago")).toBeTruthy(),
	);
	expect(fetchLastSightReading).toHaveBeenCalledTimes(1);
	expect(fetchLastSightReading).toHaveBeenCalledWith("u");
	await fireEvent.press(
		screen.getByRole("link", { name: "Sight-reading history" }),
	);
	expect(mockPush).toHaveBeenCalledWith("/sight-reading/history");
});

it("shows Not read yet only after a successful empty read", async () => {
	jest.mocked(fetchLastSightReading).mockResolvedValue(null);
	const screen = await render(row());
	await waitFor(() => expect(screen.getByText("Not read yet")).toBeTruthy());
	expect(screen.queryByText("Never practiced")).toBeNull();
});

it("refreshes last read after returning from a session without a reload", async () => {
	const screen = await render(row());
	await waitFor(() =>
		expect(screen.getByText("Last read 2 days ago")).toBeTruthy(),
	);
	jest.mocked(fetchLastSightReading).mockResolvedValueOnce(log(new Date()));
	await act(() => {
		mockBlur();
		mockBlur = mockFocus() ?? (() => {});
	});
	await waitFor(() => expect(screen.getByText("Last read Today")).toBeTruthy());
	expect(fetchLastSightReading).toHaveBeenCalledTimes(2);
});

it("does not show another user's recency or commit a blurred request", async () => {
	let resolve!: (value: SightReadingLog | null) => void;
	jest.mocked(fetchLastSightReading).mockImplementationOnce(
		() =>
			new Promise((done) => {
				resolve = done;
			}),
	);
	const screen = await render(row());
	expect(screen.queryByText("Not read yet")).toBeNull();
	mockUser = { uid: "other" };
	jest.mocked(fetchLastSightReading).mockResolvedValueOnce(null);
	await screen.rerender(row());
	await waitFor(() => expect(screen.getByText("Not read yet")).toBeTruthy());
	await act(() => {
		resolve(log(twoDaysAgo));
	});
	expect(screen.queryByText("Last read 2 days ago")).toBeNull();
	expect(fetchLastSightReading).toHaveBeenLastCalledWith("other");
	mockUser = null;
	await screen.rerender(row());
	expect(screen.queryByText("Not read yet")).toBeNull();
	expect(fetchLastSightReading).toHaveBeenCalledTimes(2);
});

it("keeps history accessible after a failed read without claiming no practice", async () => {
	jest
		.mocked(fetchLastSightReading)
		.mockRejectedValueOnce(new Error("permission-denied"));
	const screen = await render(row());
	await act(async () => {});
	expect(screen.queryByText("Not read yet")).toBeNull();
	await fireEvent.press(
		screen.getByRole("link", { name: "Sight-reading history" }),
	);
	expect(mockPush).toHaveBeenCalledWith("/sight-reading/history");
	await act(() => {
		mockBlur();
		mockBlur = mockFocus() ?? (() => {});
	});
	await waitFor(() =>
		expect(screen.getByText("Last read 2 days ago")).toBeTruthy(),
	);
});

it("preserves the existing Practice history link when title and description are omitted", async () => {
	const onPress = jest.fn();
	const screen = await render(
		<PaperProvider>
			<HistoryLink onPress={onPress} />
		</PaperProvider>,
	);
	await fireEvent.press(screen.getByRole("link", { name: "Practice history" }));
	expect(onPress).toHaveBeenCalledTimes(1);
});
