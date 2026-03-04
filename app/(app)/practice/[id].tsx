import { useState } from "react";
import { View, Platform } from "react-native";
import { Text, Button, Appbar, Snackbar, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useRouter, useLocalSearchParams } from "expo-router";
import { usePieces } from "@/hooks/use-pieces";
import { useSavePractice } from "@/hooks/use-practices";
import { PracticeMistakes } from "@/models/practice";
import { MistakeRating } from "@/components/practice/MistakeRating";

function formatDateForInput(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export default function PracticeScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	const { pieces } = usePieces();
	const { savePractice } = useSavePractice();

	const piece = pieces.find((p) => p.id === id);

	const [date, setDate] = useState(formatDateForInput(new Date()));
	const [technicalMistakes, setTechnicalMistakes] = useState<PracticeMistakes>(
		PracticeMistakes.none,
	);
	const [memoryMistakes, setMemoryMistakes] = useState<PracticeMistakes>(
		PracticeMistakes.none,
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSave = async () => {
		if (!id) return;

		setLoading(true);
		setError(null);

		try {
			const practiceDate = new Date(`${date}T12:00:00`);
			await savePractice(id, practiceDate, technicalMistakes, memoryMistakes);
			router.back();
		} catch {
			setError(t("error.firebase"));
		} finally {
			setLoading(false);
		}
	};

	if (!piece) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: theme.colors.background }}
			>
				<Text variant="bodyLarge">Piece not found</Text>
			</View>
		);
	}

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
				<Appbar.BackAction
					onPress={() => router.back()}
					color={theme.colors.onPrimary}
				/>
				<Appbar.Content
					title={piece.title}
					titleStyle={{ color: theme.colors.onPrimary }}
				/>
			</Appbar.Header>

			<View className="p-4 gap-6">
				<Text variant="headlineSmall">
					{piece.composer} — {piece.title}
				</Text>

				<View className="gap-2">
					<Text variant="titleSmall">{t("screen.practice.dateLabel")}</Text>
					{Platform.OS === "web" ? (
						<input
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							style={{
								padding: 12,
								borderRadius: 4,
								border: `1px solid ${theme.colors.outline}`,
								backgroundColor: theme.colors.surface,
								color: theme.colors.onSurface,
								fontSize: 16,
							}}
						/>
					) : (
						<Button
							mode="outlined"
							onPress={() => {
								/* TODO: Native date picker */
							}}
						>
							{new Date(`${date}T12:00:00`).toLocaleDateString()}
						</Button>
					)}
				</View>

				<MistakeRating
					label={t("screen.practice.technicalMistakes")}
					value={technicalMistakes}
					onChange={setTechnicalMistakes}
				/>

				<MistakeRating
					label={t("screen.practice.memoryMistakes")}
					value={memoryMistakes}
					onChange={setMemoryMistakes}
				/>

				<Button
					mode="contained"
					onPress={handleSave}
					loading={loading}
					disabled={loading}
				>
					{t("screen.practice.save")}
				</Button>
			</View>

			<Snackbar
				visible={!!error}
				onDismiss={() => setError(null)}
				duration={4000}
				action={{ label: "OK", onPress: () => setError(null) }}
			>
				{error ?? ""}
			</Snackbar>
		</View>
	);
}
