import { act, renderHook } from "@testing-library/react-native";
import { useMetronome } from "./use-metronome.web";

jest.useFakeTimers();

class FakeOscillator {
	frequency = { value: 0 };
	connect() {}
	start() {}
	stop() {}
}

class FakeGain {
	values: number[] = [];
	gain = {
		setValueAtTime() {},
		exponentialRampToValueAtTime: (v: number) => {
			this.values.push(v);
		},
	};
	connect() {}
}

class FakeContext {
	static instances: FakeContext[] = [];
	currentTime = 0;
	state = "running";
	destination = {};
	oscillators: FakeOscillator[] = [];
	gains: FakeGain[] = [];

	constructor() {
		FakeContext.instances.push(this);
	}

	createOscillator() {
		const osc = new FakeOscillator();
		this.oscillators.push(osc);
		return osc;
	}

	createGain() {
		const gain = new FakeGain();
		this.gains.push(gain);
		return gain;
	}

	createDynamicsCompressor() {
		return {
			threshold: { value: 0 },
			knee: { value: 0 },
			ratio: { value: 0 },
			attack: { value: 0 },
			release: { value: 0 },
			connect() {},
		};
	}

	resume() {}
	suspend() {}
	close() {}
}

function scheduledFrequencies(): number[] {
	return FakeContext.instances[0].oscillators.map((o) => o.frequency.value);
}

// Peak gain each scheduled click ramps to — what the volume setting scales.
function scheduledGains(): number[] {
	return FakeContext.instances[0].gains.map((g) => Math.max(...g.values));
}

// Pushes the fake clock forward and lets the scheduler drain what is due.
function runTo(ctx: FakeContext, time: number) {
	ctx.currentTime = time;
	act(() => {
		jest.advanceTimersByTime(25);
	});
}

describe("useMetronome time signature", () => {
	beforeEach(() => {
		FakeContext.instances = [];
		jest.clearAllTimers();
		(globalThis as unknown as { window: unknown }).window = {
			AudioContext: FakeContext,
		};
	});

	it("accents beat 1 and wraps every beats-per-bar clicks", () => {
		const { result } = renderHook(() => useMetronome(120, 4));
		act(() => {
			result.current.toggle();
		});
		const ctx = FakeContext.instances[0];

		runTo(ctx, 0); // beat 1
		runTo(ctx, 2.0); // beats 2, 3, 4, 1
		runTo(ctx, 4.0); // beats 2, 3, 4, 1

		expect(scheduledFrequencies()).toEqual([
			1320, 880, 880, 880, 1320, 880, 880, 880, 1320,
		]);
	});

	it("starts a new bar when the time signature changes mid-run", () => {
		const { result, rerender } = renderHook(
			({ beatsPerBar }: { beatsPerBar: number }) =>
				useMetronome(120, beatsPerBar),
			{ initialProps: { beatsPerBar: 4 } },
		);
		act(() => {
			result.current.toggle();
		});
		const ctx = FakeContext.instances[0];
		runTo(ctx, 1.0); // 4/4: beats 1, 2, 3

		rerender({ beatsPerBar: 3 });
		runTo(ctx, 3.0); // beat 4 of the old bar, then beat 1 of the new bar

		const freqs = scheduledFrequencies();
		expect(freqs.slice(0, 3)).toEqual([1320, 880, 880]);
		expect(freqs.slice(3)).toEqual([1320, 880, 880, 1320]);
	});

	describe("volume", () => {
		it("scales the click gain with the volume setting", () => {
			const { result } = renderHook(() => useMetronome(120, 4, 0.5));
			act(() => {
				result.current.toggle();
			});
			const ctx = FakeContext.instances[0];
			runTo(ctx, 0.6);

			expect(scheduledGains()).toEqual([2, 2]);
		});

		it("silences clicks when volume is 0", () => {
			const { result } = renderHook(() => useMetronome(120, 4, 0));
			act(() => {
				result.current.toggle();
			});
			const ctx = FakeContext.instances[0];
			runTo(ctx, 0.6);

			expect(scheduledGains()).toEqual([0.0001, 0.0001]);
		});
	});
});
