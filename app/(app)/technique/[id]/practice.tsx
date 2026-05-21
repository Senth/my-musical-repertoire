import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, useWindowDimensions, View } from "react-native";
import {
	ActivityIndicator,
	Appbar,
	Button,
	HelperText,
	Menu,
	SegmentedButtons,
	Snackbar,
	Text,
	TextInput,
	useTheme,
} from "react-native-paper";
import { MetronomeButton } from "@/components/practice/MetronomeButton";
import { DeleteTechniqueDialog } from "@/components/technique/DeleteTechniqueDialog";
import { TechniqueLogComparison } from "@/components/technique/TechniqueLogComparison";
import {
	useDeleteTechnique,
	useSaveTechniqueLog,
	useTechniques,
} from "@/hooks/use-techniques";

const MD3_MEDIUM_BREAKPOINT = 600;

export default function PracticeTechniqueScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
	const { techniques, loading: techniquesLoading } = useTechniques();
	const { saveTechniqueLog } = useSaveTechniqueLog();
	const { deleteTechnique } = useDeleteTechnique();
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

	const technique = techniques.find((t) => t.id === id);

	const getBackDestination = (): string => {
		if (from === "overview") return "/(app)/(tabs)/overview";
		if (from === "technique-detail") return `/technique/${id}`;
		return "/(app)/(tabs)/technique";
	};

	const getBackLabel = (): string => {
		if (from === "overview")
			return t("screen.practiceTechnique.comparison.backToOverview");
		if (from === "technique-detail")
			return t("screen.practiceTechnique.comparison.backToTechnique");
		return t("screen.practiceTechnique.comparison.backToTechniques");
	};

	const handleDone = () =>
		router.replace(
			getBackDestination() as Parameters<typeof router.replace>[0],
		);

	const previousDataRef = useRef<{
		quality: 1 | 2 | 3 | 4 | 5 | null | undefined;
		effort: 1 | 2 | 3 | 4 | 5 | null | undefined;
		tempoBpm: number | null | undefined;
	}>({ quality: undefined, effort: undefined, tempoBpm: undefined });
	const seededRef = useRef(false);

	const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
	const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5>(3);
	const [tempoBpm, setTempoBpm] = useState<string>("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [bpmError, setBpmError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const metronomeStopRef = useRef<(() => void) | null>(null);

	// Seed BPM + capture previous data once technique loads (data arrives async).
	// seededRef prevents overwriting user edits if Firestore fires again mid-session.
	useEffect(() => {
		if (technique && !seededRef.current) {
			seededRef.current = true;
			setTempoBpm(technique.lastAchievedTempoBpm?.toString() ?? "");
			previousDataRef.current = {
				quality: technique.lastQuality,
				effort: technique.lastEffort,
				tempoBpm: technique.lastAchievedTempoBpm,
			};
		}
	}, [technique]);

	const validateBpm = (text: string): string | null => {
		if (!text.trim()) return null;
		const n = Number.parseInt(text.trim(), 10);
		return Number.isNaN(n) || n < 20 || n > 240 ? t("error.bpmInvalid") : null;
	};

	const handleBpmBlur = () => {
		setBpmError(validateBpm(tempoBpm));
	};
	const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
	const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);

	const handleSave = async () => {
		if (!id) return;
		const bpmErr = validateBpm(tempoBpm);
		setBpmError(bpmErr);
		if (bpmErr) return;
		metronomeStopRef.current?.();
		setLoading(true);
		setError(null);
		try {
			await saveTechniqueLog(id, {
				quality,
				effort,
				achievedTempoBpm: Number.parseInt(tempoBpm.trim(), 10) || null,
			});
			setSaved(true);
		} catch {
			setError(t("error.firebase"));
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async () => {
		if (!id) return;
		setDeleteLoading(true);
		try {
			await deleteTechnique(id);
			router.replace("/(app)/(tabs)/technique");
		} catch {
			setDeleteDialogVisible(false);
			setError(t("error.deleteTechnique"));
		} finally {
			setDeleteLoading(false);
		}
	};

	if (techniquesLoading) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: theme.colors.background }}
			>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (!technique) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: theme.colors.background }}
			>
				<Text variant="bodyLarge">
					{t("screen.practiceTechnique.notFound")}
				</Text>
			</View>
		);
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
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
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
							router.push(`/technique/${id}/edit`);
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

			{saved ? (
				<TechniqueLogComparison
					techniqueName={technique.title}
					currentQuality={quality}
					currentEffort={effort}
					currentTempoBpm={Number.parseInt(tempoBpm.trim(), 10) || null}
					previousQuality={previousDataRef.current.quality}
					previousEffort={previousDataRef.current.effort}
					previousTempoBpm={previousDataRef.current.tempoBpm}
					targetTempoBpm={technique.targetTempoBpm}
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
						}}
					>
						<View className="w-full max-w-xl self-center gap-6">
							<Text variant="headlineSmall">{technique.title}</Text>

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
								<View className="flex-row items-center gap-2">
									<View className="flex-1">
										<TextInput
											mode="outlined"
											keyboardType="numeric"
											value={tempoBpm}
											onChangeText={setTempoBpm}
											placeholder="e.g. 80"
											error={!!bpmError}
											onBlur={handleBpmBlur}
										/>
									</View>
									<MetronomeButton
										bpm={tempoBpm}
										disabled={!!bpmError}
										stopRef={metronomeStopRef}
									/>
								</View>
								<HelperText type="error" visible={!!bpmError}>
									{bpmError ?? ""}
								</HelperText>
							</View>

							<Button
								mode="contained"
								onPress={handleSave}
								loading={loading}
								disabled={loading}
							>
								{t("screen.practiceTechnique.save")}
							</Button>
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

			<DeleteTechniqueDialog
				visible={deleteDialogVisible}
				techniqueName={technique?.title ?? ""}
				loading={deleteLoading}
				onConfirm={handleDelete}
				onDismiss={() => setDeleteDialogVisible(false)}
			/>
		</View>
	);
}
