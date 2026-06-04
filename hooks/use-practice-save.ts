import { useCallback } from "react";
import { useRegisterCoachSave } from "@/contexts/CoachContext";

/**
 * Wires a practice screen's `performSave` to both the manual save button and the
 * coach's auto-save. Returns the button handler; registers the coach callback as
 * a side effect.
 */
export function usePracticeSave(
	performSave: () => Promise<{ ok: boolean }>,
	onSaved: () => void,
): () => Promise<void> {
	const handleSave = async () => {
		const result = await performSave();
		if (result.ok) onSaved();
	};

	useRegisterCoachSave(
		useCallback(async () => {
			const result = await performSave();
			return { saved: result.ok };
		}, [performSave]),
	);

	return handleSave;
}
