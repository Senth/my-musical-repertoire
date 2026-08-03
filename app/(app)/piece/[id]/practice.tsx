import { randomUUID } from "expo-crypto";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	Appbar,
	Button,
	Divider,
	Menu,
	Text,
	useTheme,
} from "react-native-paper";
import { BpmControl } from "@/components/practice/BpmControl";
import { EstimationField } from "@/components/practice/EstimationField";
import { LastSessionCard } from "@/components/practice/LastSessionCard";
import { ModeSelector } from "@/components/practice/ModeSelector";
import { PracticeComparison } from "@/components/practice/PracticeComparison";
import { SectionsPracticePanel } from "@/components/practice/SectionsPracticePanel";
import { SectionPhaseChip } from "@/components/section/SectionPhaseChip";
import { TechniqueLogComparison } from "@/components/technique/TechniqueLogComparison";
import { LoadingScreen, MessageScreen } from "@/components/ui/CenteredScreen";
import { DeletePieceDialog } from "@/components/ui/DeletePieceDialog";
import { ErrorSnackbar } from "@/components/ui/ErrorSnackbar";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useCoach } from "@/contexts/CoachContext";
import { useLastPracticeLog } from "@/hooks/use-last-practice-log";
import { parseBpm, useModeDrafts } from "@/hooks/use-mode-drafts";
import { useDeletePiece, usePieces } from "@/hooks/use-pieces";
import { usePracticeSave } from "@/hooks/use-practice-save";
import { useSavePractice, useSaveSectionPractice } from "@/hooks/use-practices";
import { useSections, useUpdateSection } from "@/hooks/use-sections";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import { useWakeLock } from "@/hooks/use-wake-lock";
import {
	HANDS_MODES,
	type ModeKey,
	PracticeMistakes,
	type PracticeTrigger,
} from "@/models/practice";
import {
	effortOptions,
	mistakeOptions,
	qualityOptions,
} from "@/utils/estimation-options";
import {
	hsTarget,
	isHtReady,
	type ModeEntry,
	modeKey,
	parseModeKey,
	targetForMode,
} from "@/utils/practice-modes";
import { validateBpm as validateBpmRange } from "@/utils/validation";

/** Sections always have all three hand modes and never have drills. */
const NO_DRILLS: never[] = [];

export interface PiecePracticeContentProps {
	pieceId: string;
	sectionId?: string | null;
	from?: string;
	triggerOverride?: PracticeTrigger;
	/** Mode to open on — the session coach passes the block's planned mode. */
	preselectMode?: ModeKey | null;
}

