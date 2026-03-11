import { View } from "react-native";
import { Text, FAB, Card, Button, useTheme, ActivityIndicator } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { usePieces } from "@/hooks/use-pieces";
import { PieceProgressBar } from "@/components/ui/PieceProgressBar";
import { formatDaysAgo } from "@/utils/date";
import type { Piece } from "@/models/piece";
import { PracticeMistakes } from "@/models/practice";

function getSuggestedPieces(pieces: Piece[], count = 3): Piece[] {
	const unpracticed = pieces.filter((p) => !p.lastPracticed);
	const practiced = pieces.filter((p) => p.lastPracticed);

	// Sort practiced pieces by worst score (highest mistakes first)
	const sorted = [...practiced].sort((a, b) => {
		const scoreA =
			(a.lastTechnicalMistakes ?? PracticeMistakes.none) +
			(a.lastMemoryMistakes ?? PracticeMistakes.none);
		const scoreB =
			(b.lastTechnicalMistakes ?? PracticeMistakes.none) +
			(b.lastMemoryMistakes ?? PracticeMistakes.none);
		return scoreB - scoreA;
	});

	return [...unpracticed, ...sorted].slice(0, count);
}

export default function OverviewScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { pieces, loading } = usePieces();

	const suggested = getSuggestedPieces(pieces);

	if (loading) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: theme.colors.background }}
			>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	return (
		<View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
			<View className="flex-1 p-6 gap-4">
				{pieces.length === 0 ? (
					<View className="flex-1 items-center justify-center">
						<Text
							variant="bodyLarge"
							style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
						>
							{t("screen.overview.noPieces")}
						</Text>
					</View>
				) : (
					<>
						<Text variant="titleMedium">{t("screen.overview.practiceToday")}</Text>

						{suggested.length === 0 ? (
							<Text
								variant="bodyLarge"
								style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
							>
								{t("screen.overview.allCaughtUp")}
							</Text>
						) : (
							suggested.map((piece) => (
								<Card
									key={piece.id}
									mode="elevated"
									onPress={() => router.push(`/practice/${piece.id}`)}
								>
									<Card.Title
										title={piece.title}
										subtitle={piece.composer}
									/>
									<Card.Content>
										<View className="gap-2">
											<PieceProgressBar
												technicalMistakes={piece.lastTechnicalMistakes}
												memoryMistakes={piece.lastMemoryMistakes}
											/>
											<Text
												variant="bodySmall"
												style={{ color: theme.colors.onSurfaceVariant }}
											>
												{formatDaysAgo(piece.lastPracticed, t)}
											</Text>
										</View>
									</Card.Content>
								</Card>
							))
						)}

						<Button
							mode="text"
							onPress={() => router.push("/pieces")}
							icon="format-list-bulleted"
						>
							{t("screen.overview.seeAllPieces")}
						</Button>
					</>
				)}
			</View>

			<FAB
				icon="plus"
				style={{
					position: "absolute",
					right: 16,
					bottom: 16,
					backgroundColor: theme.colors.primaryContainer,
				}}
				onPress={() => router.push("/add-piece")}
			/>
		</View>
	);
}
