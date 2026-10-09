import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { addDoc } from "firebase/firestore";
import { useRef } from "react";
import { Platform } from "react-native";
import { SightReadingBlockBody } from "@/components/practice/SightReadingBlockBody";
import { CoachProvider } from "@/contexts/CoachContext";
import "@/i18n";
import { readSightReadingBpm } from "@/utils/session-storage";

jest.mock("@/config/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
	addDoc: jest.fn().mockResolvedValue({ id: "sr1" }),
	collection: jest.fn((_db, ...path: string[]) => ({ path: path.join("/") })),
	Timestamp: { fromDate: (date: Date) => ({ toDate: () => date }) },
}));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: { uid: "u1" } }),
}));
jest.mock("@/utils/session-storage", () => ({
	readSightReadingBpm: jest.fn().mockResolvedValue(null),
	readSightReadingSignature: jest.fn().mockResolvedValue(null),
	writeSightReadingBpm: jest.fn().mockResolvedValue(undefined),
	writeSightReadingSignature: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/components/practice/TempoControl", () => {
	const { TextInput } = require("react-native");
	return {
		TempoControl: (props: {
			value: string;
			onChangeText: (text: string) => void;
		}) => <TextInput accessibilityLabel="BPM" {...props} />,
	};
});
jest.mock("@/components/ui/ErrorSnackbar", () => {
	const { Text } = require("react-native");
	return {
		ErrorSnackbar: ({ error }: { error: string | null }) =>
			error ? <Text>{error}</Text> : null,
	};
});

const advance = jest.fn();
const skip = jest.fn();
const extend = jest.fn();
const noop = () => {};

function Harness({ elapsedSeconds = 180 }: { elapsedSeconds?: number }) {
	const saveHandlerRef = useRef<(() => Promise<{ saved: boolean }>) | null>(
		null,
	);
	return (
		<CoachProvider
			inCoach
			sessionId="session1"
			saveHandlerRef={saveHandlerRef}
			validateHandlerRef={{ current: null }}
			stateOfferRef={{ current: null }}
			notify={noop}
			setHeading={noop}
			saveAndNext={async () => {
				const result = await saveHandlerRef.current?.();
				if (result?.saved) advance();
			}}
			skipBlock={skip}
			extendBlock={extend}
			saving={false}
		>
			<SightReadingBlockBody
				elapsedSeconds={elapsedSeconds}
				stopRef={{ current: null }}
			/>
		</CoachProvider>
	);
}

beforeEach(() => {
	jest.clearAllMocks();
});

afterEach(() => {
	jest.restoreAllMocks();
	Object.defineProperty(navigator, "onLine", {
		value: true,
		configurable: true,
	});
});

describe("SightReadingBlockBody save", () => {
	it("starts unrated and saves one log before advancing without a rating", async () => {
		const screen = await render(<Harness />);
		expect(screen.getByText("not rated yet")).toBeTruthy();
		for (const label of ["Stalled", "Halting", "Bumpy", "Steady", "Flowed"]) {
			expect(
				screen.getByRole("button", { name: label }).props.accessibilityState
					.checked,
			).toBe(false);
		}
		await fireEvent.press(screen.getByText("Save & next"));
		await waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
		expect(addDoc).toHaveBeenCalledTimes(1);
		expect(addDoc).toHaveBeenCalledWith(
			{ path: "users/u1/sightReadingLogs" },
			{
				date: expect.anything(),
				elapsedSeconds: 180,
				achievedBpm: null,
				keptGoing: null,
			},
		);
	});

	it("saves the selected rating, current tempo, and latest elapsed time", async () => {
		const screen = await render(<Harness />);
		await fireEvent.changeText(screen.getByLabelText("BPM"), "72");
		await fireEvent.press(screen.getByText("Bumpy"));
		expect(screen.getByText("A few stops")).toBeTruthy();
		await screen.rerender(<Harness elapsedSeconds={192} />);
		await fireEvent.press(screen.getByText("Save & next"));
		await waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
		expect(addDoc).toHaveBeenCalledWith(
			{ path: "users/u1/sightReadingLogs" },
			expect.objectContaining({
				elapsedSeconds: 192,
				achievedBpm: 72,
				keptGoing: 3,
			}),
		);
	});

	it.each([
		"",
		"abc",
		"500",
	])("saves invalid or empty tempo %p as null without blocking", async (bpm) => {
		const screen = await render(<Harness />);
		await fireEvent.changeText(screen.getByLabelText("BPM"), bpm);
		await fireEvent.press(screen.getByText("Save & next"));
		await waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
		expect(addDoc).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ achievedBpm: null }),
		);
	});

	it("saves the remembered tempo without requiring another edit", async () => {
		jest.mocked(readSightReadingBpm).mockResolvedValueOnce("80");
		const screen = await render(<Harness />);
		await waitFor(() =>
			expect(screen.getByLabelText("BPM").props.value).toBe("80"),
		);
		await fireEvent.press(screen.getByText("Save & next"));
		await waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
		expect(addDoc).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ achievedBpm: 80, keptGoing: null }),
		);
	});

	it("advances offline while the server acknowledgement stays pending", async () => {
		const screen = await render(<Harness />);
		jest.replaceProperty(Platform, "OS", "web");
		Object.defineProperty(navigator, "onLine", {
			value: false,
			configurable: true,
		});
		jest.mocked(addDoc).mockReturnValueOnce(new Promise(() => {}));
		await fireEvent.press(screen.getByText("Save & next"));
		await waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
		expect(addDoc).toHaveBeenCalledTimes(1);
	});

	it("shows a write error, stays on the block, and allows retry", async () => {
		jest.mocked(addDoc).mockRejectedValueOnce(new Error("permission-denied"));
		const screen = await render(<Harness />);
		await fireEvent.press(screen.getByText("Save & next"));
		await waitFor(() =>
			expect(screen.getByText("Connection to Firebase failed")).toBeTruthy(),
		);
		expect(advance).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("Save & next"));
		await waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
		expect(screen.queryByText("Connection to Firebase failed")).toBeNull();
	});

	it("does not write a log for Skip or +2 min", async () => {
		const screen = await render(<Harness />);
		await fireEvent.press(screen.getByText("+2 min"));
		expect(extend).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByText("Skip"));
		expect(skip).toHaveBeenCalledTimes(1);
		expect(addDoc).not.toHaveBeenCalled();
	});
});
