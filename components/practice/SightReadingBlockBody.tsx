import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, useTheme } from "react-native-paper";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useAuth } from "@/contexts/AuthContext";
import {
	readSightReadingBpm,
	writeSightReadingBpm,
} from "@/utils/session-storage";
import { validateBpm } from "@/utils/validation";
import { BpmControl } from "./BpmControl";

interface SightReadingBlockBodyProps {
	stopRef: React.MutableRefObject<(() => void) | null>;
}

const DEBOUNCE_MS = 500;

export function SightReadingBlockBody({ stopRef }: SightReadingBlockBodyProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const { user } = useAuth();
	const [bpm, setBpm] = useState("");
	const [bpmError, setBpmError] = useState<string | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!user) return;
		let active = true;
		readSightReadingBpm(user.uid).then((saved) => {
			if (active && saved) setBpm(saved);
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

	return (
		<ScreenContent gap={4}>
			<Text
				variant="bodyLarge"
				style={{ color: theme.colors.onSurfaceVariant }}
			>
				{t("screen.session.coach.sightReadingBody")}
			</Text>
			<BpmControl
				value={bpm}
				onChangeText={handleChange}
				error={bpmError}
				onBlur={() => setBpmError(validateBpm(bpm, t))}
				stopRef={stopRef}
			/>
		</ScreenContent>
	);
}
