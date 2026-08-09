import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, Tooltip } from "react-native-paper";
import { useMetronome } from "@/hooks/use-metronome";

interface MetronomeButtonProps {
	bpm: string;
	disabled?: boolean;
	stopRef?: React.MutableRefObject<(() => void) | null>;
}

const DEBOUNCE_MS = 150;

// Every label the button can show. Rendered as hidden ghosts so the button is
// always as wide as its longest state and never resizes when the label changes.
const LABEL_KEYS = ["start", "stop", "paused"] as const;

const GHOST = { height: 0, overflow: "hidden" } as const;

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
	const [paused, setPaused] = useState(false);

	// Pause — rather than stop — when the BPM turns invalid mid-edit (or when
	// switching to a mode that has no BPM yet), so the metronome picks itself
	// back up once a valid BPM is entered again.
	useEffect(() => {
		if (!valid && isRunning) {
			stop();
			setPaused(true);
		}
	}, [valid, isRunning, stop]);

	// Resume once the edited BPM has settled, so we never click at the stale tempo.
	useEffect(() => {
		if (paused && valid && debouncedBpm === parsed) {
			setPaused(false);
			toggle();
		}
	}, [paused, valid, debouncedBpm, parsed, toggle]);

	// A stop from the outside (saving, navigating away) is final — drop the
	// pending resume as well.
	const stopAll = useCallback(() => {
		setPaused(false);
		stop();
	}, [stop]);

	useEffect(() => {
		if (!stopRef) return;
		stopRef.current = stopAll;
		return () => {
			stopRef.current = null;
		};
	}, [stopAll, stopRef]);

	const labelKey = isRunning ? "stop" : paused ? "paused" : "start";

	const button = (
		<Button
			mode="outlined"
			icon="metronome"
			onPress={toggle}
			disabled={disabled || !valid}
		>
			{t(`common.metronome.${labelKey}`)}
		</Button>
	);

	return (
		<View>
			<View aria-hidden accessible={false} style={GHOST}>
				{LABEL_KEYS.map((key) => (
					<Button
						key={key}
						mode="outlined"
						icon="metronome"
						disabled
						focusable={false}
					>
						{t(`common.metronome.${key}`)}
					</Button>
				))}
			</View>
			{valid ? (
				button
			) : (
				<Tooltip
					title={t(
						paused
							? "common.metronome.enterBpmToResume"
							: "common.metronome.enterBpmToEnable",
					)}
				>
					{button}
				</Tooltip>
			)}
		</View>
	);
}
