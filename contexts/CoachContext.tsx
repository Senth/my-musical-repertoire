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
}

const CoachContext = createContext<CoachContextValue | null>(null);

export function CoachProvider({
	inCoach,
	sessionId,
	saveHandlerRef,
	validateHandlerRef,
	children,
}: {
	inCoach: boolean;
	sessionId: string | null;
	saveHandlerRef: MutableRefObject<SaveFn | null>;
	validateHandlerRef: MutableRefObject<ValidateFn | null>;
	children: ReactNode;
}) {
	const value = useMemo<CoachContextValue>(
		() => ({ inCoach, sessionId, saveHandlerRef, validateHandlerRef }),
		[inCoach, sessionId, saveHandlerRef, validateHandlerRef],
	);
	return (
		<CoachContext.Provider value={value}>{children}</CoachContext.Provider>
	);
}

const NOOP_SAVE_REF: MutableRefObject<SaveFn | null> = { current: null };
const NOOP_VALIDATE_REF: MutableRefObject<ValidateFn | null> = {
	current: null,
};

export function useCoach(): CoachContextValue {
	const ctx = useContext(CoachContext);
	if (ctx) return ctx;
	return {
		inCoach: false,
		sessionId: null,
		saveHandlerRef: NOOP_SAVE_REF,
		validateHandlerRef: NOOP_VALIDATE_REF,
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
