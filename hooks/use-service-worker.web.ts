import { useCallback, useEffect, useRef, useState } from "react";

export interface UseServiceWorker {
	/** A new worker has installed and is waiting to take over. */
	updateReady: boolean;
	/** Lets the waiting worker activate, then reloads once it controls the page. */
	applyUpdate: () => void;
}

/**
 * Registers `/sw.js` and surfaces waiting updates.
 *
 * Registration is production-only on purpose: a service worker in front of the
 * Metro dev server would serve stale bundles and make hot reload lie.
 */
export function useServiceWorker(): UseServiceWorker {
	const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
	// The page reloads on `controllerchange` only when the user asked for it —
	// an unprompted reload mid-block would lose unsaved practice input.
	const applyingRef = useRef(false);

	useEffect(() => {
		if (process.env.NODE_ENV !== "production") return;
		if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
			return;
		}

		const container = navigator.serviceWorker;
		let cancelled = false;

		const watch = (registration: ServiceWorkerRegistration) => {
			// A first-ever install has no controller and needs no prompt: it is
			// already the worker serving this page.
			const check = () => {
				if (cancelled || !container.controller) return;
				if (registration.waiting) setWaiting(registration.waiting);
			};

			check();
			registration.addEventListener("updatefound", () => {
				// `installing` is often already gone by the time this fires — a small
				// worker over a fast connection reaches `waiting` first — so check
				// both the current state and any transition still to come.
				check();
				const installing = registration.installing;
				installing?.addEventListener("statechange", check);
			});
		};

		container.register("/sw.js").then(watch, () => {
			// Registration fails on an insecure origin or with SW disabled. The app
			// works fine without one, so there is nothing to tell the user.
		});

		const onControllerChange = () => {
			if (!applyingRef.current) return;
			window.location.reload();
		};
		container.addEventListener("controllerchange", onControllerChange);

		return () => {
			cancelled = true;
			container.removeEventListener("controllerchange", onControllerChange);
		};
	}, []);

	const applyUpdate = useCallback(() => {
		if (!waiting) return;
		applyingRef.current = true;
		waiting.postMessage({ type: "SKIP_WAITING" });
	}, [waiting]);

	return { updateReady: waiting !== null, applyUpdate };
}
