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
