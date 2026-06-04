// Native variant of use-fab-style.web.ts, resolved by Metro on native; not reachable from fallow's web entry points.
// fallow-ignore-file unused-file
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * FAB style for screens inside the tab navigator (tab bar visible).
 * On native, content View may extend behind the tab bar, so we offset by tabBarHeight.
 */
export function useFabStyleTabs(): ViewStyle {
	const tabBarHeight = useBottomTabBarHeight();
	return { position: "absolute", right: 16, bottom: tabBarHeight + 16 };
}

/**
 * FAB style for screens outside the tab navigator (no tab bar visible).
 * Uses safe area insets to avoid home indicator overlap.
 */
export function useFabStyleStack(): ViewStyle {
	const insets = useSafeAreaInsets();
	return { position: "absolute", right: 16, bottom: insets.bottom + 16 };
}
