import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { EstimationField } from "@/components/practice/EstimationField";
import { PracticeFooter } from "@/components/practice/PracticeFooter";
import { TempoControl } from "@/components/practice/TempoControl";
import { ErrorSnackbar } from "@/components/ui/ErrorSnackbar";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useAuth } from "@/contexts/AuthContext";
import {
	useCoach,
	usePracticeHeading,
	useRegisterCoachSave,
} from "@/contexts/CoachContext";
import { addSightReadingLog } from "@/hooks/use-sight-reading-logs";
import { space } from "@/theme/tokens";
import { keptGoingOptions, type Rating } from "@/utils/estimation-options";
import {
	readSightReadingBpm,
	readSightReadingSignature,
	writeSightReadingBpm,
	writeSightReadingSignature,
} from "@/utils/session-storage";
import type { TimeSignature } from "@/utils/time-signature";
import { validateBpm } from "@/utils/validation";

interface SightReadingBlockBodyProps {
	stopRef: React.MutableRefObject<(() => void) | null>;
	elapsedSeconds: number;
}

const DEBOUNCE_MS = 500;

export function SightReadingBlockBody({
	stopRef,
	elapsedSeconds,
}: SightReadingBlockBodyProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const { user } = useAuth();
	const [bpm, setBpm] = useState("");
	const [effectiveBpm, setEffectiveBpm] = useState<number | null>(null);
	const [keptGoing, setKeptGoing] = useState<Rating | null>(null);
	const [error, setError] = useState<string | null>(null);
	/** The value as it was on mount — the `last` marker must not follow the thumb. */
	const [savedBpm, setSavedBpm] = useState<number | null>(null);
	const [bpmError, setBpmError] = useState<string | null>(null);
	/** Bar signature for the metronome accent, stored on the device: no piece or technique sits behind this block. */
	const [signature, setSignature] = useState<TimeSignature | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!user) return;
		let active = true;
		readSightReadingBpm(user.uid).then((saved) => {
			if (!active || !saved) return;
			setBpm(saved);
			const parsed = Number.parseInt(saved, 10);
			if (!Number.isNaN(parsed)) setSavedBpm(parsed);
		});
		readSightReadingSignature(user.uid).then((saved) => {
			if (active) setSignature(saved);
		});
		return () => {
			active = false;
		};
	}, [user]);

	const handleChange = (text: string) => {
		setBpm(text);
		const err = validateBpm(text, t);
		setBpmError(err);
		if (err || !text.trim()) return;
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			if (user) writeSightReadingBpm(user.uid, text.trim());
		}, DEBOUNCE_MS);
	};

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	const coach = useCoach();
	usePracticeHeading(t("screen.session.coach.sightReadingTitle"), null);
	useRegisterCoachSave(
		useCallback(async () => {
			if (!user) return { saved: false };
			setError(null);
			try {
				await addSightReadingLog(user.uid, {
					date: new Date(),
					elapsedSeconds,
					achievedBpm: effectiveBpm,
					keptGoing,
				});
				return { saved: true };
			} catch {
				setError(t("error.firebase"));
				return { saved: false };
			}
		}, [user, elapsedSeconds, effectiveBpm, keptGoing, t]),
	);

	return (
		<View style={{ flex: 1 }}>
			<ScreenContent gap={4} paddingBottom={space.md} style={{ flex: 1 }}>
				<Text
					variant="bodyLarge"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{t("screen.session.coach.sightReadingBody")}
				</Text>
				<TempoControl
					value={bpm}
					onChangeText={handleChange}
					onEffectiveBpmChange={setEffectiveBpm}
					error={bpmError}
					onBlur={(text) => setBpmError(validateBpm(text, t))}
					stopRef={stopRef}
					fullRange
					last={savedBpm}
					accent={{
						signature,
						// Writes land on the device key — planTimeSignatureWrite has no sight-reading leg.
						planFor: () => ({ target: "sightReading" }),
						onChange: (next) => {
							setSignature(next);
							if (user) void writeSightReadingSignature(user.uid, next);
						},
						onClear: () => {
							setSignature(null);
							if (user) void writeSightReadingSignature(user.uid, null);
						},
					}}
				/>
				<Divider />
				<EstimationField
					label={t("screen.session.coach.keptGoingLabel")}
					value={keptGoing}
					onChange={setKeptGoing}
					options={keptGoingOptions(t)}
				/>
			</ScreenContent>
			<PracticeFooter
				primaryLabel={t("screen.session.coach.saveAndNext")}
				onPrimary={coach.saveAndNext}
				primaryLoading={coach.saving}
				onSkip={coach.skipBlock}
				onExtend={coach.extendBlock}
			/>
			<ErrorSnackbar error={error} onDismiss={() => setError(null)} />
		</View>
	);
}
