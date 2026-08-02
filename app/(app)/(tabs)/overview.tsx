import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import {
	Button,
	Card,
	Dialog,
	Divider,
	FAB,
	IconButton,
	Menu,
	Portal,
	Surface,
	Text,
	useTheme,
} from "react-native-paper";
import { PieceStateChip } from "@/components/piece/PieceStateChip";
import { TechniqueStateChip } from "@/components/technique/TechniqueStateChip";
import { LoadingScreen } from "@/components/ui/CenteredScreen";
import {
	accentBorderStyle,
	CARD_TITLE_STYLE,
	TITLE_ONLY_CARD_STYLE,
} from "@/components/ui/card-style";
import { PieceProgressBar } from "@/components/ui/PieceProgressBar";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { MetaChip } from "@/components/ui/StateChip";
import { useAuth } from "@/contexts/AuthContext";
import { useFabStyleTabs } from "@/hooks/use-fab-style";
import { useFabVisible } from "@/hooks/use-fab-visible";
import { usePieces } from "@/hooks/use-pieces";
import { useAllSections } from "@/hooks/use-sections";
import {
	useSessionPresetActions,
	useSessionPresets,
} from "@/hooks/use-session-presets";
import { useTechniques } from "@/hooks/use-techniques";
import { type ActiveSession, planPresetName } from "@/models/session";
import {
	presetTotalMinutes,
	SCRATCH_PRESET_ID,
	type SessionPreset,
} from "@/models/session-preset";
import { displayMinutes } from "@/utils/format-minutes";
import { suggestPieces, suggestTechniques } from "@/utils/overview-suggestions";
import { planTotalMinutes } from "@/utils/session-planner";
import { clearActiveSession, readActiveSession } from "@/utils/session-storage";
import { pieceStateVisual, techniqueStateVisual } from "@/utils/state-colors";

