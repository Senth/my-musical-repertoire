import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, View } from "react-native";
import { Appbar, Button, Snackbar, Text, useTheme } from "react-native-paper";
import { MistakeRadioGroup } from "@/components/practice/MistakeRadioGroup";
import { PracticeComparison } from "@/components/practice/PracticeComparison";
import { usePieces } from "@/hooks/use-pieces";
import { useSavePractice } from "@/hooks/use-practices";
import { PracticeMistakes } from "@/models/practice";
import { formatDaysAgo } from "@/utils/date";

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

	// Capture previous practice data before save overwrites it
	const previousDataRef = useRef({
		technicalMistakes: piece?.lastTechnicalMistakes,
		memoryMistakes: piece?.lastMemoryMistakes,
	});

	const [date, setDate] = useState(formatDateForInput(new Date()));
	const [technicalMistakes, setTechnicalMistakes] = useState<PracticeMistakes>(
		PracticeMistakes.none,
	);
	const [memoryMistakes, setMemoryMistakes] = useState<PracticeMistakes>(
		PracticeMistakes.none,
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	const handleSave = async () => {
		if (!id) return;

		setLoading(true);
		setError(null);

		try {
			const practiceDate = new Date(`${date}T12:00:00`);
			await savePractice(id, practiceDate, technicalMistakes, memoryMistakes);
			setSaved(true);
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
					title={t("screen.practice.title")}
					titleStyle={{ color: theme.colors.onPrimary }}
				/>
			</Appbar.Header>

			{saved ? (
				<PracticeComparison
					pieceName={`${piece.composer} — ${piece.title}`}
					currentTechnical={technicalMistakes}
					currentMemory={memoryMistakes}
					previousTechnical={previousDataRef.current.technicalMistakes}
					previousMemory={previousDataRef.current.memoryMistakes}
				/>
			) : (
				<ScrollView>
					<View className="p-4 gap-6">
						<View className="gap-1">
							<Text variant="headlineSmall">{piece.title}</Text>
							<Text
								variant="bodyLarge"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{piece.composer}
							</Text>
						</View>

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
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{t("screen.practice.lastPracticed", {
									when: formatDaysAgo(piece.lastPracticed, t),
								})}
							</Text>
						</View>

						<MistakeRadioGroup
							label={t("screen.practice.technicalMistakes")}
							value={technicalMistakes}
							onChange={setTechnicalMistakes}
						/>

						<MistakeRadioGroup
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
				</ScrollView>
			)}

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
