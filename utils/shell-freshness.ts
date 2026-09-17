/*
 * The decision table for the stale-shell recovery loop in
 * `hooks/use-service-worker.web.ts`. Pure on purpose — no DOM, no fetch — so
 * the decisions the loop makes can be tested without a browser.
 */

/** Reads the deploy stamp `app/+html.tsx` writes into every exported page. */
export function buildFromHtml(html: string): string | null {
	const match = /<meta\s+name="build"\s+content="([^"]*)"/.exec(html);
	return match?.[1] ?? null;
}

/** A build that could not be read is never stale; only a different one is. */
export function isStale(fetched: string | null, running: string): boolean {
	return fetched !== null && fetched !== running;
}

export type ReloadDecision = "reload" | "prompt";

/**
 * Why 10s: a PWA launch off a sleeping phone spends its first seconds on the
 * splash screen with nothing typed yet, so a reload there is invisible — after
 * it, someone may be mid-practice-block, and only a tap may move the page.
 */
export function reloadDecision({
	msSinceBoot,
	bootWindowMs,
	alreadyReloaded,
}: {
	msSinceBoot: number;
	bootWindowMs: number;
	alreadyReloaded: boolean;
}): ReloadDecision {
	if (!alreadyReloaded && msSinceBoot < bootWindowMs) return "reload";
	return "prompt";
}
