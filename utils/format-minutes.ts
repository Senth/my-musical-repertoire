/**
 * Block allocations are fractional internally so a session's minutes always add
 * up exactly to what the user asked for. The user never sees the fraction: the
 * value is rounded for display and marked approximate ("~4 min") whenever the
 * rounding moved it.
 */

// Anything closer than this to a whole minute is treated as exact — it is
// float noise from proportional splits, not a real fraction.
const EXACT_EPSILON = 0.005;

export interface MinutesDisplay {
	/** Whole minutes to show. Never 0 for a block that has any time at all. */
	minutes: number;
	/** True when the shown value was rounded and should be prefixed with "~". */
	approx: boolean;
}

export function displayMinutes(minutes: number): MinutesDisplay {
	if (minutes <= 0) return { minutes: 0, approx: false };
	const rounded = Math.max(1, Math.round(minutes));
	return {
		minutes: rounded,
		approx: Math.abs(rounded - minutes) > EXACT_EPSILON,
	};
}

/** i18n key for a minutes label, picking the "~" variant when rounded. */
export function minutesLabelKey(
	approx: boolean,
): "screen.session.block.minutes" | "screen.session.block.minutesApprox" {
	return approx
		? "screen.session.block.minutesApprox"
		: "screen.session.block.minutes";
}
