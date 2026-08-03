// Native variant of use-coach-exit-guard.web.ts, resolved by Metro on native; not reachable from fallow's web entry points.
// fallow-ignore-file unused-file
export interface UseCoachExitGuard {
	/** The "Leave session?" dialog should be open. */
	confirmVisible: boolean;
	/** Close the dialog — the caller decides whether to navigate away after. */
	dismissConfirm: () => void;
}

/**
 * No-op on native: there is no history stack to trap, and Android's hardware
 * back is handled by the navigator itself. See the web variant for why the
 * guard exists at all.
 */
export function useCoachExitGuard(_enabled: boolean): UseCoachExitGuard {
	return { confirmVisible: false, dismissConfirm: () => {} };
}
