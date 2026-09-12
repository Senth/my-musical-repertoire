import { Platform } from "react-native";
import { playBlockEndCue } from "./session-cue";

// react-native 0.86 stopped routing `react-native`'s Platform export through
// the deep `Libraries/Utilities/Platform` path, so mock the public module.
jest.mock("react-native", () => ({
	__esModule: true,
	Platform: { OS: "web" },
}));

const setOS = (os: string) => {
	(Platform as { OS: string }).OS = os;
};

function fakeAudioContext() {
	const log: string[] = [];
	let closed = 0;
	const gain = {
		connect: () => log.push("gain.connect"),
		gain: {
			setValueAtTime: () => log.push("gain.set"),
			exponentialRampToValueAtTime: () => log.push("gain.ramp"),
		},
	};
	const osc = {
		type: "",
		frequency: {
			setValueAtTime: () => log.push("freq.set"),
			exponentialRampToValueAtTime: () => log.push("freq.ramp"),
		},
		connect: () => log.push("osc.connect"),
		start: () => log.push("osc.start"),
		stop: () => log.push("osc.stop"),
	};
	return {
		log,
		ctx: {
			currentTime: 0,
			destination: {},
			createOscillator: () => osc,
			createGain: () => gain,
			close: () => {
				closed += 1;
				return Promise.resolve();
			},
		},
		closeCount: () => closed,
	};
}

describe("playBlockEndCue", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		setOS("web");
		delete (globalThis as { window?: unknown }).window;
	});

	it("plays a fading tone on web and closes the context", () => {
		const audio = fakeAudioContext();
		(globalThis as { window?: object }).window = {
			AudioContext: () => audio.ctx,
		};

		playBlockEndCue();

		expect(audio.log).toEqual([
			"freq.set",
			"freq.ramp",
			"gain.set",
			"gain.ramp",
			"gain.ramp",
			"osc.connect",
			"gain.connect",
			"osc.start",
			"osc.stop",
		]);
		jest.advanceTimersByTime(800);
		expect(audio.closeCount()).toBe(1);
	});

	it("falls back to webkitAudioContext", () => {
		const audio = fakeAudioContext();
		(globalThis as { window?: object }).window = {
			webkitAudioContext: () => audio.ctx,
		};

		playBlockEndCue();

		expect(audio.log).toContain("osc.start");
	});

	it("stays quiet off-web", () => {
		setOS("ios");
		const ctor = jest.fn();
		(globalThis as { window?: object }).window = { AudioContext: ctor };

		playBlockEndCue();

		expect(ctor).not.toHaveBeenCalled();
	});

	it("stays quiet without an AudioContext", () => {
		(globalThis as { window?: object }).window = {};

		expect(() => playBlockEndCue()).not.toThrow();
	});

	it("swallows audio errors", () => {
		(globalThis as { window?: object }).window = {
			AudioContext: () => {
				throw new Error("no audio device");
			},
		};

		expect(() => playBlockEndCue()).not.toThrow();
	});
});
