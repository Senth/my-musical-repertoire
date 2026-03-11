import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";
import {
	ActivityIndicator,
	Button,
	Card,
	FAB,
	Text,
	useTheme,
} from "react-native-paper";
import { PieceProgressBar } from "@/components/ui/PieceProgressBar";
import { usePieces } from "@/hooks/use-pieces";
import type { Piece } from "@/models/piece";
import { PracticeMistakes } from "@/models/practice";
import { formatDaysAgo } from "@/utils/date";

const MD3_MEDIUM_BREAKPOINT = 600;

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
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

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
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<View
				className="flex-1 gap-4"
				style={{ paddingHorizontal: isCompact ? 16 : 24, paddingTop: 24 }}
			>
				<View className="w-full max-w-xl self-center gap-4">
					{pieces.length === 0 ? (
						<View className="flex-1 items-center justify-center">
							<Text
								variant="bodyLarge"
								style={{
									color: theme.colors.onSurfaceVariant,
									textAlign: "center",
								}}
							>
								{t("screen.overview.noPieces")}
							</Text>
						</View>
					) : (
						<>
							<Text variant="titleMedium">
								{t("screen.overview.practiceToday")}
							</Text>

							{suggested.length === 0 ? (
								<Text
									variant="bodyLarge"
									style={{
										color: theme.colors.onSurfaceVariant,
										textAlign: "center",
									}}
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
										<Card.Title title={piece.title} subtitle={piece.composer} />
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
