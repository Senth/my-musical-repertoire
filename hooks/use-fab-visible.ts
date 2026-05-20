import { useIsFocused } from "expo-router";

// Tab screens stay mounted in the background and Portal renders into a single
// global host, so a tab's portalised FAB will leak on top of the focused tab
// (or on top of a pushed stack screen) unless rendering is gated by focus.
export function useFabVisible(): boolean {
	return useIsFocused();
}
