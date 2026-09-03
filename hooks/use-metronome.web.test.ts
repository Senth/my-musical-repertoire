import { act, renderHook } from "@testing-library/react-native";
import { useMetronome } from "./use-metronome.web";

jest.useFakeTimers();

class FakeOscillator {
	frequency = { value: 0 };
	connect() {}
	start() {}
	stop() {}
}

class FakeContext {
	static instances: FakeContext[] = [];
	currentTime = 0;
	state = "running";
	destination = {};
	oscillators: FakeOscillator[] = [];

	constructor() {
		FakeContext.instances.push(this);
	}

	createOscillator() {
		const osc = new FakeOscillator();
		this.oscillators.push(osc);
		return osc;
	}

	createGain() {
		return {
			gain: {
				setValueAtTime() {},
				exponentialRampToValueAtTime() {},
			},
			connect() {},
		};
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
});
