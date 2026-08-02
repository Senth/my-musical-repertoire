import { randomUUID } from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Appbar, Button, Menu, Text, useTheme } from "react-native-paper";
import { BpmControl } from "@/components/practice/BpmControl";
import { EstimationField } from "@/components/practice/EstimationField";
import { LastSessionCard } from "@/components/practice/LastSessionCard";
import { ModeSelector } from "@/components/practice/ModeSelector";
import { DeleteTechniqueDialog } from "@/components/technique/DeleteTechniqueDialog";
import { TechniqueLogComparison } from "@/components/technique/TechniqueLogComparison";
import { LoadingScreen, MessageScreen } from "@/components/ui/CenteredScreen";
import { ErrorSnackbar } from "@/components/ui/ErrorSnackbar";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useCoach } from "@/contexts/CoachContext";
import { useLastPracticeLog } from "@/hooks/use-last-practice-log";
import { useModeDrafts } from "@/hooks/use-mode-drafts";
import { usePracticeSave } from "@/hooks/use-practice-save";
import {
	useDeleteTechnique,
	useSaveTechniqueLog,
	useTechniques,
} from "@/hooks/use-techniques";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import type { ModeKey } from "@/models/practice";
import { effortOptions, qualityOptions } from "@/utils/estimation-options";
import {
	availableHandsModes,
	hsTarget,
	isHtReady,
	type ModeEntry,
	modeKey,
	parseModeKey,
	targetForMode,
} from "@/utils/practice-modes";
import { validateBpm as validateBpmRange } from "@/utils/validation";

export interface TechniquePracticeContentProps {
	techniqueId: string;
	from?: string;
	/** Mode to open on — the session coach passes the block's planned mode. */
	preselectMode?: ModeKey | null;
}

