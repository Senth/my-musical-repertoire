import { randomUUID } from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, useWindowDimensions, View } from "react-native";
import {
	ActivityIndicator,
	Appbar,
	Button,
	Divider,
	HelperText,
	Menu,
	SegmentedButtons,
	Snackbar,
	Text,
	TextInput,
	useTheme,
} from "react-native-paper";
import { LastSessionCard } from "@/components/practice/LastSessionCard";
import { MetronomeButton } from "@/components/practice/MetronomeButton";
import { PracticeComparison } from "@/components/practice/PracticeComparison";
import { SectionsPracticePanel } from "@/components/practice/SectionsPracticePanel";
import { SectionPhaseChip } from "@/components/section/SectionPhaseChip";
import { TechniqueLogComparison } from "@/components/technique/TechniqueLogComparison";
import { DeletePieceDialog } from "@/components/ui/DeletePieceDialog";
import { useCoach, useRegisterCoachSave } from "@/contexts/CoachContext";
import { useLastPracticeLog } from "@/hooks/use-last-practice-log";
import { useDeletePiece, usePieces } from "@/hooks/use-pieces";
import { useSavePractice, useSaveSectionPractice } from "@/hooks/use-practices";
import { useSections } from "@/hooks/use-sections";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import { PracticeMistakes, type PracticeTrigger } from "@/models/practice";

const MD3_MEDIUM_BREAKPOINT = 600;

const MISTAKE_BUTTONS = [
	{
		value: String(PracticeMistakes.none),
		labelKey: "screen.practice.mistakeLevel.none",
	},
	{
		value: String(PracticeMistakes.few),
		labelKey: "screen.practice.mistakeLevel.few",
	},
	{
		value: String(PracticeMistakes.some),
		labelKey: "screen.practice.mistakeLevel.some",
	},
	{
		value: String(PracticeMistakes.many),
		labelKey: "screen.practice.mistakeLevel.many",
	},
	{
		value: String(PracticeMistakes.everywhere),
		labelKey: "screen.practice.mistakeLevel.everywhere",
	},
] as const;

export interface PiecePracticeContentProps {
	pieceId: string;
	sectionId?: string | null;
	from?: string;
	triggerOverride?: PracticeTrigger;
}

