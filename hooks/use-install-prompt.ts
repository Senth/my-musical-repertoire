// Native variant of use-install-prompt.web.ts, resolved by Metro on native; not reachable from fallow's web entry points.
// fallow-ignore-file unused-file
export interface UseInstallPrompt {
	/** An install prompt has been captured and can still be shown. */
	promptAvailable: boolean;
	/** Already running as an installed app. */
	standalone: boolean;
	/** Shows the browser's install dialog. */
	promptInstall: () => void;
}

/** Native is already installed — there is nothing to offer. */
export function useInstallPrompt(): UseInstallPrompt {
	return { promptAvailable: false, standalone: true, promptInstall: () => {} };
}