export function TechniquePracticeContent({
	techniqueId,
	from,
	preselectMode,
}: TechniquePracticeContentProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const coach = useCoach();
	const inCoach = coach.inCoach;
	const { techniques, loading: techniquesLoading } = useTechniques();
	const { saveTechniqueLog } = useSaveTechniqueLog();
	const { deleteTechnique } = useDeleteTechnique();

	const standaloneSessionId = useRef(randomUUID());
	const technique = techniques.find((tn) => tn.id === techniqueId);

	const { logsByMode, loading: lastLogLoading } = useLastPracticeLog({
		type: "technique",
		techniqueId,
	});

	const effectiveTarget = technique?.targetTempoBpm ?? null;
	const available = useMemo(
		() => availableHandsModes(technique?.handsMode),
		[technique?.handsMode],
	);
	const drills = useMemo(
		() => technique?.activeDrills ?? [],
		[technique?.activeDrills],
	);

	const modes = useModeDrafts({
		byMode: technique?.byMode,
		available,
		drills,
		effectiveTarget,
		preselect: preselectMode,
		ready: !!technique,
	});
	const htReady =
		available.includes("HT") && isHtReady(technique?.byMode, effectiveTarget);

	const getBackDestination = (): string => {
		if (from === "overview") return "/(app)/(tabs)/overview";
		if (from === "technique-detail") return `/technique/${techniqueId}`;
		return "/(app)/(tabs)/technique";
	};

	const getDoneDestination = (): string => {
		if (from === "overview") return "/(app)/(tabs)/overview";
		return "/(app)/(tabs)/technique";
	};

	const getBackLabel = (): string => {
		if (from === "overview")
			return t("screen.practiceTechnique.comparison.backToOverview");
		return t("screen.practiceTechnique.comparison.backToTechniques");
	};

	const handleDone = () =>
		router.replace(
			getDoneDestination() as Parameters<typeof router.replace>[0],
		);

	const goBack = useUpNavigation(
		getBackDestination() as Parameters<typeof router.replace>[0],
	);

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [bpmError, setBpmError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [savedEntries, setSavedEntries] = useState<ModeEntry[]>([]);
	const metronomeStopRef = useRef<(() => void) | null>(null);

	const validateBpm = useCallback(
		(text: string) => validateBpmRange(text, t),
		[t],
	);

	const handleBpmBlur = () => {
		setBpmError(validateBpm(modes.draft.bpm));
	};
	const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
	const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);

	const performSave = useCallback(async (): Promise<{ ok: boolean }> => {
		if (!techniqueId) return { ok: false };

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

		metronomeStopRef.current?.();
		setLoading(true);
		setError(null);
		try {
			const sessionId = coach.sessionId ?? standaloneSessionId.current;
			await saveTechniqueLog(techniqueId, modes.entries, { sessionId });
			setSavedEntries(modes.entries);
			return { ok: true };
		} catch {
			setError(t("error.firebase"));
			return { ok: false };
		} finally {
			setLoading(false);
		}
	}, [
		techniqueId,
		validateBpm,
		saveTechniqueLog,
		modes.drafts,
		modes.entries,
		modes.blockingKey,
		modes.selectMode,
		t,
		coach.sessionId,
	]);

	const handleSave = usePracticeSave(performSave, () => setSaved(true));

	const handleDelete = async () => {
		if (!techniqueId) return;
		setDeleteLoading(true);
		try {
			await deleteTechnique(techniqueId);
			router.replace("/(app)/(tabs)/technique");
		} catch {
			setDeleteDialogVisible(false);
			setError(t("error.deleteTechnique"));
		} finally {
			setDeleteLoading(false);
		}
	};

	if (techniquesLoading) {
		return <LoadingScreen />;
	}

	if (!technique) {
		return <MessageScreen message={t("screen.practiceTechnique.notFound")} />;
	}

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			{!inCoach && (
				<Appbar.Header>
					<Appbar.BackAction onPress={goBack} />
					<Appbar.Content
						title={technique?.title ?? t("screen.practiceTechnique.title")}
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
								router.push(`/technique/${techniqueId}/edit`);
							}}
							title={t("screen.techniques.menu.edit")}
						/>
						<Menu.Item
							leadingIcon="delete"
							onPress={() => {
								setHeaderMenuVisible(false);
								setDeleteDialogVisible(true);
							}}
							title={t("screen.techniques.menu.delete")}
						/>
					</Menu>
				</Appbar.Header>
			)}

			{saved && !inCoach ? (
				<TechniqueLogComparison
					techniqueName={technique.title}
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
			) : (
				<ScreenContent>
					<Text variant="headlineSmall">{technique.title}</Text>

					<ModeSelector
						available={available}
						hands={modes.hands}
						onChangeHands={modes.setHands}
						drills={drills}
						drill={modes.drill}
						onChangeDrill={modes.setDrill}
						byMode={technique.byMode ?? {}}
						effectiveTarget={effectiveTarget}
						htReady={htReady}
					/>

					<LastSessionCard
						lastLog={logsByMode[modes.currentKey] ?? null}
						loading={lastLogLoading}
						scope="technique"
						targetBpm={targetForMode(modes.hands, effectiveTarget)}
					/>

					<View className="gap-2">
						<Text variant="titleSmall">
							{t("screen.practiceTechnique.tempoAchievedLabel")}
						</Text>
						{effectiveTarget != null &&
							(available.length > 1 ? (
								<>
									<Text
										variant="bodySmall"
										style={{ color: theme.colors.onSurfaceVariant }}
									>
										{t("screen.practice.modes.targetHandsSeparate", {
											bpm: hsTarget(effectiveTarget),
										})}
									</Text>
									{available.includes("HT") && (
										<Text
											variant="bodySmall"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											{t("screen.practice.modes.targetHandsTogether", {
												bpm: effectiveTarget,
											})}
										</Text>
									)}
								</>
							) : (
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{t("screen.practiceTechnique.targetBpm", {
										bpm: targetForMode(modes.hands, effectiveTarget),
									})}
								</Text>
							))}
						<BpmControl
							value={modes.draft.bpm}
							onChangeText={modes.setBpm}
							error={bpmError}
							onBlur={handleBpmBlur}
							stopRef={metronomeStopRef}
							placeholder="e.g. 80"
						/>
					</View>

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

					{!inCoach && (
						<Button
							mode="contained"
							onPress={handleSave}
							loading={loading}
							disabled={loading}
						>
							{t("screen.practiceTechnique.save")}
						</Button>
					)}
				</ScreenContent>
			)}

			{/* Shown in the coach too: the save gate blocks the block from advancing,
			    and the student needs to be told which mode is missing a rating. */}
			<ErrorSnackbar error={error} onDismiss={() => setError(null)} />

			{!inCoach && (
				<DeleteTechniqueDialog
					visible={deleteDialogVisible}
					techniqueName={technique?.title ?? ""}
					loading={deleteLoading}
					onConfirm={handleDelete}
					onDismiss={() => setDeleteDialogVisible(false)}
				/>
			)}
		</View>
	);
}

export default function PracticeTechniqueScreen() {
	const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
	return <TechniquePracticeContent techniqueId={id} from={from} />;
}
