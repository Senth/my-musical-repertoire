// Native variant of use-metronome.web.ts, resolved by Metro on native; not reachable from fallow's web entry points.
// fallow-ignore-file unused-file
export interface UseMetronomeReturn {
	isRunning: boolean;
	toggle: () => void;
	stop: () => void;
}

export function useMetronome(_bpm: number): UseMetronomeReturn {
	return {
		isRunning: false,
		toggle: () => {},
		stop: () => {},
	};
}
