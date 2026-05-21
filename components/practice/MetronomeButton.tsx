import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "react-native-paper";
import { useMetronome } from "@/hooks/use-metronome";

interface MetronomeButtonProps {
	bpm: string;
	disabled?: boolean;
	stopRef?: React.MutableRefObject<(() => void) | null>;
}

const DEBOUNCE_MS = 150;

export function MetronomeButton({
	bpm,
	disabled,
	stopRef,
}: MetronomeButtonProps) {
	const { t } = useTranslation();
	const parsed = Number.parseInt(bpm.trim(), 10);
	const valid = !Number.isNaN(parsed) && parsed >= 20 && parsed <= 240;

	const [debouncedBpm, setDebouncedBpm] = useState(valid ? parsed : 0);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!valid) return;
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			setDebouncedBpm(parsed);
		}, DEBOUNCE_MS);
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [parsed, valid]);

	const { isRunning, toggle, stop } = useMetronome(debouncedBpm);

	useEffect(() => {
		if (!stopRef) return;
		stopRef.current = stop;
		return () => {
			stopRef.current = null;
		};
	}, [stop, stopRef]);

	if (!bpm.trim()) return null;

	return (
		<Button
			mode="outlined"
			icon="metronome"
			onPress={toggle}
			disabled={disabled || !valid}
		>
			{isRunning ? t("common.metronome.stop") : t("common.metronome.start")}
		</Button>
	);
}
