import { useCallback, useEffect, useState } from "react";

/** Chrome's install event — not in lib.dom, so declared minimally here. */
interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
}

export interface UseInstallPrompt {
	/** An install prompt has been captured and can still be shown. */
	promptAvailable: boolean;
	/** Already running as an installed app. */
	standalone: boolean;
	/** Shows the browser's install dialog. */
	promptInstall: () => void;
}

function isStandalone(): boolean {
	if (typeof window === "undefined") return false;
	if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
	// iOS Safari never fires `beforeinstallprompt` and reports it here instead.
	return (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Captures Chrome's `beforeinstallprompt` so the app decides when to ask.
 *
 * The `preventDefault()` is not optional and not about our own UI: an
 * uncaptured event lets Chrome on Android raise its own mini-infobar, which can
 * land in the middle of a practice block.
 */
export function useInstallPrompt(): UseInstallPrompt {
	const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
	const [standalone, setStandalone] = useState(isStandalone);

	useEffect(() => {
		if (typeof window === "undefined") return;

		setStandalone(isStandalone());

		const onBeforeInstallPrompt = (e: Event) => {
			e.preventDefault();
			setEvent(e as BeforeInstallPromptEvent);
		};
		const onInstalled = () => {
			setEvent(null);
			setStandalone(true);
		};

		window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
		window.addEventListener("appinstalled", onInstalled);
		return () => {
			window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
			window.removeEventListener("appinstalled", onInstalled);
		};
	}, []);

	const promptInstall = useCallback(() => {
		if (!event) return;
		// The event is single-use whatever the user picks.
		setEvent(null);
		void event.prompt().catch(() => {});
	}, [event]);

	return { promptAvailable: event !== null, standalone, promptInstall };
}
