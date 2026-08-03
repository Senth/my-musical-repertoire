// Native variant of use-service-worker.web.ts, resolved by Metro on native; not reachable from fallow's web entry points.
// fallow-ignore-file unused-file
export interface UseServiceWorker {
	/** A new worker has installed and is waiting to take over. */
	updateReady: boolean;
	/** Lets the waiting worker activate, then reloads once it controls the page. */
	applyUpdate: () => void;
}

/** Native has no service worker — the app ships as a bundle already. */
export function useServiceWorker(): UseServiceWorker {
	return { updateReady: false, applyUpdate: () => {} };
}
