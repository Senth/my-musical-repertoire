import { render } from "@testing-library/react-native";
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
jest.mock("./MetronomeButton", () => ({ MetronomeButton: () => null }));

jest.mock("@react-native-community/slider", () => {
	const { View } = require("react-native");
	const MockSlider = () => <View testID="tempo-slider" />;
	return { __esModule: true, default: MockSlider };
});

function renderTempo(value: string, onChangeText = jest.fn()) {
	const onBlur = jest.fn();
	const screen = render(
		<TempoControl
			value={value}
			onChangeText={onChangeText}
			error={null}
			onBlur={onBlur}
		/>,
	);
	return { screen, onChangeText, onBlur };
}

describe("TempoControl with no BPM set", () => {
	it("displays the slider minimum, not a blank", () => {
		const { screen } = renderTempo("");
		expect(screen.getByText("20")).toBeTruthy();
	});

	it("never pushes the displayed default upward — an untouched tempo stays unset", () => {
		const { onChangeText } = renderTempo("");
		expect(onChangeText).not.toHaveBeenCalled();
		// The save path reads the same empty draft: no tempo, not 20.
		expect(parseBpm("")).toBeNull();
	});

	it("still displays the typed tempo when one is set", () => {
		const { screen, onChangeText } = renderTempo("96");
		expect(screen.getByText("96")).toBeTruthy();
		expect(onChangeText).not.toHaveBeenCalled();
	});
});
