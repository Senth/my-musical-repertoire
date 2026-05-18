import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, useWindowDimensions, View } from "react-native";
import {
	ActivityIndicator,
	Button,
	Card,
	Chip,
	FAB,
	Text,
	useTheme,
} from "react-native-paper";
import { PieceStateChip } from "@/components/piece/PieceStateChip";
import { TechniqueStateChip } from "@/components/technique/TechniqueStateChip";
import { PieceProgressBar } from "@/components/ui/PieceProgressBar";
import { usePieces } from "@/hooks/use-pieces";
import { useTechniques } from "@/hooks/use-techniques";
import type { Piece } from "@/models/piece";
import { PracticeMistakes } from "@/models/practice";
import type { TechniqueItem } from "@/models/technique";
import { formatDaysAgo } from "@/utils/date";

const MD3_MEDIUM_BREAKPOINT = 600;

function getSuggestedPieces(pieces: Piece[], count = 3): Piece[] {
	const active = pieces.filter(
		(p) => p.state !== "on_hold" && p.state !== "shelved",
	);

	const unpracticed = active.filter((p) => !p.lastPracticed);
	const practiced = active.filter((p) => p.lastPracticed);

	const sorted = [...practiced].sort((a, b) => {
		// Performance pieces get highest priority
		if (a.state === "performance" && b.state !== "performance") return -1;
		if (b.state === "performance" && a.state !== "performance") return 1;

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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getSuggestedTechniques(items: TechniqueItem[]): TechniqueItem[] {
	const now = new Date();

	const byRecency = (a: TechniqueItem, b: TechniqueItem) => {
		if (!a.lastPracticedAt && !b.lastPracticedAt) return 0;
		if (!a.lastPracticedAt) return -1;
		if (!b.lastPracticedAt) return 1;
		return a.lastPracticedAt.getTime() - b.lastPracticedAt.getTime();
	};

	const active = items
		.filter((i) => i.state === "active")
		.sort(byRecency)
		.slice(0, 2);

	const maintenance = items
		.filter(
			(i) =>
				i.state === "maintenance" &&
				(!i.lastPracticedAt ||
					now.getTime() - i.lastPracticedAt.getTime() >= SEVEN_DAYS_MS),
		)
		.sort(byRecency)
		.slice(0, 1);

	return [...active, ...maintenance];
}

export default function OverviewScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { pieces, loading: piecesLoading } = usePieces();
	const { techniques, loading: techniquesLoading } = useTechniques();
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;
	const tabBarHeight = useBottomTabBarHeight();
	const [fabOpen, setFabOpen] = useState(false);

	const suggested = getSuggestedPieces(pieces);
	const suggestedTechniques = getSuggestedTechniques(techniques);

	if (piecesLoading || techniquesLoading) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: theme.colors.background }}
			>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	const getTechniqueReason = (item: TechniqueItem): string => {
		if (!item.lastPracticedAt) {
			return t("screen.overview.techniqueReason.neverPracticed");
		}
		if (item.state === "maintenance") {
			return t("screen.overview.techniqueReason.maintenanceDue");
		}
		return t("screen.overview.techniqueReason.activeLastPracticed", {
			when: formatDaysAgo(item.lastPracticedAt, t),
		});
	};

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<ScrollView
				contentContainerStyle={{
					paddingHorizontal: isCompact ? 16 : 24,
					paddingTop: 24,
					paddingBottom: tabBarHeight + 96,
				}}
			>
				<View className="w-full max-w-xl self-center gap-4">
					<Text variant="titleMedium">
						{t("screen.overview.practiceToday")}
					</Text>

					{pieces.length === 0 ? (
						<Text
							variant="bodyLarge"
							style={{
								color: theme.colors.onSurfaceVariant,
								textAlign: "center",
							}}
						>
							{t("screen.overview.noPieces")}
						</Text>
					) : suggested.length === 0 ? (
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
								onPress={() => router.push(`/piece/${piece.id}`)}
							>
								<Card.Title title={piece.title} subtitle={piece.composer} />
								<Card.Content>
									<View className="gap-2">
										<View className="flex-row items-center gap-2 flex-wrap">
											<PieceStateChip state={piece.state} />
											{(piece.sectionCount ?? 0) > 0 && (
												<Text
													variant="bodySmall"
													style={{ color: theme.colors.onSurfaceVariant }}
												>
													{t("piece.sectionCount", {
														count: piece.sectionCount,
													})}
												</Text>
											)}
										</View>
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
										<Button
											mode="contained-tonal"
											compact
											onPress={() => router.push(`/piece/${piece.id}/practice?from=overview`)}
										>
											{t("screen.overview.practice")}
										</Button>
									</View>
								</Card.Content>
							</Card>
						))
					)}

					{pieces.length > 0 && (
						<Button
							mode="text"
							onPress={() => router.push("/(app)/(tabs)/piece")}
							icon="format-list-bulleted"
						>
							{t("screen.overview.seeAllPieces")}
						</Button>
					)}

					<Text variant="titleMedium">
						{t("screen.overview.techniqueToday")}
					</Text>

					{suggestedTechniques.length === 0 ? (
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
						suggestedTechniques.map((item) => (
							<Card
								key={item.id}
								mode="elevated"
								onPress={() => router.push(`/technique/${item.id}`)}
							>
								<Card.Title title={item.title} />
								<Card.Content>
									<View className="gap-2">
										<View className="flex-row items-center gap-2 flex-wrap">
											<TechniqueStateChip state={item.state} />
											{item.type && (
												<Chip compact textStyle={{ fontSize: 11 }}>
													{t(
														`technique.type.${item.type}` as Parameters<
															typeof t
														>[0],
													)}
												</Chip>
											)}
										</View>
										<Text
											variant="bodySmall"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											{getTechniqueReason(item)}
										</Text>
										<Button
											mode="contained-tonal"
											compact
											onPress={() =>
												router.push(`/technique/${item.id}/practice?from=overview`)
											}
										>
											{t("screen.overview.practice")}
										</Button>
									</View>
								</Card.Content>
							</Card>
						))
					)}

					<Button
						mode="text"
						onPress={() => router.push("/(app)/(tabs)/technique")}
						icon="format-list-bulleted"
					>
						{t("screen.overview.seeAllTechniques")}
					</Button>
				</View>
			</ScrollView>

			<FAB.Group
				open={fabOpen}
				visible
				icon={fabOpen ? "close" : "plus"}
				accessibilityLabel={t("a11y.fab.add")}
				actions={[
					{
						icon: "music",
						label: t("a11y.fab.addPiece"),
						onPress: () => {
							setFabOpen(false);
							router.push("/piece/add");
						},
						accessibilityLabel: t("a11y.fab.addPiece"),
					},
					{
						icon: "piano",
						label: t("a11y.fab.addTechnique"),
						onPress: () => {
							setFabOpen(false);
							router.push("/technique/add");
						},
						accessibilityLabel: t("a11y.fab.addTechnique"),
					},
				]}
				onStateChange={({ open }) => setFabOpen(open)}
				style={{
					position: "absolute",
					right: 16,
					bottom: tabBarHeight + 16,
				}}
			/>
		</View>
	);
}
