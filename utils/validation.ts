import type { TFunction } from "i18next";

/**
 * Validate a tempo (BPM) text input. Returns a localized error message, or
 * `null` when the value is empty (optional) or a valid integer in [20, 240].
 */
export function validateBpm(text: string, t: TFunction): string | null {
	if (!text.trim()) return null;
	const n = Number.parseInt(text.trim(), 10);
	return Number.isNaN(n) || n < 20 || n > 240 ? t("error.bpmInvalid") : null;
}

/**
 * Validate a duration (minutes) text input. Returns a localized error message,
 * or `null` when the value is empty (optional) or a valid integer in [1, 600].
 */
export function validateDuration(text: string, t: TFunction): string | null {
	if (!text.trim()) return null;
	const n = Number.parseInt(text.trim(), 10);
	return Number.isNaN(n) || n < 1 || n > 600
		? t("error.durationInvalid")
		: null;
}
