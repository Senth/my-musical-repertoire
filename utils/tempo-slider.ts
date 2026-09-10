const MIN_BPM = 20;
const MAX_BPM = 240;

export interface TempoSliderOptions {
	/** The passage's target tempo; null scales nothing and floors at 100. */
	target?: number | null;
	/** The current tempo, which the ceiling extends to when it sits above it. */
	value?: number | null;
	/** Full 20-240 track — sight-reading has no target to scale against. */
	fullRange?: boolean;
}

export function tempoSliderRange({
	target,
	value,
	fullRange,
}: TempoSliderOptions): { min: number; max: number } {
	if (fullRange) return { min: MIN_BPM, max: MAX_BPM };
	let max = Math.round(Math.max(100, (target ?? 0) * 1.34));
	if (value != null && value > max) max = value;
	return { min: MIN_BPM, max: Math.min(MAX_BPM, max) };
}
