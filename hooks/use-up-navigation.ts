import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { BackHandler, Platform } from "react-native";

/** Returns a `goBack` that pops history when possible, else replaces to `fallback`.
 *  Also intercepts the Android hardware back button (while focused) to do the same. */
export function useUpNavigation(fallback: Href): () => void {
	const router = useRouter();

	const goBack = useCallback(() => {
		if (router.canGoBack()) router.back();
		else router.replace(fallback);
	}, [router, fallback]);

	useFocusEffect(
		useCallback(() => {
			if (Platform.OS !== "android") return;
			const sub = BackHandler.addEventListener("hardwareBackPress", () => {
				goBack();
				return true;
			});
			return () => sub.remove();
		}, [goBack]),
	);

	return goBack;
}