export function PiecePracticeContent({
	pieceId,
	sectionId: sectionIdProp,
	from,
	triggerOverride,
}: PiecePracticeContentProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const coach = useCoach();
	const inCoach = coach.inCoach;
	const { pieces, loading: piecesLoading } = usePieces();
	const { sections, loading: sectionsLoading } = useSections(pieceId);
	const { savePractice } = useSavePractice();
	const { saveSectionPractice } = useSaveSectionPractice();
	const { deletePiece } = useDeletePiece();
	const standaloneSessionId = useRef(randomUUID());
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

	const piece = pieces.find((p) => p.id === pieceId);

	const lastLogScope = sectionIdProp
		? { type: "section" as const, pieceId, sectionId: sectionIdProp }
		: { type: "piece" as const, pieceId };
	const { lastLog, loading: lastLogLoading } = useLastPracticeLog(lastLogScope);

	const getBackDestination = (): string => {
		if (from === "pieces") return "/(app)/(tabs)/piece";
		if (from === "piece-detail") return `/piece/${pieceId}`;
		return "/(app)/(tabs)/overview";
	};

	const getDoneDestination = (): string => {
		if (from === "overview") return "/(app)/(tabs)/overview";
		return "/(app)/(tabs)/piece";
	};

	const getBackLabel = (): string => {
		if (from === "overview")
			return t("screen.practice.comparison.backToOverview");
		return t("screen.practice.comparison.backToPieces");
	};

	const handleDone = () =>
		router.replace(
			getDoneDestination() as Parameters<typeof router.replace>[0],
		);

	const goBack = useUpNavigation(
		getBackDestination() as Parameters<typeof router.replace>[0],
	);

	const [technicalMistakes, setTechnicalMistakes] = useState<PracticeMistakes>(
		PracticeMistakes.none,
	);
	const [memoryMistakes, setMemoryMistakes] = useState<PracticeMistakes>(
		PracticeMistakes.none,
	);
	const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
	const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5>(3);
	const [flaggedSectionIds, setFlaggedSectionIds] = useState<string[]>([]);
	const [achievedBpm, setAchievedBpm] = useState<string>("");
	const [bpmError, setBpmError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const metronomeStopRef = useRef<(() => void) | null>(null);

	const validateBpm = useCallback(
		(text: string): string | null => {
			if (!text.trim()) return null;
			const n = Number.parseInt(text.trim(), 10);
			return Number.isNaN(n) || n < 20 || n > 240
				? t("error.bpmInvalid")
				: null;
		},
		[t],
	);

	const handleBpmBlur = () => {
		setBpmError(validateBpm(achievedBpm));
	};
	const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
	const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);

	const activeSections = useMemo(
		() => sections.filter((s) => !s.archived),
		[sections],
	);

	const scopedSection = sectionIdProp
		? (sections.find((s) => s.id === sectionIdProp) ?? null)
		: null;

	useEffect(() => {
		if (scopedSection) {
			setAchievedBpm(scopedSection.currentBpm?.toString() ?? "");
		} else {
			setAchievedBpm(piece?.lastAchievedTempoBpm?.toString() ?? "");
		}
	}, [scopedSection, piece]);

	const showCheckboxes =
		!scopedSection &&
		(technicalMistakes >= PracticeMistakes.some ||
			memoryMistakes >= PracticeMistakes.some);

	const handleToggleFlag = (sid: string) => {
		setFlaggedSectionIds((prev) =>
			prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
		);
	};

	const handlePracticeSection = (sid: string) => {
		metronomeStopRef.current?.();
		router.push(
			`/piece/${pieceId}/practice?sectionId=${sid}&from=${from ?? "overview"}`,
		);
	};

	const performSave = useCallback(async (): Promise<{ ok: boolean }> => {
		if (!pieceId) return { ok: false };
		const bpmErr = validateBpm(achievedBpm);
		setBpmError(bpmErr);
		if (bpmErr) return { ok: false };
		metronomeStopRef.current?.();
		setLoading(true);
		setError(null);
		const sessionId = coach.sessionId ?? standaloneSessionId.current;
		try {
			const practiceDate = new Date();
			const bpm = achievedBpm.trim()
				? Number.parseInt(achievedBpm.trim(), 10) || null
				: null;
			const triggeredFrom: PracticeTrigger =
				triggerOverride ?? (scopedSection ? "section-panel" : "full-piece");
			if (scopedSection) {
				if (!scopedSection.id) return { ok: false };
				await saveSectionPractice(
					pieceId,
					scopedSection.id,
					practiceDate,
					quality,
					effort,
					bpm,
					triggeredFrom,
					sessionId,
				);
			} else {
				await savePractice(
					pieceId,
					practiceDate,
					technicalMistakes,
					memoryMistakes,
					bpm,
					flaggedSectionIds,
					triggeredFrom,
					sessionId,
				);
			}
			return { ok: true };
		} catch {
			setError(t("error.firebase"));
			return { ok: false };
		} finally {
			setLoading(false);
		}
	}, [
		pieceId,
		validateBpm,
		achievedBpm,
		coach.sessionId,
		triggerOverride,
		scopedSection,
		flaggedSectionIds,
		savePractice,
		saveSectionPractice,
		technicalMistakes,
		memoryMistakes,
		quality,
		effort,
		t,
	]);

	const handleSave = async () => {
		const result = await performSave();
		if (result.ok) setSaved(true);
	};

	useRegisterCoachSave(
		useCallback(async () => {
			const result = await performSave();
			return { saved: result.ok };
		}, [performSave]),
	);

	const handleDelete = async () => {
		if (!pieceId) return;
		setDeleteLoading(true);
		try {
			await deletePiece(pieceId);
			router.replace("/(app)/(tabs)/piece");
		} catch {
			setDeleteDialogVisible(false);
			setError(t("error.deletePiece"));
		} finally {
			setDeleteLoading(false);
		}
	};

	if (piecesLoading) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: theme.colors.background }}
			>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (!piece) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: theme.colors.background }}
			>
				<Text variant="bodyLarge">{t("screen.practice.pieceNotFound")}</Text>
			</View>
		);
	}

	if (sectionIdProp && sectionsLoading) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: theme.colors.background }}
			>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	const mistakeButtons = MISTAKE_BUTTONS.map((b) => ({
		value: b.value,
		label: t(b.labelKey),
	}));
	const ratingButtons = (["1", "2", "3", "4", "5"] as const).map((v) => ({
		value: v,
		label: v,
	}));

	const titleSuffix = scopedSection ? ` — ${scopedSection.label}` : "";

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			{!inCoach && (
				<Appbar.Header>
					<Appbar.BackAction onPress={goBack} />
					<Appbar.Content
						title={
							piece?.title
								? `${piece.title}${titleSuffix}`
								: t("screen.practice.title")
						}
					/>
					<Menu
						visible={headerMenuVisible}
						onDismiss={() => setHeaderMenuVisible(false)}
						anchor={
							<Appbar.Action
								icon="dots-vertical"
								accessibilityLabel={t("a11y.menu.options")}
								onPress={() => setHeaderMenuVisible(true)}
							/>
						}
					>
						<Menu.Item
							leadingIcon="pencil"
							onPress={() => {
								setHeaderMenuVisible(false);
								router.push(`/piece/${pieceId}/edit`);
							}}
							title={t("screen.pieces.menu.edit")}
						/>
						<Menu.Item
							leadingIcon="delete"
							onPress={() => {
								setHeaderMenuVisible(false);
								setDeleteDialogVisible(true);
							}}
							title={t("screen.pieces.menu.delete")}
						/>
					</Menu>
				</Appbar.Header>
			)}

			{saved && !inCoach && scopedSection ? (
				<TechniqueLogComparison
					techniqueName={`${piece.title} — ${scopedSection.label}`}
					currentQuality={quality}
					currentEffort={effort}
					currentTempoBpm={
						achievedBpm.trim()
							? Number.parseInt(achievedBpm.trim(), 10) || null
							: null
					}
					previousQuality={lastLog?.quality ?? undefined}
					previousEffort={lastLog?.effort ?? undefined}
					previousTempoBpm={lastLog?.achievedBpm ?? undefined}
					targetTempoBpm={
						scopedSection.targetBpmOverride ?? piece.targetTempoBpm ?? null
					}
					isCompact={isCompact}
					onDone={handleDone}
					backLabel={getBackLabel()}
				/>
			) : saved && !inCoach ? (
				<PracticeComparison
					pieceName={`${piece.composer} — ${piece.title}`}
					currentTechnical={technicalMistakes}
					currentMemory={memoryMistakes}
					previousTechnical={lastLog?.technicalMistakes ?? undefined}
					previousMemory={lastLog?.memoryMistakes ?? undefined}
					isCompact={isCompact}
					onDone={handleDone}
					backLabel={getBackLabel()}
				/>
			) : (
				<ScrollView>
					<View
						className="gap-6"
						style={{
							paddingHorizontal: isCompact ? 16 : 24,
							paddingTop: 24,
							paddingBottom: 40,
						}}
					>
						<View className="w-full max-w-xl self-center gap-6">
							<View className="gap-1">
								<Text variant="headlineSmall">
									{piece.title}
									{titleSuffix}
								</Text>
								<Text
									variant="bodyLarge"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{piece.composer}
								</Text>
								{scopedSection && (
									<SectionPhaseChip phase={scopedSection.phase} />
								)}
							</View>

							<LastSessionCard
								lastLog={lastLog}
								loading={lastLogLoading}
								scope={scopedSection ? "section" : "piece"}
								targetBpm={
									scopedSection
										? (scopedSection.targetBpmOverride ??
											piece.targetTempoBpm ??
											null)
										: (piece.targetTempoBpm ?? null)
								}
							/>

							<Divider />

							{scopedSection?.startBar != null && (
								<Text
									variant="bodyMedium"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{scopedSection.endBar != null
										? t("screen.pieceSections.barRange", {
												start: scopedSection.startBar,
												end: scopedSection.endBar,
											})
										: t("screen.pieceSections.barFrom", {
												start: scopedSection.startBar,
											})}
								</Text>
							)}

							<View className="gap-2">
								<Text variant="titleSmall">
									{t("screen.practice.achievedBpmLabel")}
								</Text>
								{(() => {
									const effectiveTarget = scopedSection
										? (scopedSection.targetBpmOverride ??
											piece.targetTempoBpm ??
											null)
										: (piece.targetTempoBpm ?? null);
									return effectiveTarget != null ? (
										<Text
											variant="bodySmall"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											{t("screen.practiceTechnique.targetBpm", {
												bpm: effectiveTarget,
											})}
										</Text>
									) : null;
								})()}
								<View className="flex-row items-center gap-2">
									<View className="flex-1">
										<TextInput
											mode="outlined"
											keyboardType="numeric"
											value={achievedBpm}
											onChangeText={setAchievedBpm}
											placeholder="e.g. 80"
											error={!!bpmError}
											onBlur={handleBpmBlur}
										/>
									</View>
									<MetronomeButton
										bpm={achievedBpm}
										disabled={!!bpmError}
										stopRef={metronomeStopRef}
									/>
								</View>
								<HelperText type="error" visible={!!bpmError}>
									{bpmError ?? ""}
								</HelperText>
							</View>
							<Divider />

							{scopedSection ? (
								<>
									<View className="gap-2">
										<Text variant="titleSmall">
											{t("screen.practiceTechnique.qualityLabel")}
										</Text>
										<SegmentedButtons
											value={quality.toString()}
											onValueChange={(v) =>
												setQuality(Number(v) as 1 | 2 | 3 | 4 | 5)
											}
											buttons={ratingButtons}
										/>
									</View>
									<View className="gap-2">
										<Text variant="titleSmall">
											{t("screen.practiceTechnique.effortLabel")}
										</Text>
										<SegmentedButtons
											value={effort.toString()}
											onValueChange={(v) =>
												setEffort(Number(v) as 1 | 2 | 3 | 4 | 5)
											}
											buttons={ratingButtons}
										/>
									</View>
								</>
							) : (
								<>
									<View className="gap-2">
										<Text variant="titleSmall">
											{t("screen.practice.technicalMistakes")}
										</Text>
										<SegmentedButtons
											value={String(technicalMistakes)}
											onValueChange={(v) =>
												setTechnicalMistakes(Number(v) as PracticeMistakes)
											}
											buttons={mistakeButtons}
										/>
									</View>
									<View className="gap-2">
										<Text variant="titleSmall">
											{t("screen.practice.memoryMistakes")}
										</Text>
										<SegmentedButtons
											value={String(memoryMistakes)}
											onValueChange={(v) =>
												setMemoryMistakes(Number(v) as PracticeMistakes)
											}
											buttons={mistakeButtons}
										/>
									</View>
								</>
							)}

							{!scopedSection && (
								<SectionsPracticePanel
									sections={activeSections}
									piece={piece}
									mistakeLevel={showCheckboxes ? "checkbox" : "normal"}
									flaggedIds={flaggedSectionIds}
									onToggleFlag={handleToggleFlag}
									onPractice={handlePracticeSection}
								/>
							)}

							{!inCoach && (
								<Button
									mode="contained"
									onPress={handleSave}
									loading={loading}
									disabled={loading}
								>
									{t("screen.practice.save")}
								</Button>
							)}
						</View>
					</View>
				</ScrollView>
			)}

			<Snackbar
				visible={!!error}
				onDismiss={() => setError(null)}
				duration={4000}
				action={{ label: t("common.ok"), onPress: () => setError(null) }}
			>
				{error ?? ""}
			</Snackbar>

			{!inCoach && (
				<DeletePieceDialog
					visible={deleteDialogVisible}
					pieceName={piece?.title ?? ""}
					loading={deleteLoading}
					onConfirm={handleDelete}
					onDismiss={() => setDeleteDialogVisible(false)}
				/>
			)}
		</View>
	);
}

export default function PracticeScreen() {
	const { id, from, sectionId } = useLocalSearchParams<{
		id: string;
		from?: string;
		sectionId?: string;
	}>();
	return (
		<PiecePracticeContent
			pieceId={id}
			sectionId={sectionId ?? null}
			from={from}
		/>
	);
}
