import type { ModeKey } from "@/models/practice";
import { parseModeKey } from "./practice-modes";

/** Minimal shape of i18next's `t` — avoids threading its generics everywhere. */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Chip-sized label: `LH`, `HT`, `LH staccato`. */
export function modeLabel(key: ModeKey, t: Translate): string {
	const { hands, drill } = parseModeKey(key);
	const handsText = t(`screen.practice.modes.hands.${hands}`);
	if (!drill) return handsText;
	return `${handsText} ${t(`screen.practice.modes.drill.${drill}`).toLowerCase()}`;
}

/** Sentence-sized label: `Left hand`, `Hands together (staccato)`. */
export function modeLabelLong(key: ModeKey, t: Translate): string {
	const { hands, drill } = parseModeKey(key);
	const handsText = t(`screen.practice.modes.handsLong.${hands}`);
	if (!drill) return handsText;
	return `${handsText} (${t(`screen.practice.modes.drill.${drill}`).toLowerCase()})`;
}
