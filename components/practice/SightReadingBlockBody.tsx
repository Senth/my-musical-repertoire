import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useAuth } from "@/contexts/AuthContext";
import { useCoach, usePracticeHeading } from "@/contexts/CoachContext";
import {
	readSightReadingBpm,
	readSightReadingSignature,
	writeSightReadingBpm,
	writeSightReadingSignature,
} from "@/utils/session-storage";
import type { TimeSignature } from "@/utils/time-signature";
import { validateBpm } from "@/utils/validation";
import { PracticeFooter } from "./PracticeFooter";
import { TempoControl } from "./TempoControl";

interface SightReadingBlockBodyProps {
	stopRef: React.MutableRefObject<(() => void) | null>;
}

const DEBOUNCE_MS = 500;

export function SightReadingBlockBody({ stopRef }: SightReadingBlockBodyProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const { user } = useAuth();
	const [bpm, setBpm] = useState("");
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

	return (
		<View style={{ flex: 1 }}>
			<ScreenContent gap={4} paddingBottom={12} style={{ flex: 1 }}>
				<Text
					variant="bodyLarge"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{t("screen.session.coach.sightReadingBody")}
				</Text>
				<TempoControl
					value={bpm}
					onChangeText={handleChange}
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
			</ScreenContent>
			<PracticeFooter
				primaryLabel={t("screen.session.coach.saveAndNext")}
				onPrimary={coach.saveAndNext}
				primaryLoading={coach.saving}
				onSkip={coach.skipBlock}
				onExtend={coach.extendBlock}
			/>
		</View>
	);
}
