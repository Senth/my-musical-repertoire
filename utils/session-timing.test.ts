import type { ActiveSession } from "@/models/session";
import { pauseSession, resumeSession } from "./session-timing";

function baseSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
	return {
		plan: {
			emphasis: "balanced",
			totalMinutes: 30,
			blocks: [],
			generatedAt: "2026-06-27T10:00:00.000Z",
		},
		inputs: {
			emphasis: "balanced",
			totalMinutes: 30,
			techniqueEnabled: true,
			sightReadingEnabled: true,
		},
		startedAt: "2026-06-27T10:00:00.000Z",
		sessionId: "test-session-id",
		currentBlockIndex: 2,
		blockStates: [],
		sessionElapsedSeconds: 0,
		currentBlockStartedAt: "2026-06-27T10:09:00.000Z",
		...overrides,
	};
}

// Mirrors coach.tsx's diffSec for asserting displayed elapsed seconds.
function elapsedAt(fromIso: string | null | undefined, nowIso: string): number {
	if (!fromIso) return 0;
	const t = new Date(fromIso).getTime();
	if (Number.isNaN(t)) return 0;
	return Math.max(0, Math.floor((new Date(nowIso).getTime() - t) / 1000));
}

describe("pauseSession", () => {
	it("stamps pausedAt", () => {
		const session = baseSession();
		const paused = pauseSession(session, "2026-06-27T10:10:00.000Z");
		expect(paused.pausedAt).toBe("2026-06-27T10:10:00.000Z");
		expect(paused.startedAt).toBe(session.startedAt);
		expect(paused.currentBlockStartedAt).toBe(session.currentBlockStartedAt);
	});

	it("is a no-op when already paused", () => {
		const session = baseSession({ pausedAt: "2026-06-27T10:05:00.000Z" });
		expect(pauseSession(session, "2026-06-27T10:10:00.000Z")).toBe(session);
	});

	it("is a no-op for a finished session (no in-progress block)", () => {
		const session = baseSession({ currentBlockStartedAt: null });
		expect(pauseSession(session, "2026-06-27T10:10:00.000Z")).toBe(session);
	});
});

describe("resumeSession", () => {
	it("is a no-op when not paused", () => {
		const session = baseSession();
		expect(resumeSession(session, "2026-06-27T13:10:00.000Z")).toBe(session);
	});

	it("freezes the session total across the gap and resets the block to 0", () => {
		// Issue #53 example: 10:00 total, 1:00 into the block, then away 3 hours.
		const pausedAt = "2026-06-27T10:10:00.000Z"; // 600s total at pause
		const now = "2026-06-27T13:10:00.000Z"; // resumed 3h later
		const session = pauseSession(baseSession(), pausedAt);

		const resumed = resumeSession(session, now);

		// Total continues from 600s (not inflated by the 3h away).
		expect(elapsedAt(resumed.startedAt, now)).toBe(600);
		// Current block resets to 0:00.
		expect(resumed.currentBlockStartedAt).toBe(now);
		expect(elapsedAt(resumed.currentBlockStartedAt, now)).toBe(0);
		expect(resumed.pausedAt).toBeNull();
	});

	it("keeps the total counting forward after resume", () => {
		const session = pauseSession(baseSession(), "2026-06-27T10:10:00.000Z");
		const resumed = resumeSession(session, "2026-06-27T13:10:00.000Z");
		// 30s after resume → total 630s, block 30s.
		const later = "2026-06-27T13:10:30.000Z";
		expect(elapsedAt(resumed.startedAt, later)).toBe(630);
		expect(elapsedAt(resumed.currentBlockStartedAt, later)).toBe(30);
	});

	it("falls back to resetting the block when timestamps are unparseable", () => {
		const session = baseSession({ pausedAt: "not-a-date" });
		const resumed = resumeSession(session, "2026-06-27T13:10:00.000Z");
		expect(resumed.startedAt).toBe(session.startedAt);
		expect(resumed.currentBlockStartedAt).toBe("2026-06-27T13:10:00.000Z");
		expect(resumed.pausedAt).toBeNull();
	});
});