/** MD3 one-line list item with supporting trailing text. */
const SESSION_ROW_HEIGHT = 56;
/** Width of an `IconButton`, so rows without one still line up. */
const OVERFLOW_SLOT_WIDTH = 48;

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
						style={accentBorderStyle(
							pieceStateVisual(s.piece.state, theme.dark),
						)}
					>
						<Card.Title
							title={s.piece.title}
							titleStyle={CARD_TITLE_STYLE}
							subtitle={s.piece.composer}
							subtitleStyle={{ color: theme.colors.onSurfaceVariant }}
						/>
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
						style={accentBorderStyle(
							techniqueStateVisual(s.tech.state, theme.dark),
						)}
					>
						<Card.Title
							title={s.tech.title}
							titleStyle={CARD_TITLE_STYLE}
							style={TITLE_ONLY_CARD_STYLE}
						/>
						<Card.Content>
							<View className="gap-2">
								<View className="flex-row items-center gap-2 flex-wrap">
									<TechniqueStateChip state={s.tech.state} />
									{s.tech.type && (
										<MetaChip
											label={t(
												`technique.type.${s.tech.type}` as Parameters<
													typeof t
												>[0],
											)}
										/>
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
	onResume,
	onEnd,
}: {
	activeSession: ActiveSession | null;
	onResume: () => void;
	onEnd: () => void;
}) {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { presets, scratch, loading } = useSessionPresets();
	const { addPreset, deletePreset } = useSessionPresetActions();
	// Anchored by press coordinates so the Menu can stay unmounted until opened:
	// a mounted-but-closed Paper Menu steals focus on web.
	const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(
		null,
	);
	const [pendingDelete, setPendingDelete] = useState<SessionPreset | null>(
		null,
	);

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
								// Sessions started before presets existed have no name — a
								// generic label beats losing the session mid-practice.
								preset: planPresetName(
									activeSession.plan,
									t("screen.session.legacyPresetName"),
								),
								minutes: displayMinutes(planTotalMinutes(activeSession.plan))
									.minutes,
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

	const duplicate = async (preset: SessionPreset) => {
		setMenu(null);
		await addPreset(
			t("screen.session.preset.copyName", { name: preset.name }),
			preset.lines,
			preset.order + 1,
		);
	};

	return (
		<View className="gap-2">
			<Text variant="titleMedium">{t("screen.session.newSession")}</Text>

			{!loading && presets.length === 0 && (
				<Text
					variant="bodyMedium"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{t("screen.session.preset.empty")}
				</Text>
			)}

			{presets.map((preset) => (
				<Card
					key={preset.id}
					mode="contained"
					onPress={() =>
						router.push(`/session/setup?presetId=${preset.id}` as const)
					}
				>
					<View
						className="flex-row items-center"
						style={{
							minHeight: SESSION_ROW_HEIGHT,
							paddingLeft: 16,
							paddingRight: 4,
						}}
					>
						<View className="flex-1 flex-row items-center gap-3">
							<Text variant="bodyLarge" className="flex-1">
								{preset.name}
							</Text>
							<Text
								variant="bodyMedium"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{t("screen.session.preset.minutes", {
									minutes: presetTotalMinutes(preset.lines),
								})}
							</Text>
						</View>
						<IconButton
							icon="dots-vertical"
							accessibilityLabel={t("screen.session.preset.rowActions", {
								name: preset.name,
							})}
							onPress={(e) =>
								setMenu({
									id: preset.id ?? "",
									x: e.nativeEvent.pageX,
									y: e.nativeEvent.pageY,
								})
							}
						/>
						{menu !== null && menu.id === preset.id && (
							<Menu
								visible
								onDismiss={() => setMenu(null)}
								anchor={{ x: menu.x, y: menu.y }}
							>
								<Menu.Item
									leadingIcon="pencil"
									title={t("screen.session.preset.edit")}
									onPress={() => {
										setMenu(null);
										router.push(
											`/session/preset-editor?presetId=${preset.id}` as const,
										);
									}}
								/>
								<Menu.Item
									leadingIcon="content-copy"
									title={t("screen.session.preset.duplicate")}
									onPress={() => duplicate(preset)}
								/>
								<Menu.Item
									leadingIcon="delete"
									title={t("screen.session.preset.delete")}
									onPress={() => {
										setMenu(null);
										setPendingDelete(preset);
									}}
								/>
							</Menu>
						)}
					</View>
				</Card>
			))}

			<Divider />

			{/* Always present, so deleting every preset is never a dead end. */}
			<Card
				mode="contained"
				onPress={() =>
					router.push(
						`/session/preset-editor?presetId=${SCRATCH_PRESET_ID}` as const,
					)
				}
			>
				<View
					className="flex-row items-center"
					style={{
						minHeight: SESSION_ROW_HEIGHT,
						paddingLeft: 16,
						paddingRight: 4,
					}}
				>
					<View className="flex-1 flex-row items-center gap-3">
						<Text variant="bodyLarge" className="flex-1">
							{t("screen.session.preset.customRow")}
						</Text>
						{scratch ? (
							<Text
								variant="bodyMedium"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{t("screen.session.preset.minutes", {
									minutes: presetTotalMinutes(scratch.lines),
								})}
							</Text>
						) : null}
					</View>
					{/* Keeps the minutes column aligned with the preset rows, whose
					    trailing overflow button occupies the same width. */}
					<View style={{ width: OVERFLOW_SLOT_WIDTH }} />
				</View>
			</Card>

			<Button
				mode="text"
				icon="tune"
				onPress={() => router.push("/session/manage-presets")}
			>
				{t("screen.session.preset.manage")}
			</Button>

			<Portal>
				<Dialog
					visible={pendingDelete != null}
					onDismiss={() => setPendingDelete(null)}
				>
					<Dialog.Title>
						{t("screen.session.manage.deleteTitle", {
							name: pendingDelete?.name ?? "",
						})}
					</Dialog.Title>
					<Dialog.Content>
						<Text variant="bodyMedium">
							{t("screen.session.manage.deleteMessage")}
						</Text>
					</Dialog.Content>
					<Dialog.Actions>
						<Button onPress={() => setPendingDelete(null)}>
							{t("screen.session.manage.cancel")}
						</Button>
						<Button
							onPress={async () => {
								const target = pendingDelete;
								setPendingDelete(null);
								if (target?.id) await deletePreset(target.id);
							}}
						>
							{t("screen.session.manage.confirmDelete")}
						</Button>
					</Dialog.Actions>
				</Dialog>
			</Portal>
		</View>
	);
}
