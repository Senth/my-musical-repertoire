import { useEffect, useRef } from "react";

/**
 * Keeps the screen awake while `enabled`.
 *
 * A practice block runs 5–10 minutes with the device untouched on the music
 * desk, and a screen that dims reads as a lost session.
 *
 * Every failure path is silent: the API is missing on older iOS Safari, and the
 * request is rejected outright on low battery. Neither is worth a message —
 * the practice screen still works, it just dims.
 */
export function useWakeLock(enabled: boolean): void {
	const sentinelRef = useRef<WakeLockSentinel | null>(null);

	useEffect(() => {
		const wakeLock = navigator?.wakeLock;
		if (!wakeLock) return;

		let disposed = false;

		const release = () => {
			const sentinel = sentinelRef.current;
			sentinelRef.current = null;
			if (sentinel && !sentinel.released)
				void sentinel.release().catch(() => {});
		};

		const acquire = async () => {
			if (disposed || !enabled) return;
			if (sentinelRef.current && !sentinelRef.current.released) return;
			// A request from a hidden document always rejects.
			if (document.visibilityState !== "visible") return;
			try {
				const sentinel = await wakeLock.request("screen");
				if (disposed || !enabled) {
					void sentinel.release().catch(() => {});
					return;
				}
				sentinelRef.current = sentinel;
			} catch {
				// Unsupported or refused — nothing to recover from.
			}
		};

		if (enabled) void acquire();
		else release();

		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void acquire();
			} else {
				// The browser silently drops the lock when the tab hides, so the
				// sentinel we hold is already dead — forget it and re-acquire later.
				sentinelRef.current = null;
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			disposed = true;
			document.removeEventListener("visibilitychange", onVisibilityChange);
			release();
		};
	}, [enabled]);
}
