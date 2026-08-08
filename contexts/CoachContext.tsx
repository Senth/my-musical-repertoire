import {
	createContext,
	type MutableRefObject,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
} from "react";
import type { PendingPhaseOffer } from "@/utils/phase-offer";

interface CoachSaveResult {
	saved: boolean;
}

type SaveFn = () => Promise<CoachSaveResult>;
type ValidateFn = () => boolean;

export interface CoachContextValue {
	inCoach: boolean;
	sessionId: string | null;
	saveHandlerRef: MutableRefObject<SaveFn | null>;
	validateHandlerRef: MutableRefObject<ValidateFn | null>;
	/**
	 * Where a block body leaves a phase nudge raised by the save it just made.
	 * The coach reads it between the save and `advance("completed")` — a ref, not
	 * state, because the body unmounts the moment the block advances.
	 */
	phaseOfferRef: MutableRefObject<PendingPhaseOffer | null>;
	/**
	 * Shows a message at the coach screen level. A block body unmounts the moment
	 * the block advances, so a snackbar it owns would never be seen.
	 */
	notify: (message: string) => void;
}

const CoachContext = createContext<CoachContextValue | null>(null);

export function CoachProvider({
	inCoach,
	sessionId,
	saveHandlerRef,
	validateHandlerRef,
	phaseOfferRef,
	notify,
	children,
}: {
	inCoach: boolean;
	sessionId: string | null;
	saveHandlerRef: MutableRefObject<SaveFn | null>;
	validateHandlerRef: MutableRefObject<ValidateFn | null>;
	phaseOfferRef: MutableRefObject<PendingPhaseOffer | null>;
	notify: (message: string) => void;
	children: ReactNode;
}) {
	const value = useMemo<CoachContextValue>(
		() => ({
			inCoach,
			sessionId,
			saveHandlerRef,
			validateHandlerRef,
			phaseOfferRef,
			notify,
		}),
		[
			inCoach,
			sessionId,
			saveHandlerRef,
			validateHandlerRef,
			phaseOfferRef,
			notify,
		],
	);
	return (
		<CoachContext.Provider value={value}>{children}</CoachContext.Provider>
	);
}

const NOOP_SAVE_REF: MutableRefObject<SaveFn | null> = { current: null };
const NOOP_VALIDATE_REF: MutableRefObject<ValidateFn | null> = {
	current: null,
};
const NOOP_OFFER_REF: MutableRefObject<PendingPhaseOffer | null> = {
	current: null,
};
const NOOP_NOTIFY = () => {};

export function useCoach(): CoachContextValue {
	const ctx = useContext(CoachContext);
	if (ctx) return ctx;
	return {
		inCoach: false,
		sessionId: null,
		saveHandlerRef: NOOP_SAVE_REF,
		validateHandlerRef: NOOP_VALIDATE_REF,
		phaseOfferRef: NOOP_OFFER_REF,
		notify: NOOP_NOTIFY,
	};
}

export function useRegisterCoachSave(
	saveFn: SaveFn,
	validateFn?: ValidateFn,
): void {
	const { inCoach, saveHandlerRef, validateHandlerRef } = useCoach();
	useEffect(() => {
		if (!inCoach) return;
		saveHandlerRef.current = saveFn;
		validateHandlerRef.current = validateFn ?? null;
		return () => {
			saveHandlerRef.current = null;
			validateHandlerRef.current = null;
		};
	}, [inCoach, saveFn, validateFn, saveHandlerRef, validateHandlerRef]);
}
