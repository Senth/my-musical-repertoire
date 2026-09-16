import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { useServiceWorker } from "./use-service-worker.web";

type ServiceWorkerHook = ReturnType<typeof useServiceWorker>;
type Listener = () => void;

const REAL_NODE_ENV = process.env.NODE_ENV;
// The hook does all of its work behind `NODE_ENV === "production"`, so the
// test has to look like a deployed bundle to exercise it at all.
beforeAll(() => {
	(process.env as { NODE_ENV?: string }).NODE_ENV = "production";
});
afterAll(() => {
	(process.env as { NODE_ENV?: string }).NODE_ENV = REAL_NODE_ENV;
});

// `buildId` falls back to "dev" with EXPO_PUBLIC_BUILD unset, as in a local build.
const FRESH = '<meta name="build" content="dev">';
const STALE = '<meta name="build" content="2026-01-01 · dead1234">';
const ok = (body: string) => ({ text: async () => body });

const RELOADED_FLAG = "build-reload";
const store = new Map<string, string>();
const reload = jest.fn();
const fetchMock = jest.fn();

type ServiceWorkerContainerStub = {
	register: () => Promise<void>;
	addEventListener: (type: string, listener: Listener) => void;
	removeEventListener: (type: string, listener: Listener) => void;
};

const swListeners = new Map<string, Set<Listener>>();
const serviceWorker: ServiceWorkerContainerStub = {
	register: () => Promise.resolve(),
	addEventListener: (type, listener) => {
		const set = swListeners.get(type) ?? new Set<Listener>();
		set.add(listener);
		swListeners.set(type, set);
	},
	removeEventListener: (type, listener) => {
		swListeners.get(type)?.delete(listener);
	},
};

// The React Native test env has stub globals with no event or storage support.
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
	Object.defineProperty(navigator, "serviceWorker", {
		value: serviceWorker,
		configurable: true,
	});
	Object.defineProperty(globalThis, "sessionStorage", {
		value: {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => void store.set(key, value),
			removeItem: (key: string) => void store.delete(key),
		},
		configurable: true,
	});
	Object.defineProperty(window, "location", {
		value: { reload },
		configurable: true,
	});
	Object.defineProperty(globalThis, "fetch", {
		value: fetchMock,
		configurable: true,
	});
});

let now = 0;
const nowSpy = jest.spyOn(Date, "now");

// The spy stays installed for the whole file; only its implementation turns
// over, because `mockRestore` detaches it and a detached spy cannot be
// re-armed.
beforeAll(() => {
	nowSpy.mockImplementation(() => now);
});

beforeEach(() => {
	store.clear();
	reload.mockClear();
	fetchMock.mockReset();
	now = 0;
});

afterEach(() => {
	listeners.clear();
	swListeners.clear();
});

afterAll(() => {
	nowSpy.mockRestore();
});

const flush = async () => {
	await act(async () => {
		for (let i = 0; i < 4; i++) await Promise.resolve();
	});
};

async function fire(type: string) {
	await act(() => {
		for (const listener of listeners.get(type) ?? []) listener();
	});
}

function Probe({ onValue }: { onValue: (v: ServiceWorkerHook) => void }) {
	onValue(useServiceWorker());
	return <Text>probe</Text>;
}

describe("useServiceWorker", () => {
	it("reloads a stale shell once at boot, then the flap guard holds", async () => {
		fetchMock.mockResolvedValue(ok(STALE));
		await render(<Probe onValue={jest.fn()} />);
		await flush();

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/?build-check="),
			{ cache: "no-store" },
		);
		expect(reload).toHaveBeenCalledTimes(1);
		expect(store.get(RELOADED_FLAG)).toBe("1");

		await fire("online");
		await flush();
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it("does nothing on a fresh shell", async () => {
		fetchMock.mockResolvedValue(ok(FRESH));
		const onValue = jest.fn();
		await render(<Probe onValue={onValue} />);
		await flush();

		expect(reload).not.toHaveBeenCalled();
		expect(onValue.mock.calls.at(-1)?.[0].updateReady).toBe(false);
		expect(store.size).toBe(0);
	});

	it("is silent about a failed check, as a boot with no network is", async () => {
		fetchMock.mockRejectedValue(new TypeError("network down"));
		const onValue = jest.fn();
		await render(<Probe onValue={onValue} />);
		await flush();

		expect(reload).not.toHaveBeenCalled();
		expect(onValue.mock.calls.at(-1)?.[0].updateReady).toBe(false);
	});

	it("offers the banner after the boot window and reloads only on tap", async () => {
		fetchMock.mockResolvedValue(ok(FRESH));
		const onValue = jest.fn();
		await render(<Probe onValue={onValue} />);
		await flush();

		now = 11_000;
		fetchMock.mockResolvedValue(ok(STALE));
		await fire("online");
		await flush();

		const hook = onValue.mock.calls.at(-1)?.[0] as ServiceWorkerHook;
		expect(hook.updateReady).toBe(true);
		expect(reload).not.toHaveBeenCalled();

		await act(async () => {
			hook.applyUpdate();
		});
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it("suppresses the auto reload when a previous page load already reloaded", async () => {
		store.set(RELOADED_FLAG, "1");
		fetchMock.mockResolvedValue(ok(STALE));
		const onValue = jest.fn();
		await render(<Probe onValue={onValue} />);
		await flush();

		expect(reload).not.toHaveBeenCalled();
		expect(onValue.mock.calls.at(-1)?.[0].updateReady).toBe(false);
	});
});
