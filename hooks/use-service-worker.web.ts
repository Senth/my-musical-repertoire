import { useCallback, useEffect, useRef, useState } from "react";
import { buildId } from "@/utils/build-info";
import {
	buildFromHtml,
	isStale,
	reloadDecision,
} from "@/utils/shell-freshness";

const BOOT_WINDOW_MS = 10_000;
const RELOADED_FLAG = "build-reload";

export interface UseServiceWorker {
	/** The deployed build is not this one; a reload picks it up. */
	updateReady: boolean;
	/** Reloads the page onto the deployed build. */
	applyUpdate: () => void;
}

/**
 * Registers `/sw.js` and keeps the page honest about which build it is
 * running: it asks the network for the deployed shell and compares stamps,
 * reloading silently inside the boot window and offering the banner after it.
 * Registration and the check are production-only on purpose — a service worker
 * in front of the Metro dev server would make hot reload lie.
 */
export function useServiceWorker(): UseServiceWorker {
	const [updateReady, setUpdateReady] = useState(false);
	const bootedAt = useRef(0);

	useEffect(() => {
		if (process.env.NODE_ENV !== "production") return;
		if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
			return;
		}

		bootedAt.current = Date.now();

		const check = () => {
			fetch(`/?build-check=${Date.now()}`, { cache: "no-store" })
				.then((response) => response.text())
				.then((html) => {
					if (!isStale(buildFromHtml(html), buildId)) {
						// Back on the deployed build: the flap guard may arm again.
						sessionStorage.removeItem(RELOADED_FLAG);
						return;
					}
					const decision = reloadDecision({
						msSinceBoot: Date.now() - bootedAt.current,
						bootWindowMs: BOOT_WINDOW_MS,
						alreadyReloaded: sessionStorage.getItem(RELOADED_FLAG) !== null,
					});
					if (decision === "reload") {
						// The flag is what stops a flapping connection reloading forever.
						sessionStorage.setItem(RELOADED_FLAG, "1");
						window.location.reload();
					} else if (decision === "prompt") {
						setUpdateReady(true);
					}
				})
				.catch(() => {
					// A failed check is silence: launching with no network is the
					// normal case this hook exists for, and `online` is the way back.
				});
		};

		check();
		window.addEventListener("online", check);
		navigator.serviceWorker.addEventListener("controllerchange", check);
		navigator.serviceWorker.register("/sw.js").catch(() => {
			// Registration fails on an insecure origin or with SW disabled. The app
			// works fine without one, so there is nothing to tell the user.
		});

		return () => {
			window.removeEventListener("online", check);
			navigator.serviceWorker.removeEventListener("controllerchange", check);
		};
	}, []);

	const applyUpdate = useCallback(() => {
		window.location.reload();
	}, []);

	return { updateReady, applyUpdate };
}
