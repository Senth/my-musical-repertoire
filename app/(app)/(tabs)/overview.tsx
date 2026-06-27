import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import {
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
import { LoadingScreen } from "@/components/ui/CenteredScreen";
import { PieceProgressBar } from "@/components/ui/PieceProgressBar";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useAuth } from "@/contexts/AuthContext";
import { useFabStyleTabs } from "@/hooks/use-fab-style";
import { useFabVisible } from "@/hooks/use-fab-visible";
import { usePieces } from "@/hooks/use-pieces";
import { useAllSections } from "@/hooks/use-sections";
import { useTechniques } from "@/hooks/use-techniques";
import {
	type ActiveSession,
	SESSION_EMPHASES,
	type SessionEmphasis,
} from "@/models/session";
import { suggestPieces, suggestTechniques } from "@/utils/overview-suggestions";
import { clearActiveSession, readActiveSession } from "@/utils/session-storage";

export default function OverviewScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { user } = useAuth();
	const { pieces, loading: piecesLoading } = usePieces();
	const { techniques, loading: techniquesLoading } = useTechniques();
	const { sections, loading: sectionsLoading } = useAllSections();
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

	const now = useMemo(() => new Date(), []);
	const pieceSuggestions = useMemo(
		() => suggestPieces(pieces, sections, now),
		[pieces, sections, now],
	);
	const techniqueSuggestions = useMemo(
		() => suggestTechniques(techniques, now),
		[techniques, now],
	);

	if (piecesLoading || techniquesLoading || sectionsLoading) {
		return <LoadingScreen />;
	}

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<ScreenContent
				gap={4}
				paddingBottom={tabBarHeight + 96}
				style={{ flex: 1 }}
			>
				<SessionEntryBlock
					activeSession={activeSession}
					onEnd={handleEndSession}
					onResume={() => router.push("/session/coach")}
					onStart={(em) =>
						router.push(`/session/setup?emphasis=${em}` as const)
					}
				/>

				<Text variant="titleMedium">{t("screen.overview.practiceToday")}</Text>

				{pieceSuggestions.emptyStateKey && (
					<Text
						variant="bodyLarge"
						style={{
							color: theme.colors.onSurfaceVariant,
							textAlign: "center",
						}}
					>
						{t(pieceSuggestions.emptyStateKey as Parameters<typeof t>[0])}
					</Text>
				)}

				{pieceSuggestions.suggestions.map((s) => (
					<Card
						key={s.piece.id}
						mode="elevated"
						onPress={() => router.push(`/piece/${s.piece.id}`)}
					>
						<Card.Title title={s.piece.title} subtitle={s.piece.composer} />
						<Card.Content>
							<View className="gap-2">
								<View className="flex-row items-center gap-2 flex-wrap">
									<PieceStateChip state={s.piece.state} />
									{(s.piece.sectionCount ?? 0) > 0 && (
										<Text
											variant="bodySmall"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											{t("piece.sectionCount", {
												count: s.piece.sectionCount,
											})}
										</Text>
									)}
								</View>
								<PieceProgressBar
									technicalMistakes={s.piece.lastTechnicalMistakes}
									memoryMistakes={s.piece.lastMemoryMistakes}
								/>
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{t(s.reasonKey as Parameters<typeof t>[0], s.reasonParams)}
								</Text>
								<Button
									mode="contained-tonal"
									compact
									onPress={() =>
										router.push(`/piece/${s.piece.id}/practice?from=overview`)
									}
								>
									{t("screen.overview.practice")}
								</Button>
							</View>
						</Card.Content>
					</Card>
				))}

				{pieces.length > 0 && (
					<Button
						mode="text"
						onPress={() => router.push("/(app)/(tabs)/piece")}
						icon="format-list-bulleted"
					>
						{t("screen.overview.seeAllPieces")}
					</Button>
				)}

				<Text variant="titleMedium">{t("screen.overview.techniqueToday")}</Text>

				{techniqueSuggestions.emptyStateKey && (
					<Text
						variant="bodyLarge"
						style={{
							color: theme.colors.onSurfaceVariant,
							textAlign: "center",
						}}
					>
						{t(techniqueSuggestions.emptyStateKey as Parameters<typeof t>[0])}
					</Text>
				)}

				{techniqueSuggestions.suggestions.map((s) => (
					<Card
						key={s.tech.id}
						mode="elevated"
						onPress={() => router.push(`/technique/${s.tech.id}`)}
					>
						<Card.Title title={s.tech.title} />
						<Card.Content>
							<View className="gap-2">
								<View className="flex-row items-center gap-2 flex-wrap">
									<TechniqueStateChip state={s.tech.state} />
									{s.tech.type && (
										<Chip compact textStyle={{ fontSize: 11 }}>
											{t(
												`technique.type.${s.tech.type}` as Parameters<
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
									{t(s.reasonKey as Parameters<typeof t>[0], s.reasonParams)}
								</Text>
								<Button
									mode="contained-tonal"
									compact
									onPress={() =>
										router.push(
											`/technique/${s.tech.id}/practice?from=overview`,
										)
									}
								>
									{t("screen.overview.practice")}
								</Button>
							</View>
						</Card.Content>
					</Card>
				))}

				<Button
					mode="text"
					onPress={() => router.push("/(app)/(tabs)/technique")}
					icon="format-list-bulleted"
				>
					{t("screen.overview.seeAllTechniques")}
				</Button>
			</ScreenContent>

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
