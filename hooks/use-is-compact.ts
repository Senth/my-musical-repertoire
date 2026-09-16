import { useWindowDimensions } from "react-native";
import { breakpoints } from "@/theme/tokens";

/** MD3 compact/medium window-class breakpoint (dp). Below this width the UI
 *  uses the compact layout (tighter padding, single-column, etc.). */
export const MD3_MEDIUM_BREAKPOINT = breakpoints.compact;

/** True when the current window width is in the MD3 "compact" class. */
export function useIsCompact(): boolean {
	const { width } = useWindowDimensions();
	return width < MD3_MEDIUM_BREAKPOINT;
}
