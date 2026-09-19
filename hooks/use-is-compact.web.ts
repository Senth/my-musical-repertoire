import { useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";
import { breakpoints } from "@/theme/tokens";

/**
 * Web variant of use-is-compact: the static render has no window (react-native-web
 * reports a zero-width one), so the compact layout is the shared first paint and the
 * real width is picked up once the page has hydrated. Matching use-color-scheme.web,
 * which exists for the same reason.
 */
export function useIsCompact(): boolean {
	const [hasHydrated, setHasHydrated] = useState(false);

	useEffect(() => {
		setHasHydrated(true);
	}, []);

	const { width } = useWindowDimensions();

	if (hasHydrated) {
		return width < breakpoints.compact;
	}

	return true;
}
