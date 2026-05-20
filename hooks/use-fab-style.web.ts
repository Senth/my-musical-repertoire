import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * global.css sets scrollbar-width: thin, giving ~8px scrollbars on desktop web.
 * The FAB is positioned via Portal at viewport level, so its right offset adds
 * the scrollbar width to maintain 16dp from the content area edge per MD3:
 *
 *   FAB_RIGHT = 16dp (MD3 margin) + 8px (thin scrollbar width) = 24px
 *
 * When no scrollbar is visible the FAB sits 24px from the viewport edge
 * (slightly more than 16dp, acceptable). When a thin scrollbar is visible
 * the FAB sits 16dp from the content edge, matching MD3.
 */
const SCROLLBAR_WIDTH = 8; // px, matches scrollbar-width: thin
const MD3_FAB_MARGIN = 16;
const FAB_RIGHT = MD3_FAB_MARGIN + SCROLLBAR_WIDTH; // 24

/**
 * FAB style for tab screens on web (Portal-wrapped FABs).
 * Portal renders at full-screen level (viewport height), so tabBarHeight + 16
 * correctly positions the FAB 16dp above the bottom navigation bar per MD3.
 */
export function useFabStyleTabs(): ViewStyle {
	const tabBarHeight = useBottomTabBarHeight();
	return {
		position: "absolute",
		right: FAB_RIGHT,
		bottom: tabBarHeight + MD3_FAB_MARGIN,
	};
}

/**
 * FAB.Group style for tab screens on web.
 * FAB.Group renders inline (not via Portal) and adds 16px internally from its
 * container edges to the visible button. To land at the correct MD3 position:
 *
 *   container right: 8  → container right edge at viewport_width - 8
 *   internal offset: 16 → button right edge at viewport_width - 8 - 16 = viewport_width - 24
 *   thin scrollbar: 8px → button is 16dp from content edge ✓
 *
 *   bottom: 0 → container bottom = content area bottom (bounded by tab bar on web)
 *   internal 16px → button 16dp above tab bar ✓
 */
export function useFabGroupStyleTabs(): ViewStyle {
	return { position: "absolute", right: SCROLLBAR_WIDTH, bottom: 0 };
}

/**
 * FAB style for non-tab stack screens on web.
 * No safe area bottom inset on web. Same right offset as tab screens.
 */
export function useFabStyleStack(): ViewStyle {
	const insets = useSafeAreaInsets();
	return {
		position: "absolute",
		right: FAB_RIGHT,
		bottom: insets.bottom + MD3_FAB_MARGIN,
	};
}
