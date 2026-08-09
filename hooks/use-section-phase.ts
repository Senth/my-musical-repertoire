import {
	collection,
	doc,
	getDocs,
	limit,
	orderBy,
	query,
	Timestamp,
	type WriteBatch,
	writeBatch,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type {
	PhaseTransition,
	PhaseTransitionOutcome,
	PhaseTransitionTrigger,
	SectionPhase,
} from "@/models/section";
import { awaitWrite } from "@/utils/firestore-write";
import { daysBetween } from "@/utils/section-progression";

/**
 * Every phase change in the app goes through here, so the
 * `sections/{id}/phaseTransitions` audit trail is complete rather than a
 * partial view of the new nudges. See `docs/specs/section-phases.md`
 * §4.3.
 */

/**
 * Enough rows to answer "three dismissals since the last accepted change?"
 * with room to spare.
 */
export const PHASE_HISTORY_LIMIT = 10;

export interface PhaseEvent {
	pieceId: string;
	sectionId: string;
	fromPhase: SectionPhase;
	/** Where the section lands. Equal to `fromPhase` for a dismissal. */
	toPhase: SectionPhase;
	trigger: PhaseTransitionTrigger;
	achievedBpmAtEvent?: number | null;
	qualityAtEvent?: number | null;
	/** The section's `phaseChangedAt` *before* this event. */
	priorPhaseChangedAt?: Date | null;
	sessionId?: string | null;
	/** Defaults to now. */
	date?: Date;
}

function sectionRef(userId: string, pieceId: string, sectionId: string) {
	return doc(db, "users", userId, "pieces", pieceId, "sections", sectionId);
}

export function phaseTransitionsRef(
	userId: string,
	pieceId: string,
	sectionId: string,
) {
	return collection(sectionRef(userId, pieceId, sectionId), "phaseTransitions");
}

function transitionDoc(
	event: PhaseEvent,
	outcome: PhaseTransitionOutcome,
	date: Date,
) {
	return {
		fromPhase: event.fromPhase,
		toPhase: outcome === "dismissed" ? event.fromPhase : event.toPhase,
		trigger: event.trigger,
		outcome,
		achievedBpmAtEvent: event.achievedBpmAtEvent ?? null,
		qualityAtEvent: event.qualityAtEvent ?? null,
		daysInPriorPhase: event.priorPhaseChangedAt
			? daysBetween(event.priorPhaseChangedAt, date)
			: null,
		sessionId: event.sessionId ?? null,
		date: Timestamp.fromDate(date),
	};
}

/**
 * Queue a phase change and its audit row onto a batch the caller already owns —
 * never a phase change without its audit row. Used directly by the run-through
 * save, which writes the whole session in one batch.
 */
export function queuePhaseChange(
	batch: WriteBatch,
	userId: string,
	event: PhaseEvent,
): void {
	const date = event.date ?? new Date();
	batch.update(sectionRef(userId, event.pieceId, event.sectionId), {
		phase: event.toPhase,
		phaseChangedAt: Timestamp.fromDate(date),
	});
	batch.set(
		doc(phaseTransitionsRef(userId, event.pieceId, event.sectionId)),
		transitionDoc(event, "accepted", date),
	);
}

/** Queue only the audit row — the student declined the offer. */
export function queuePhaseDismissal(
	batch: WriteBatch,
	userId: string,
	event: PhaseEvent,
): void {
	batch.set(
		doc(phaseTransitionsRef(userId, event.pieceId, event.sectionId)),
		transitionDoc(event, "dismissed", event.date ?? new Date()),
	);
}

export function useChangeSectionPhase() {
	const { user } = useAuth();

	const changeSectionPhase = useCallback(
		async (event: PhaseEvent) => {
			if (!user) throw new Error("Not authenticated");
			const batch = writeBatch(db);
			queuePhaseChange(batch, user.uid, event);
			await awaitWrite(batch.commit());
		},
		[user],
	);

	const dismissPhaseOffer = useCallback(
		async (event: PhaseEvent) => {
			if (!user) throw new Error("Not authenticated");
			const batch = writeBatch(db);
			queuePhaseDismissal(batch, user.uid, event);
			await awaitWrite(batch.commit());
		},
		[user],
	);

	return { changeSectionPhase, dismissPhaseOffer };
}

function fromFirestore(
	id: string,
	data: Record<string, unknown>,
): PhaseTransition {
	const at = data.date as { toDate?: () => Date } | null;
	return {
		id,
		fromPhase: data.fromPhase as SectionPhase,
		toPhase: data.toPhase as SectionPhase,
		trigger: data.trigger as PhaseTransitionTrigger,
		outcome: data.outcome as PhaseTransitionOutcome,
		achievedBpmAtEvent: (data.achievedBpmAtEvent as number) ?? null,
		qualityAtEvent: (data.qualityAtEvent as number) ?? null,
		daysInPriorPhase: (data.daysInPriorPhase as number) ?? null,
		sessionId: (data.sessionId as string) ?? null,
		date: typeof at?.toDate === "function" ? at.toDate() : new Date(0),
	};
}

/**
 * The section's newest phase-transition rows, newest first. A one-shot
 * `getDocs` like `useLastPracticeLog`, so it serves from the offline cache when
 * disconnected. `reload` re-reads after the offer writes a row.
 */
export function useSectionPhaseHistory(
	pieceId: string | null | undefined,
	sectionId: string | null | undefined,
) {
	const { user } = useAuth();
	const [transitions, setTransitions] = useState<PhaseTransition[]>([]);
	const [loading, setLoading] = useState(true);

	const reload = useCallback(() => {
		if (!user || !pieceId || !sectionId) {
			setTransitions([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		getDocs(
			query(
				phaseTransitionsRef(user.uid, pieceId, sectionId),
				orderBy("date", "desc"),
				limit(PHASE_HISTORY_LIMIT),
			),
		)
			.then((snap) => {
				setTransitions(
					snap.docs.map((d) =>
						fromFirestore(d.id, d.data() as Record<string, unknown>),
					),
				);
				setLoading(false);
			})
			.catch(() => {
				setTransitions([]);
				setLoading(false);
			});
	}, [user, pieceId, sectionId]);

	useEffect(reload, [reload]);

	return { transitions, loading, reload };
}
