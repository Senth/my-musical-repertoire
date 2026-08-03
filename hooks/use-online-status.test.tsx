import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { useOnlineStatus } from "./use-online-status";

// The hook is web-only behaviour; the default Jest platform is native.
jest.mock("react-native/Libraries/Utilities/Platform", () => ({
	__esModule: true,
	default: {
		OS: "web",
		select: (spec: Record<string, unknown>) => spec.web ?? spec.default,
	},
}));

type Listener = () => void;

/** The React Native test env has a `window` stub with no event support. */
const listeners = new Map<string, Set<Listener>>();

beforeAll(() => {
	Object.assign(window, {
		addEventListener: (type: string, listener: Listener) => {
			const set = listeners.get(type) ?? new Set<Listener>();
			set.add(listener);
			listeners.set(type, set);
		},
		removeEventListener: (type: string, listener: Listener) => {
			listeners.get(type)?.delete(listener);
		},
	});
});

afterEach(() => {
	listeners.clear();
	setOnLine(true);
});

function setOnLine(value: boolean) {
	Object.defineProperty(navigator, "onLine", {
		value,
		configurable: true,
		writable: true,
	});
}

function fire(type: "online" | "offline") {
	act(() => {
		for (const listener of listeners.get(type) ?? []) listener();
	});
}

function Probe({ onValue }: { onValue: (v: boolean) => void }) {
	onValue(useOnlineStatus());
	return <Text>probe</Text>;
}

describe("useOnlineStatus", () => {
	it("seeds from navigator.onLine", () => {
		setOnLine(false);
		const onValue = jest.fn();
		render(<Probe onValue={onValue} />);
		expect(onValue).toHaveBeenLastCalledWith(false);
	});

	it("goes offline on the offline event and back on the online event", () => {
		setOnLine(true);
		const onValue = jest.fn();
		render(<Probe onValue={onValue} />);
		expect(onValue).toHaveBeenLastCalledWith(true);

		fire("offline");
		expect(onValue).toHaveBeenLastCalledWith(false);

		fire("online");
		expect(onValue).toHaveBeenLastCalledWith(true);
	});

	it("stops listening once unmounted", () => {
		const view = render(<Probe onValue={jest.fn()} />);
		view.unmount();
		expect(listeners.get("offline")?.size ?? 0).toBe(0);
		expect(listeners.get("online")?.size ?? 0).toBe(0);
	});
});
