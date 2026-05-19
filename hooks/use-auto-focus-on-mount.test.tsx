import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { useAutoFocusOnMount } from "./use-auto-focus-on-mount";

jest.mock("expo-router", () => ({
	useFocusEffect: (cb: () => (() => void) | undefined) => {
		const React = require("react");
		React.useEffect(() => cb(), []);
	},
}));

function Probe({ focus, enabled }: { focus: jest.Mock; enabled?: boolean }) {
	const ref = useAutoFocusOnMount<{ focus: () => void }>(enabled ?? true);
	ref.current = { focus };
	return <Text>probe</Text>;
}

describe("useAutoFocusOnMount", () => {
	let rafCallbacks: Array<FrameRequestCallback> = [];
	let rafId = 0;

	beforeEach(() => {
		rafCallbacks = [];
		rafId = 0;
		jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
			rafId += 1;
			rafCallbacks.push(cb);
			return rafId;
		});
		jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
	});

	afterEach(() => jest.restoreAllMocks());

	function flushRaf() {
		const next = rafCallbacks.shift();
		if (next) act(() => next(performance.now()));
	}

	it("calls focus once, after two animation frames", () => {
		const focus = jest.fn();
		render(<Probe focus={focus} />);
		expect(focus).not.toHaveBeenCalled();
		flushRaf();
		expect(focus).not.toHaveBeenCalled();
		flushRaf();
		expect(focus).toHaveBeenCalledTimes(1);
	});

	it("does not call focus when disabled", () => {
		const focus = jest.fn();
		render(<Probe focus={focus} enabled={false} />);
		flushRaf();
		flushRaf();
		expect(focus).not.toHaveBeenCalled();
	});
});
