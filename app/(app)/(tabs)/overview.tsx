import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import {
	ActivityIndicator,
	Button,
	Card,
	Chip,
	FAB,
	IconButton,
	Portal,
	Surface,
	Text,
	useTheme,
} from "react-native-paper";
import { PieceStateChip } from "@/components/piece/PieceStateChip";
import { TechniqueStateChip } from "@/components/technique/TechniqueStateChip";
import { PieceProgressBar } from "@/components/ui/PieceProgressBar";
import { useAuth } from "@/contexts/AuthContext";
import { useFabStyleTabs } from "@/hooks/use-fab-style";
import { useFabVisible } from "@/hooks/use-fab-visible";
import { usePieces } from "@/hooks/use-pieces";
import { useTechniques } from "@/hooks/use-techniques";
import type { Piece } from "@/models/piece";
import { PracticeMistakes } from "@/models/practice";
import {
	type ActiveSession,
	SESSION_EMPHASES,
	type SessionEmphasis,
} from "@/models/session";
import type { TechniqueItem } from "@/models/technique";
import { formatDaysAgo } from "@/utils/date";
import { clearActiveSession, readActiveSession } from "@/utils/session-storage";

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
	const { user } = useAuth();
	const { pieces, loading: piecesLoading } = usePieces();
	const { techniques, loading: techniquesLoading } = useTechniques();
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;
	const tabBarHeight = useBottomTabBarHeight();
	const fabStyle = useFabStyleTabs();
	const fabVisible = useFabVisible();
	const [fabOpen, setFabOpen] = useState(false);
	const [activeSession, setActiveSession] = useState<ActiveSession | null>(
		null,
	);

	const reloadActiveSession = useCallback(async () => {
		if (!user) {
			setActiveSession(null);
			return;
		}
		const s = await readActiveSession(user.uid);
		setActiveSession(s);
	}, [user]);

	useFocusEffect(
		useCallback(() => {
			reloadActiveSession();
		}, [reloadActiveSession]),
	);

	const handleEndSession = useCallback(async () => {
		if (!user) return;
		await clearActiveSession(user.uid);
		setActiveSession(null);
	}, [user]);

	useEffect(() => {
		if (!fabVisible) setFabOpen(false);
	}, [fabVisible]);

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
				style={{ flex: 1 }}
				contentContainerStyle={{
					paddingHorizontal: isCompact ? 16 : 24,
					paddingTop: 24,
					paddingBottom: tabBarHeight + 96,
				}}
			>
				<View className="w-full max-w-xl self-center gap-4">
					<SessionEntryBlock
						activeSession={activeSession}
						onEnd={handleEndSession}
						onResume={() => router.push("/session/coach")}
						onStart={(em) =>
							router.push(`/session/setup?emphasis=${em}` as const)
						}
					/>

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
											onPress={() =>
												router.push(`/piece/${piece.id}/practice?from=overview`)
											}
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
												router.push(
													`/technique/${item.id}/practice?from=overview`,
												)
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

			{fabVisible && (
				<Portal>
					{fabOpen && (
						<Pressable
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
							}}
							onPress={() => setFabOpen(false)}
						/>
					)}
					{fabOpen && (
						<View
							style={{
								position: "absolute",
								right: fabStyle.right as number,
								bottom: (fabStyle.bottom as number) + 56 + 8,
								alignItems: "flex-end",
								gap: 8,
							}}
						>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: 12,
								}}
							>
								<Surface style={{ borderRadius: 4, elevation: 2 }}>
									<Text
										variant="labelLarge"
										style={{ paddingHorizontal: 12, paddingVertical: 6 }}
									>
										{t("a11y.fab.addTechnique")}
									</Text>
								</Surface>
								<FAB
									size="small"
									icon="piano"
									onPress={() => {
										setFabOpen(false);
										router.push("/technique/add");
									}}
									accessibilityLabel={t("a11y.fab.addTechnique")}
								/>
							</View>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: 12,
								}}
							>
								<Surface style={{ borderRadius: 4, elevation: 2 }}>
									<Text
										variant="labelLarge"
										style={{ paddingHorizontal: 12, paddingVertical: 6 }}
									>
										{t("a11y.fab.addPiece")}
									</Text>
								</Surface>
								<FAB
									size="small"
									icon="music"
									onPress={() => {
										setFabOpen(false);
										router.push("/piece/add");
									}}
									accessibilityLabel={t("a11y.fab.addPiece")}
								/>
							</View>
						</View>
					)}
					<FAB
						icon={fabOpen ? "close" : "plus"}
						accessibilityLabel={t("a11y.fab.add")}
						style={fabStyle}
						onPress={() => setFabOpen(!fabOpen)}
					/>
				</Portal>
			)}
		</View>
	);
}

function SessionEntryBlock({
	activeSession,
	onStart,
	onResume,
	onEnd,
}: {
	activeSession: ActiveSession | null;
	onStart: (emphasis: SessionEmphasis) => void;
	onResume: () => void;
	onEnd: () => void;
}) {
	const { t } = useTranslation();
	const theme = useTheme();
	if (activeSession) {
		const current =
			activeSession.plan.blocks[activeSession.currentBlockIndex] ?? null;
		const blockTitle =
			current?.title ??
			(current ? t(`screen.session.block.${current.kind}` as const) : "");
		return (
			<Card
				mode="contained"
				style={{ backgroundColor: theme.colors.primaryContainer }}
			>
				<Card.Content>
					<View className="gap-2">
						<Text variant="titleMedium">
							{t("screen.session.resume.banner", {
								emphasis: t(
									`screen.session.emphasis.${activeSession.plan.emphasis}` as const,
								),
								minutes: activeSession.plan.totalMinutes,
							})}
						</Text>
						<Text variant="bodyMedium">
							{t("screen.session.resume.blockOf", {
								current: activeSession.currentBlockIndex + 1,
								total: activeSession.plan.blocks.length,
								title: blockTitle,
							})}
						</Text>
						<View className="flex-row gap-2 mt-1">
							<Button mode="contained" onPress={onResume} icon="play">
								{t("screen.session.resume.resume")}
							</Button>
							<Button mode="outlined" onPress={onEnd}>
								{t("screen.session.resume.end")}
							</Button>
						</View>
					</View>
				</Card.Content>
			</Card>
		);
	}
	return (
		<View className="gap-2">
			<Text variant="titleMedium">{t("screen.session.newSession")}</Text>
			{SESSION_EMPHASES.map((em) => (
				<Card key={em} mode="contained" onPress={() => onStart(em)}>
					<View className="flex-row items-center justify-between pl-4 pr-1 py-1">
						<Text variant="bodyLarge">
							{t(`screen.session.emphasis.${em}` as const)}
						</Text>
						<IconButton
							icon="play"
							onPress={() => onStart(em)}
							accessibilityLabel={t(`screen.session.emphasis.${em}` as const)}
						/>
					</View>
				</Card>
			))}
		</View>
	);
}
