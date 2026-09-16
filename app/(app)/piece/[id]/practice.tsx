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
	Snackbar,
	useTheme,
} from "react-native-paper";
import { PieceStateChip } from "@/components/piece/PieceStateChip";
import { PracticeAppbarContent } from "@/components/practice/CoachShell";
import { EstimationField } from "@/components/practice/EstimationField";
import { HandTabs } from "@/components/practice/HandTabs";
import { PracticeComparison } from "@/components/practice/PracticeComparison";
import { PracticeFooter } from "@/components/practice/PracticeFooter";
import { PracticeMeta } from "@/components/practice/PracticeMeta";
import { SectionsPracticePanel } from "@/components/practice/SectionsPracticePanel";
import { StandingNote } from "@/components/practice/StandingNote";
import {
	StateOfferCard,
	StateStatusLine,
} from "@/components/practice/StateOfferCard";
import { TempoControl } from "@/components/practice/TempoControl";
import { SectionStateChip } from "@/components/section/SectionStateChip";
import { TechniqueLogComparison } from "@/components/technique/TechniqueLogComparison";
import { LoadingScreen, MessageScreen } from "@/components/ui/CenteredScreen";
import { DeletePieceDialog } from "@/components/ui/DeletePieceDialog";
import { ErrorSnackbar } from "@/components/ui/ErrorSnackbar";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useCoach, usePracticeHeading } from "@/contexts/CoachContext";
import { useLastPracticeLog } from "@/hooks/use-last-practice-log";
import { parseBpm, useModeDrafts } from "@/hooks/use-mode-drafts";
import { useDeletePiece, usePieces, useUpdatePiece } from "@/hooks/use-pieces";
import { usePracticeSave } from "@/hooks/use-practice-save";
import { useSavePractice, useSaveSectionPractice } from "@/hooks/use-practices";
import {
	useChangeSectionState,
	useSectionStateHistory,
} from "@/hooks/use-section-state";
import { useSections, useUpdateSection } from "@/hooks/use-sections";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import { useWakeLock } from "@/hooks/use-wake-lock";
import {
	HANDS_MODES,
	type ModeKey,
	PracticeMistakes,
	type PracticeTrigger,
} from "@/models/practice";
import { formatDaysAgo } from "@/utils/date";
import {
	effortOptions,
	mistakeOptions,
	qualityOptions,
} from "@/utils/estimation-options";
import { formatBarRange } from "@/utils/piece-display";
import {
	type ModeEntry,
	modeKey,
	parseModeKey,
	targetForMode,
} from "@/utils/practice-modes";
import { practiceTally } from "@/utils/practice-tally";
import {
	decideStateOffer,
	type PendingStateOffer,
	type StateOfferStatus,
} from "@/utils/state-offer";
import {
	planTimeSignatureWrite,
	resolveTimeSignature,
	type TimeSignature,
	writesFromPlan,
} from "@/utils/time-signature";
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
	/** True while the coach session is paused; freezes the mode-touched clock. */
	clockPaused?: boolean;
}