export function PiecePracticeContent({
	pieceId,
	sectionId: sectionIdProp,
	from,
	triggerOverride,
	preselectMode,
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
	const { updateSection } = useUpdateSection();
	const standaloneSessionId = useRef(randomUUID());

	const piece = pieces.find((p) => p.id === pieceId);

	const lastLogScope = sectionIdProp
		? { type: "section" as const, pieceId, sectionId: sectionIdProp }
		: { type: "piece" as const, pieceId };
	const {
		lastLog,
		logsByMode,
		loading: lastLogLoading,
	} = useLastPracticeLog(lastLogScope);

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
	const [flaggedSectionIds, setFlaggedSectionIds] = useState<string[]>([]);
	const [achievedBpm, setAchievedBpm] = useState<string>("");
	const [bpmError, setBpmError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [savedEntries, setSavedEntries] = useState<ModeEntry[]>([]);
	const metronomeStopRef = useRef<(() => void) | null>(null);

	const validateBpm = useCallback(
		(text: string) => validateBpmRange(text, t),
		[t],
	);

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

	const effectiveTarget = scopedSection
		? (scopedSection.targetBpmOverride ?? piece?.targetTempoBpm ?? null)
		: (piece?.targetTempoBpm ?? null);

	const modes = useModeDrafts({
		byMode: scopedSection?.byMode,
		available: HANDS_MODES,
		drills: NO_DRILLS,
		effectiveTarget,
		preselect: preselectMode,
		ready: !!scopedSection,
	});
	const htReady = isHtReady(scopedSection?.byMode, effectiveTarget);

	const handleBpmBlur = () => {
		setBpmError(validateBpm(scopedSection ? modes.draft.bpm : achievedBpm));
	};

	// The whole-piece screen keeps its single BPM field; sections use per-mode drafts.
	useEffect(() => {
		if (!scopedSection) {
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

		if (scopedSection) {
			// Show the offending mode's BPM error on its own chip, not the current one.
			for (const [key, draft] of Object.entries(modes.drafts)) {
				const err = validateBpm(draft.bpm);
				if (err) {
					modes.selectMode(key);
					setBpmError(err);
					return { ok: false };
				}
			}
			setBpmError(null);
			if (modes.blockingKey) {
				modes.selectMode(modes.blockingKey);
				setError(
					t("screen.practice.modes.incompleteMode", {
						mode: t(
							`screen.practice.modes.handsLong.${parseModeKey(modes.blockingKey).hands}`,
						),
					}),
				);
				return { ok: false };
			}
		} else {
			const bpmErr = validateBpm(achievedBpm);
			setBpmError(bpmErr);
			if (bpmErr) return { ok: false };
		}

		metronomeStopRef.current?.();
		setLoading(true);
		setError(null);
		const sessionId = coach.sessionId ?? standaloneSessionId.current;
		try {
			const practiceDate = new Date();
			const triggeredFrom: PracticeTrigger =
				triggerOverride ?? (scopedSection ? "section-panel" : "full-piece");
			if (scopedSection) {
				if (!scopedSection.id) return { ok: false };
				await saveSectionPractice(
					pieceId,
					scopedSection.id,
					practiceDate,
					modes.entries,
					triggeredFrom,
					sessionId,
				);
				setSavedEntries(modes.entries);
			} else {
				await savePractice(
					pieceId,
					practiceDate,
					technicalMistakes,
					memoryMistakes,
					parseBpm(achievedBpm),
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
		modes.drafts,
		modes.entries,
		modes.blockingKey,
		modes.selectMode,
		t,
	]);

	const handleSave = usePracticeSave(performSave, () => setSaved(true));

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
		return <LoadingScreen />;
	}

	if (!piece) {
		return <MessageScreen message={t("screen.practice.pieceNotFound")} />;
	}

	if (sectionIdProp && sectionsLoading) {
		return <LoadingScreen />;
	}

	const mistakes = mistakeOptions(t);

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
					modes={savedEntries.map((entry) => {
						const key = modeKey(entry.hands, entry.drill);
						const previous = logsByMode[key];
						return {
							modeKey: key,
							currentQuality: entry.quality,
							currentEffort: entry.effort,
							currentTempoBpm: entry.bpm,
							previousQuality: previous?.quality ?? undefined,
							previousEffort: previous?.effort ?? undefined,
							previousTempoBpm: previous?.achievedBpm ?? undefined,
							targetTempoBpm: targetForMode(entry.hands, effectiveTarget),
						};
					})}
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
					onDone={handleDone}
					backLabel={getBackLabel()}
				/>
			) : (
				<ScreenContent paddingBottom={40}>
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
						{scopedSection && <SectionPhaseChip phase={scopedSection.phase} />}
					</View>

					{scopedSection && (
						<ModeSelector
							available={HANDS_MODES}
							hands={modes.hands}
							onChangeHands={modes.setHands}
							drills={NO_DRILLS}
							drill={modes.drill}
							onChangeDrill={modes.setDrill}
							byMode={scopedSection.byMode ?? {}}
							effectiveTarget={effectiveTarget}
							htReady={htReady}
						/>
					)}

					<LastSessionCard
						lastLog={
							scopedSection ? (logsByMode[modes.currentKey] ?? null) : lastLog
						}
						loading={lastLogLoading}
						scope={scopedSection ? "section" : "piece"}
						targetBpm={
							scopedSection
								? targetForMode(modes.hands, effectiveTarget)
								: effectiveTarget
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
						{effectiveTarget != null &&
							(scopedSection ? (
								<>
									<Text
										variant="bodySmall"
										style={{ color: theme.colors.onSurfaceVariant }}
									>
										{t("screen.practice.modes.targetHandsSeparate", {
											bpm: hsTarget(effectiveTarget),
										})}
									</Text>
									<Text
										variant="bodySmall"
										style={{ color: theme.colors.onSurfaceVariant }}
									>
										{t("screen.practice.modes.targetHandsTogether", {
											bpm: effectiveTarget,
										})}
									</Text>
								</>
							) : (
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{t("screen.practiceTechnique.targetBpm", {
										bpm: effectiveTarget,
									})}
								</Text>
							))}
						<BpmControl
							value={scopedSection ? modes.draft.bpm : achievedBpm}
							onChangeText={scopedSection ? modes.setBpm : setAchievedBpm}
							error={bpmError}
							onBlur={handleBpmBlur}
							stopRef={metronomeStopRef}
							placeholder="e.g. 80"
						/>
					</View>
					<Divider />

					{scopedSection ? (
						<>
							<EstimationField
								label={t("screen.practiceTechnique.qualityLabel")}
								value={modes.draft.quality}
								onChange={modes.setQuality}
								options={qualityOptions(t)}
							/>
							<EstimationField
								label={t("screen.practiceTechnique.effortLabel")}
								value={modes.draft.effort}
								onChange={modes.setEffort}
								options={effortOptions(t)}
							/>
						</>
					) : (
						<>
							<EstimationField
								label={t("screen.practice.technicalMistakes")}
								value={technicalMistakes}
								onChange={setTechnicalMistakes}
								options={mistakes}
							/>
							<EstimationField
								label={t("screen.practice.memoryMistakes")}
								value={memoryMistakes}
								onChange={setMemoryMistakes}
								options={mistakes}
							/>
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
							onChangePhase={(sectionId, phase) =>
								updateSection(pieceId, sectionId, { phase })
							}
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
				</ScreenContent>
			)}

			<ErrorSnackbar error={error} onDismiss={() => setError(null)} />

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
	// Standalone practice only: inside the coach the wake lock belongs to the
	// coach screen, which knows whether the session is paused.
	useWakeLock(useIsFocused());
	return (
		<PiecePracticeContent
			pieceId={id}
			sectionId={sectionId ?? null}
			from={from}
		/>
	);
}
