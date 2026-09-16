import { inset } from "@/theme/tokens";
import { useIsCompact } from "./use-is-compact";

/** The one horizontal page inset: `inset.compact` below the breakpoint,
 * `inset.roomy` above it. Every screen pays the same pair, so content lines
 * up across pages at either width. */
export function usePageInset(): number {
	return useIsCompact() ? inset.compact : inset.roomy;
}
