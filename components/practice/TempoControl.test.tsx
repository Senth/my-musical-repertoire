import type { MutableRefObject } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import "@/i18n";
import { parseBpm } from "@/hooks/use-mode-drafts";
import { TempoControl } from "./TempoControl";

jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: { uid: "u1" } }),
}));

jest.mock("@/utils/session-storage", () => ({
	readMetronomeAccent: jest.fn().mockResolvedValue(false),
	writeMetronomeAccent: jest.fn().mockResolvedValue(undefined),
}));

// Paper's HelperText animates through react-native's bundled Animated node,
// whose renderer version-check throws against react 19.2.6 under jest — a
// dependency-tree skew nothing rendered into before this test. A plain Text
// renders the same output for the assertions here.
jest.mock("react-native-paper", () => {
	const actual = jest.requireActual("react-native-paper");
	const { Text } = require("react-native");
	return {
		...actual,
		HelperText: ({
			children,
			visible,
		}: {
			children: React.ReactNode;
			visible: boolean;
		}) => (visible ? <Text>{children}</Text> : null),
	};
});

jest.mock("./AccentChip", () => ({ AccentChip: () => null }));

// A probe rather than a plain null: what the untouched default feeds the
// metronome is part of the enabled-at-default contract.
const mockMetronomeProbe: {
	bpm: string | undefined;
	disabled: boolean | undefined;
} = { bpm: undefined, disabled: undefined };
jest.mock("./MetronomeButton", () => ({
	MetronomeButton: (props: { bpm: string; disabled: boolean }) => {
		mockMetronomeProbe.bpm = props.bpm;
		mockMetronomeProbe.disabled = props.disabled;
		return null;
	},
}));

jest.mock("@react-native-community/slider", () => {
	const { View } = require("react-native");
	const MockSlider = () => <View testID="tempo-slider" />;
	return { __esModule: true, default: MockSlider };
});

async function renderTempo(
	value: string,
	onChangeText = jest.fn(),
	stopRef?: MutableRefObject<(() => void) | null>,
) {
	const onBlur = jest.fn();
	const screen = await render(
		<TempoControl
			value={value}
			onChangeText={onChangeText}
			error={null}
			onBlur={onBlur}
			stopRef={stopRef}
		/>,
	);
	return { screen, onChangeText, onBlur };
}

describe("TempoControl with no BPM set", () => {
	it("displays the slider minimum, not a blank", async () => {
		const { screen } = await renderTempo("");
		expect(screen.getByText("20")).toBeTruthy();
	});

	it("never pushes the displayed default upward — an untouched tempo stays unset", async () => {
		const { onChangeText } = await renderTempo("");
		expect(onChangeText).not.toHaveBeenCalled();
		// The save path reads the same empty draft: no tempo, not 20.
		expect(parseBpm("")).toBeNull();
	});

	it("still displays the typed tempo when one is set", async () => {
		const { screen, onChangeText } = await renderTempo("96");
		expect(screen.getByText("96")).toBeTruthy();
		expect(onChangeText).not.toHaveBeenCalled();
	});
});

describe("TempoControl at the untouched default of 20", () => {
	const enabled = (el: { props: { disabled?: boolean } }) =>
		el.props.disabled !== true;

	it("keeps all four steppers live", async () => {
		const { screen } = await renderTempo("");
		for (const label of [
			"Decrease BPM by 5",
			"Decrease BPM by 1",
			"Increase BPM by 1",
			"Increase BPM by 5",
		]) {
			expect(enabled(screen.getByLabelText(label))).toBe(true);
		}
	});

	it("steps up from 20 with +1", async () => {
		const { screen, onChangeText } = await renderTempo("");
		fireEvent.press(screen.getByLabelText("Increase BPM by 1"));
		expect(onChangeText).toHaveBeenCalledWith("21");
	});

	it("feeds the metronome the untouched 20, enabled", async () => {
		await renderTempo("", jest.fn(), { current: null });
		expect(mockMetronomeProbe.bpm).toBe("20");
		expect(mockMetronomeProbe.disabled).toBe(false);
	});

	it("still saves no tempo when nothing was touched", async () => {
		const { onChangeText } = await renderTempo("");
		expect(onChangeText).not.toHaveBeenCalled();
		expect(parseBpm("")).toBeNull();
	});
});
