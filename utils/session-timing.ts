import type { ActiveSession } from "@/models/session";

function parseTime(iso: string | null | undefined): number | null {
	if (!iso) return null;
	const t = new Date(iso).getTime();
	return Number.isNaN(t) ? null : t;
}

/**
 * Marks the session as paused at `nowIso`. No-op (returns the same reference)
 * when the session is already paused or has no in-progress block — e.g. it has
 * finished and is on its way to the summary, which must keep its final timing.
 */
export function pauseSession(
	session: ActiveSession,
	nowIso: string,
): ActiveSession {
	if (session.pausedAt) return session;
	if (!session.currentBlockStartedAt) return session;
	return { ...session, pausedAt: nowIso };
}

/**
 * Resumes a paused session. The session total is frozen across the away gap by
 * shifting `startedAt` forward by the paused duration, so `diffSec(startedAt)`
 * returns the same value it had when the user left and keeps counting from
 * there. The current block timer resets to 0 by re-anchoring
 * `currentBlockStartedAt` to `nowIso`. No-op (same reference) when not paused.
 */
export function resumeSession(
	session: ActiveSession,
	nowIso: string,
): ActiveSession {
	if (!session.pausedAt) return session;
	const now = parseTime(nowIso);
	const pausedAt = parseTime(session.pausedAt);
	const startedAt = parseTime(session.startedAt);
	// Only shift the total anchor when every timestamp parses; otherwise leave
	// `startedAt` untouched but still reset the block and clear the pause flag.
	const shiftedStartedAt =
		now !== null && pausedAt !== null && startedAt !== null
			? new Date(startedAt + (now - pausedAt)).toISOString()
			: session.startedAt;
	return {
		...session,
		startedAt: shiftedStartedAt,
		currentBlockStartedAt: nowIso,
		pausedAt: null,
	};
}
