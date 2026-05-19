import { useFocusEffect } from "expo-router";
import { type RefObject, useCallback, useRef } from "react";

type Focusable = { focus: () => void };

export function useAutoFocusOnMount<T extends Focusable>(
	enabled: boolean = true,
): RefObject<T | null> {
	const ref = useRef<T | null>(null);
	useFocusEffect(
		useCallback(() => {
			if (!enabled) return;
			let raf2: number | undefined;
			const raf1 = requestAnimationFrame(() => {
				raf2 = requestAnimationFrame(() => {
					ref.current?.focus();
				});
			});
			return () => {
				cancelAnimationFrame(raf1);
				if (raf2 !== undefined) cancelAnimationFrame(raf2);
			};
		}, [enabled]),
	);
	return ref;
}
