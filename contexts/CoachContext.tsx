import {
	createContext,
	type MutableRefObject,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
} from "react";
import type { PendingStateOffer } from "@/utils/state-offer";

interface CoachSaveResult {
	saved: boolean;
}

type SaveFn = () => Promise<CoachSaveResult>;
type ValidateFn = () => boolean;

export interface PracticeHeading {
	title: string;
	subtitle?: string | null;
}

export interface CoachContextValue {
	inCoach: boolean;
	sessionId: string | null;
	saveHandlerRef: MutableRefObject<SaveFn | null>;
	validateHandlerRef: MutableRefObject<ValidateFn | null>;
	/**
	 * Where a block body leaves a state nudge raised by the save it just made.
	 * The coach reads it between the save and `advance("completed")` — a ref, not
	 * state, because the body unmounts the moment the block advances.
	 */
	stateOfferRef: MutableRefObject<PendingStateOffer | null>;
	/**
	 * Shows a message at the coach screen level. A block body unmounts the moment
	 * the block advances, so a snackbar it owns would never be seen.
	 */
	notify: (message: string) => void;
	/**
	 * Title/subtitle for the coach app bar, published by the block body now on
	 * screen. The body cannot render into the app bar itself — it unmounts the
	 * moment the block advances, and the shell owns that bar.
	 */
	setHeading: (heading: PracticeHeading | null) => void;
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
	stateOfferRef,
	notify,
	setHeading,
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
	stateOfferRef: MutableRefObject<PendingStateOffer | null>;
	notify: (message: string) => void;
	setHeading: (heading: PracticeHeading | null) => void;
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
			stateOfferRef,
			notify,
			setHeading,
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
			stateOfferRef,
			notify,
			setHeading,
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
const NOOP_OFFER_REF: MutableRefObject<PendingStateOffer | null> = {
	current: null,
};
const NOOP_NOTIFY = () => {};
const NOOP_BLOCK_CONTROL = () => {};
const NOOP_SET_HEADING = () => {};

export function useCoach(): CoachContextValue {
	const ctx = useContext(CoachContext);
	if (ctx) return ctx;
	return {
		inCoach: false,
		sessionId: null,
		saveHandlerRef: NOOP_SAVE_REF,
		validateHandlerRef: NOOP_VALIDATE_REF,
		stateOfferRef: NOOP_OFFER_REF,
		notify: NOOP_NOTIFY,
		setHeading: NOOP_SET_HEADING,
		saveAndNext: NOOP_BLOCK_CONTROL,
		skipBlock: NOOP_BLOCK_CONTROL,
		extendBlock: NOOP_BLOCK_CONTROL,
		saving: false,
	};
}

/**
 * Publishes the block body's name into the coach app bar and clears it on
 * unmount. Inert outside the coach, where each screen renders its own app bar.
 */
export function usePracticeHeading(
	title: string,
	subtitle: string | null,
): void {
	const { inCoach, setHeading } = useCoach();
	useEffect(() => {
		if (!inCoach) return;
		setHeading({ title, subtitle });
		return () => setHeading(null);
	}, [inCoach, setHeading, title, subtitle]);
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