export function PiecePracticeContent({
	pieceId,
	sectionId: sectionIdProp,
	from,
	triggerOverride,
	preselectMode,
	clockPaused,
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
	const { changeSectionState, dismissStateOffer } = useChangeSectionState();
	const { updatePiece } = useUpdatePiece();
	const { updateSection } = useUpdateSection();
	const standaloneSessionId = useRef(randomUUID());

	const piece = pieces.find((p) => p.id === pieceId);

	const lastLogScope = sectionIdProp
		? { type: "section" as const, pieceId, sectionId: sectionIdProp }
		: { type: "piece" as const, pieceId };
	const {
		lastLog,
		logsByMode,
		logs: priorLogs,
		loading: lastLogLoading,
	} = useLastPracticeLog(lastLogScope);
	const { transitions, reload: reloadTransitions } = useSectionStateHistory(
		pieceId,
		sectionIdProp,
	);

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
	const [notice, setNotice] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [savedEntries, setSavedEntries] = useState<ModeEntry[]>([]);
	const [pendingOffer, setPendingOffer] = useState<PendingStateOffer | null>(
		null,
	);
	const [offerStatus, setOfferStatus] = useState<StateOfferStatus | null>(null);
	const [offerBusy, setOfferBusy] = useState(false);
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

	const barRangeText = scopedSection ? formatBarRange(scopedSection, t) : null;

	// The app bar names the passage: on a section the subtitle carries the
	// piece, the composer and the bars; on a whole piece the composer alone.
	const headingTitle = scopedSection
		? scopedSection.label
		: (piece?.title ?? "");
	const headingSubtitle = (
		scopedSection
			? [piece?.title ?? "", piece?.composer ?? "", barRangeText]
			: [piece?.composer ?? ""]
	)
		.filter(Boolean)
		.join(t("screen.practice.heading.separator"));
	usePracticeHeading(headingTitle, headingSubtitle || null);

	const accent = useMemo(() => {
		if (!piece) return undefined;
		return {
			signature: resolveTimeSignature(scopedSection, piece),
			planFor: (next: TimeSignature) =>
				planTimeSignatureWrite(next, piece, scopedSection),
			onChange: (next: TimeSignature) => {
				const writes = writesFromPlan(
					planTimeSignatureWrite(next, piece, scopedSection),
				);
				if (writes.piece) {
					void updatePiece(pieceId, { timeSignature: writes.piece });
				}
				if (scopedSection?.id && writes.sectionOverride !== undefined) {
					void updateSection(pieceId, scopedSection.id, {
						timeSignatureOverride: writes.sectionOverride,
					});
				}
			},
			onClear: () => {
				if (scopedSection?.id && scopedSection.timeSignatureOverride) {
					void updateSection(pieceId, scopedSection.id, {
						timeSignatureOverride: null,
					});
				} else {
					void updatePiece(pieceId, { timeSignature: null });
				}
			},
		};
	}, [piece, scopedSection, pieceId, updatePiece, updateSection]);

	const effectiveTarget = scopedSection
		? (scopedSection.targetBpmOverride ?? piece?.targetTempoBpm ?? null)
		: (piece?.targetTempoBpm ?? null);

	// Pocket time is not practice: the clock stops while the coach is paused
	// or the screen has lost focus.
	const clockRunning = useIsFocused() && !clockPaused;

	const modes = useModeDrafts({
		byMode: scopedSection?.byMode,
		available: HANDS_MODES,
		drills: NO_DRILLS,
		effectiveTarget,
		preselect: preselectMode,
		ready: !!scopedSection,
		carryBpm: achievedBpm,
		clockRunning,
	});

	const handleBpmBlur = (text: string) => {
		setBpmError(validateBpm(text));
	};

	// The whole-piece screen keeps its single BPM field; sections use per-mode drafts.
	// A section deep link never auto-fills it: a tempo typed during the load goes
	// across as carryBpm instead of being mixed with the piece's stored tempo.
	useEffect(() => {
		if (!scopedSection && !sectionIdProp) {
			setAchievedBpm(piece?.lastAchievedTempoBpm?.toString() ?? "");
		}
	}, [scopedSection, sectionIdProp, piece]);

	// A run-through of a piece the student is holding: unticked sections earn
	// credit, so the checkboxes must be offered however well the run went.
	const isRunThrough =
		!scopedSection &&
		(piece?.state === "maintenance" || piece?.state === "performance");

	// Only rows where ticking does something get a checkbox. Outside a
	// run-through that is every section — the tick is still recorded on the piece
	// log — but a run-through only acts on maintenance-state sections.
	const flaggableIds = useMemo(
		() =>
			activeSections
				.filter((s) => !isRunThrough || s.state === "maintenance")
				.map((s) => s.id ?? ""),
		[activeSections, isRunThrough],
	);

	const showCheckboxes =
		!scopedSection &&
		flaggableIds.length > 0 &&
		(isRunThrough ||
			technicalMistakes >= PracticeMistakes.some ||
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
				const mergedByMode = await saveSectionPractice(
					pieceId,
					scopedSection.id,
					practiceDate,
					modes.entries,
					triggeredFrom,
					sessionId,
				);
				setSavedEntries(modes.entries);

				// Only ever after the save commits — a nudge offered while the timer
				// is still running would be a decision made on mood, not on evidence.
				const { offer, status } = decideStateOffer({
					section: scopedSection,
					piece,
					byMode: mergedByMode,
					priorLogs,
					savedEntries: modes.entries,
					savedAt: practiceDate,
					transitions,
					now: practiceDate,
				});
				const pending: PendingStateOffer | null = offer
					? {
							offer,
							pieceId,
							sectionId: scopedSection.id,
							sectionLabel: scopedSection.label,
							achievedBpmAtEvent: offer.htBpm,
							qualityAtEvent: mergedByMode?.HT?.quality ?? null,
							priorStateChangedAt: scopedSection.stateChangedAt ?? null,
							sessionId,
						}
					: null;
				setPendingOffer(pending);
				setOfferStatus(status);
				if (inCoach) coach.stateOfferRef.current = pending;
			} else {
				if (!piece) return { ok: false };
				const { demotedCount } = await savePractice({
					piece,
					sections: activeSections,
					date: practiceDate,
					technicalMistakes,
					memoryMistakes,
					achievedBpm: parseBpm(achievedBpm),
					flaggedSectionIds,
					triggeredFrom,
					sessionId,
				});
				if (demotedCount > 0) {
					const message = t("screen.practice.demoted", { count: demotedCount });
					// Inside the coach this component unmounts the moment the block
					// advances, so the message has to live at the coach screen level.
					if (inCoach) coach.notify(message);
					else setNotice(message);
				}
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
		piece,
		activeSections,
		validateBpm,
		achievedBpm,
		coach.sessionId,
		coach.notify,
		coach.stateOfferRef,
		priorLogs,
		transitions,
		inCoach,
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

	/** Resolve the nudge either way; both outcomes write an audit row. */
	const resolveOffer = useCallback(
		async (accepted: boolean) => {
			if (!pendingOffer) return;
			const { offer } = pendingOffer;
			setOfferBusy(true);
			try {
				const event = {
					pieceId: pendingOffer.pieceId,
					sectionId: pendingOffer.sectionId,
					fromState: offer.fromState,
					toState: offer.toState,
					trigger:
						offer.kind === "advance"
							? ("advance-button" as const)
							: ("demote-button" as const),
					achievedBpmAtEvent: pendingOffer.achievedBpmAtEvent,
					qualityAtEvent: pendingOffer.qualityAtEvent,
					priorStateChangedAt: pendingOffer.priorStateChangedAt,
					sessionId: pendingOffer.sessionId,
				};
				if (accepted) await changeSectionState(event);
				else await dismissStateOffer(event);
				setPendingOffer(null);
				reloadTransitions();
			} catch {
				setError(t("error.firebase"));
			} finally {
				setOfferBusy(false);
			}
		},
		[pendingOffer, changeSectionState, dismissStateOffer, reloadTransitions, t],
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
		return <LoadingScreen />;
	}

	if (!piece) {
		return <MessageScreen message={t("screen.practice.pieceNotFound")} />;
	}

	// A section URL must not render the whole-piece body for a beat while the
	// section is in flight: the two bodies diverge structurally, and the swap
	// remounts everything after the first differing child — the open note
	// editor included (#163 CI).
	if (sectionIdProp && (sectionsLoading || !scopedSection)) {
		return <LoadingScreen />;
	}

	const mistakes = mistakeOptions(t);

	const scopedLog = scopedSection
		? (logsByMode[modes.currentKey] ?? null)
		: lastLog;
	const lastLine = lastLogLoading
		? null
		: scopedLog
			? t("screen.practice.meta.lastPractised", {
					when: formatDaysAgo(scopedLog.date, t),
				})
			: t("screen.practice.meta.firstPractice");

	const metaChip = scopedSection ? (
		<SectionStateChip state={scopedSection.state} />
	) : (
		<PieceStateChip state={piece.state} />
	);

	return (
		<View
			style={{
				flex: 1,
				minHeight: 0,
				backgroundColor: theme.colors.background,
			}}
		>
			{!inCoach && (
				<Appbar.Header>
					<Appbar.BackAction onPress={goBack} />
					<PracticeAppbarContent
						heading={{ title: headingTitle, subtitle: headingSubtitle }}
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
					beforeActions={
						pendingOffer ? (
							<StateOfferCard
								offer={pendingOffer.offer}
								busy={offerBusy}
								onAccept={() => resolveOffer(true)}
								onDismiss={() => resolveOffer(false)}
							/>
						) : offerStatus ? (
							<StateStatusLine status={offerStatus} />
						) : null
					}
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
				<View style={{ flex: 1 }}>
					<ScreenContent
						gap={4}
						paddingTop={12}
						paddingBottom={12}
						style={{ flex: 1 }}
					>
						{scopedSection && (
							<HandTabs
								available={HANDS_MODES}
								hands={modes.hands}
								onChangeHands={modes.setHands}
								drafts={modes.drafts}
								drills={NO_DRILLS}
							/>
						)}

						<PracticeMeta
							tally={
								scopedSection
									? practiceTally({
											drafts: modes.drafts,
											available: HANDS_MODES,
											drills: NO_DRILLS,
											dirty: modes.dirty,
											t,
										})
									: undefined
							}
							lastLine={lastLine}
							chip={metaChip}
						/>

						<TempoControl
							value={scopedSection ? modes.draft.bpm : achievedBpm}
							onChangeText={scopedSection ? modes.setBpm : setAchievedBpm}
							error={bpmError}
							onBlur={handleBpmBlur}
							stopRef={metronomeStopRef}
							accent={accent}
							target={
								scopedSection
									? targetForMode(modes.hands, effectiveTarget)
									: effectiveTarget
							}
							last={
								scopedSection
									? (scopedSection.byMode?.[modes.currentKey]?.bpm ?? null)
									: (piece?.lastAchievedTempoBpm ?? null)
							}
						/>
						<Divider />

						{scopedSection ? (
							<>
								<EstimationField
									label={t("screen.practiceTechnique.qualityLabel")}
									value={modes.draft.quality}
									onChange={modes.setQuality}
									options={qualityOptions(t)}
									previous={logsByMode[modes.currentKey]?.quality ?? null}
								/>
								<EstimationField
									label={t("screen.practiceTechnique.effortLabel")}
									value={modes.draft.effort}
									onChange={modes.setEffort}
									options={effortOptions(t)}
									previous={logsByMode[modes.currentKey]?.effort ?? null}
								/>
							</>
						) : (
							<>
								<EstimationField
									label={t("screen.practice.technicalMistakes")}
									value={technicalMistakes}
									onChange={setTechnicalMistakes}
									options={mistakes}
									previous={lastLog?.technicalMistakes ?? null}
								/>
								<EstimationField
									label={t("screen.practice.memoryMistakes")}
									value={memoryMistakes}
									onChange={setMemoryMistakes}
									options={mistakes}
									previous={lastLog?.memoryMistakes ?? null}
								/>
							</>
						)}

						{!scopedSection && (
							<>
								<SectionsPracticePanel
									sections={activeSections}
									piece={piece}
									mistakeLevel={
										showCheckboxes
											? isRunThrough
												? "run-through"
												: "checkbox"
											: "normal"
									}
									flaggedIds={flaggedSectionIds}
									flaggableIds={flaggableIds}
									onToggleFlag={handleToggleFlag}
									onPractice={handlePracticeSection}
									onChangeState={(sectionId, state) => {
										const target = activeSections.find(
											(s) => s.id === sectionId,
										);
										if (!target || state === target.state) return;
										changeSectionState({
											pieceId,
											sectionId,
											fromState: target.state,
											toState: state,
											trigger: "state-chip",
											achievedBpmAtEvent: target.byMode?.HT?.bpm ?? null,
											qualityAtEvent: target.byMode?.HT?.quality ?? null,
											priorStateChangedAt: target.stateChangedAt ?? null,
											sessionId: coach.sessionId ?? standaloneSessionId.current,
										}).catch(() => setError(t("error.firebase")));
									}}
								/>
								<Button
									mode="outlined"
									onPress={() => router.push(`/piece/${pieceId}/section/new`)}
								>
									{t("screen.pieceSections.addSection")}
								</Button>
							</>
						)}

						<StandingNote
							value={scopedSection ? scopedSection.notes : piece.notes}
							onSave={(text) => {
								if (scopedSection?.id) {
									void updateSection(pieceId, scopedSection.id, {
										notes: text,
									});
								} else {
									void updatePiece(pieceId, { notes: text });
								}
							}}
						/>
					</ScreenContent>
					<PracticeFooter
						primaryLabel={
							inCoach
								? t("screen.session.coach.saveAndNext")
								: t("screen.practice.save")
						}
						onPrimary={inCoach ? coach.saveAndNext : handleSave}
						primaryLoading={inCoach ? coach.saving : loading}
						onSkip={inCoach ? coach.skipBlock : undefined}
						onExtend={inCoach ? coach.extendBlock : undefined}
					/>
				</View>
			)}

			<ErrorSnackbar error={error} onDismiss={() => setError(null)} />

			{!inCoach && (
				<Snackbar
					visible={!!notice}
					onDismiss={() => setNotice(null)}
					duration={4000}
					action={{ label: t("common.ok"), onPress: () => setNotice(null) }}
				>
					{notice ?? ""}
				</Snackbar>
			)}

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
	const { id, from, sectionId, mode } = useLocalSearchParams<{
		id: string;
		from?: string;
		sectionId?: string;
		mode?: string;
	}>();
	// Standalone practice only: inside the coach the wake lock belongs to the
	// coach screen, which knows whether the session is paused.
	useWakeLock(useIsFocused());
	return (
		<PiecePracticeContent
			pieceId={id}
			sectionId={sectionId ?? null}
			from={from}
			preselectMode={(mode as ModeKey) ?? null}
		/>
	);
}
