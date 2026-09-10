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
	/**
	 * Block controls for the body's pinned footer. The footer owns the buttons;
	 * the coach owns what they do. No-ops outside the coach.
	 */
	saveAndNext: () => void;
	skipBlock: () => void;
	extendBlock: () => void;
	/** True while the coach's save-and-advance is in flight. */
	saving: boolean;
}

const CoachContext = createContext<CoachContextValue | null>(null);

export function CoachProvider({
	inCoach,
	sessionId,
	saveHandlerRef,
	validateHandlerRef,
	phaseOfferRef,
	notify,
	saveAndNext,
	skipBlock,
	extendBlock,
	saving,
	children,
}: {
	inCoach: boolean;
	sessionId: string | null;
	saveHandlerRef: MutableRefObject<SaveFn | null>;
	validateHandlerRef: MutableRefObject<ValidateFn | null>;
	phaseOfferRef: MutableRefObject<PendingPhaseOffer | null>;
	notify: (message: string) => void;
	saveAndNext: () => void;
	skipBlock: () => void;
	extendBlock: () => void;
	saving: boolean;
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
			saveAndNext,
			skipBlock,
			extendBlock,
			saving,
		}),
		[
			inCoach,
			sessionId,
			saveHandlerRef,
			validateHandlerRef,
			phaseOfferRef,
			notify,
			saveAndNext,
			skipBlock,
			extendBlock,
			saving,
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
const NOOP_BLOCK_CONTROL = () => {};

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
		saveAndNext: NOOP_BLOCK_CONTROL,
		skipBlock: NOOP_BLOCK_CONTROL,
		extendBlock: NOOP_BLOCK_CONTROL,
		saving: false,
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
