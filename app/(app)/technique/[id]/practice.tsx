import { randomUUID } from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Appbar, Button, Menu, Text, useTheme } from "react-native-paper";
import { BpmControl } from "@/components/practice/BpmControl";
import { LastSessionCard } from "@/components/practice/LastSessionCard";
import { RatingField } from "@/components/practice/RatingField";
import { DeleteTechniqueDialog } from "@/components/technique/DeleteTechniqueDialog";
import { TechniqueLogComparison } from "@/components/technique/TechniqueLogComparison";
import { LoadingScreen, MessageScreen } from "@/components/ui/CenteredScreen";
import { ErrorSnackbar } from "@/components/ui/ErrorSnackbar";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useCoach } from "@/contexts/CoachContext";
import { useLastPracticeLog } from "@/hooks/use-last-practice-log";
import { usePracticeSave } from "@/hooks/use-practice-save";
import {
	useDeleteTechnique,
	useSaveTechniqueLog,
	useTechniques,
} from "@/hooks/use-techniques";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import { validateBpm as validateBpmRange } from "@/utils/validation";

export interface TechniquePracticeContentProps {
	techniqueId: string;
	from?: string;
}

export function TechniquePracticeContent({
	techniqueId,
	from,
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

	const { lastLog, loading: lastLogLoading } = useLastPracticeLog({
		type: "technique",
		techniqueId,
	});

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

	const seededRef = useRef(false);

	const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
	const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5>(3);
	const [tempoBpm, setTempoBpm] = useState<string>("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [bpmError, setBpmError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const metronomeStopRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		if (technique && !seededRef.current) {
			seededRef.current = true;
			setTempoBpm(technique.lastAchievedTempoBpm?.toString() ?? "");
		}
	}, [technique]);

	const validateBpm = useCallback(
		(text: string) => validateBpmRange(text, t),
		[t],
	);

	const handleBpmBlur = () => {
		setBpmError(validateBpm(tempoBpm));
	};
	const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
	const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);

	const performSave = useCallback(async (): Promise<{ ok: boolean }> => {
		if (!techniqueId) return { ok: false };
		const bpmErr = validateBpm(tempoBpm);
		setBpmError(bpmErr);
		if (bpmErr) return { ok: false };
		metronomeStopRef.current?.();
		setLoading(true);
		setError(null);
		try {
			const sessionId = coach.sessionId ?? standaloneSessionId.current;
			await saveTechniqueLog(techniqueId, {
				quality,
				effort,
				achievedTempoBpm: Number.parseInt(tempoBpm.trim(), 10) || null,
				sessionId,
			});
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
		tempoBpm,
		saveTechniqueLog,
		quality,
		effort,
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

	const ratingButtons = (["1", "2", "3", "4", "5"] as const).map((v) => ({
		value: v,
		label: v,
	}));

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
					currentQuality={quality}
					currentEffort={effort}
					currentTempoBpm={Number.parseInt(tempoBpm.trim(), 10) || null}
					previousQuality={lastLog?.quality ?? undefined}
					previousEffort={lastLog?.effort ?? undefined}
					previousTempoBpm={lastLog?.achievedBpm ?? undefined}
					targetTempoBpm={technique.targetTempoBpm}
					onDone={handleDone}
					backLabel={getBackLabel()}
				/>
			) : (
				<ScreenContent>
					<Text variant="headlineSmall">{technique.title}</Text>

					<LastSessionCard
						lastLog={lastLog}
						loading={lastLogLoading}
						scope="technique"
						targetBpm={technique.targetTempoBpm ?? null}
					/>

					<RatingField
						label={t("screen.practiceTechnique.qualityLabel")}
						value={quality}
						onChange={setQuality}
						buttons={ratingButtons}
					/>

					<RatingField
						label={t("screen.practiceTechnique.effortLabel")}
						value={effort}
						onChange={setEffort}
						buttons={ratingButtons}
					/>

					<View className="gap-2">
						<Text variant="titleSmall">
							{t("screen.practiceTechnique.tempoAchievedLabel")}
						</Text>
						{technique.targetTempoBpm != null && (
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{t("screen.practiceTechnique.targetBpm", {
									bpm: technique.targetTempoBpm,
								})}
							</Text>
						)}
						<BpmControl
							value={tempoBpm}
							onChangeText={setTempoBpm}
							error={bpmError}
							onBlur={handleBpmBlur}
							stopRef={metronomeStopRef}
							placeholder="e.g. 80"
						/>
					</View>

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

			{!inCoach && (
				<ErrorSnackbar error={error} onDismiss={() => setError(null)} />
			)}

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
