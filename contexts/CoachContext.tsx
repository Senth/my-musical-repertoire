import {
	createContext,
	type MutableRefObject,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
} from "react";

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
	notify,
	children,
}: {
	inCoach: boolean;
	sessionId: string | null;
	saveHandlerRef: MutableRefObject<SaveFn | null>;
	validateHandlerRef: MutableRefObject<ValidateFn | null>;
	notify: (message: string) => void;
	children: ReactNode;
}) {
	const value = useMemo<CoachContextValue>(
		() => ({ inCoach, sessionId, saveHandlerRef, validateHandlerRef, notify }),
		[inCoach, sessionId, saveHandlerRef, validateHandlerRef, notify],
	);
	return (
		<CoachContext.Provider value={value}>{children}</CoachContext.Provider>
	);
}

const NOOP_SAVE_REF: MutableRefObject<SaveFn | null> = { current: null };
const NOOP_VALIDATE_REF: MutableRefObject<ValidateFn | null> = {
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
