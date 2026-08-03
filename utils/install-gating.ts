/** Everything the install card needs to decide whether it may show. */
export interface InstallGate {
	/** A `beforeinstallprompt` event has been captured and not yet used. */
	promptAvailable: boolean;
	/** Already running as an installed app. */
	standalone: boolean;
	/** A practice session is in progress. */
	hasActiveSession: boolean;
	/** The user has finished at least one practice. */
	hasPracticed: boolean;
	/** The user tapped "Not now" at some point. */
	dismissed: boolean;
}

/**
 * Whether the install card may be shown.
 *
 * Deliberately narrow: an install prompt is an interruption, so it is only
 * offered to someone who has already got value out of the app, is not mid
 * practice, and has not said no before.
 */
export function shouldOfferInstall(gate: InstallGate): boolean {
	return (
		gate.promptAvailable &&
		!gate.standalone &&
		!gate.hasActiveSession &&
		gate.hasPracticed &&
		!gate.dismissed
	);
}
