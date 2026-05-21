import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { MetronomeButton } from "@/components/practice/MetronomeButton";
import { PracticeComparison } from "@/components/practice/PracticeComparison";
import { SectionsPracticePanel } from "@/components/practice/SectionsPracticePanel";
import { DeletePieceDialog } from "@/components/ui/DeletePieceDialog";
import { useDeletePiece, usePieces } from "@/hooks/use-pieces";
import { useSavePractice } from "@/hooks/use-practices";
import { useSections } from "@/hooks/use-sections";
import { PracticeMistakes } from "@/models/practice";
import { formatDaysAgo } from "@/utils/date";

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

export default function PracticeScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { id, from, sectionId } = useLocalSearchParams<{
		id: string;
		from?: string;
		sectionId?: string;
	}>();
	const { pieces, loading: piecesLoading } = usePieces();
	const { sections } = useSections(id ?? "");
	const { savePractice } = useSavePractice();
	const { deletePiece } = useDeletePiece();
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

	const piece = pieces.find((p) => p.id === id);

	const getBackDestination = (): string => {
		if (from === "pieces") return "/(app)/(tabs)/piece";
		if (from === "piece-detail") return `/piece/${id}`;
		return "/(app)/(tabs)/overview";
	};

	const getBackLabel = (): string => {
		if (from === "pieces") return t("screen.practice.comparison.backToPieces");
		if (from === "piece-detail")
			return t("screen.practice.comparison.backToPiece");
		return t("screen.practice.comparison.backToOverview");
	};

	const handleDone = () =>
		router.replace(
			getBackDestination() as Parameters<typeof router.replace>[0],
		);

	const previousDataRef = useRef({
		technicalMistakes: piece?.lastTechnicalMistakes,
		memoryMistakes: piece?.lastMemoryMistakes,
	});

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
	const metronomeStopRef = useRef<(() => void) | null>(null);

	const validateBpm = (text: string): string | null => {
		if (!text.trim()) return null;
		const n = Number.parseInt(text.trim(), 10);
		return Number.isNaN(n) || n < 20 || n > 240 ? t("error.bpmInvalid") : null;
	};

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

	const scopedSection = sectionId
		? (sections.find((s) => s.id === sectionId) ?? null)
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
			`/piece/${id}/practice?sectionId=${sid}&from=${from ?? "overview"}`,
		);
	};

	const handleSave = async () => {
		if (!id) return;

		const bpmErr = validateBpm(achievedBpm);
		setBpmError(bpmErr);
		if (bpmErr) return;

		metronomeStopRef.current?.();
		setLoading(true);
		setError(null);

		try {
			const practiceDate = new Date();
			const bpm = achievedBpm.trim()
				? Number.parseInt(achievedBpm.trim(), 10) || null
				: null;
			const triggeredFrom = scopedSection ? "section-panel" : "full-piece";
			const flagged = scopedSection ? null : flaggedSectionIds;
			await savePractice(
				id,
				practiceDate,
				technicalMistakes,
				memoryMistakes,
				bpm,
				scopedSection?.id ?? null,
				flagged,
				triggeredFrom,
			);
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
			await deletePiece(id);
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

	const mistakeButtons = MISTAKE_BUTTONS.map((b) => ({
		value: b.value,
		label: t(b.labelKey),
	}));

	const titleSuffix = scopedSection ? ` — ${scopedSection.label}` : "";

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
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
							router.push(`/piece/${id}/edit`);
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

			{saved ? (
				<PracticeComparison
					pieceName={`${piece.composer} — ${piece.title}`}
					currentTechnical={technicalMistakes}
					currentMemory={memoryMistakes}
					previousTechnical={previousDataRef.current.technicalMistakes}
					previousMemory={previousDataRef.current.memoryMistakes}
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
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{t("screen.practice.lastPracticed", {
										when: formatDaysAgo(piece.lastPracticed, t),
									})}
								</Text>
							</View>

							<Divider />

							<View className="gap-2">
								<Text variant="titleSmall">
									{t("screen.practice.achievedBpmLabel")}
								</Text>
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

							<Button
								mode="contained"
								onPress={handleSave}
								loading={loading}
								disabled={loading}
							>
								{t("screen.practice.save")}
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

			<DeletePieceDialog
				visible={deleteDialogVisible}
				pieceName={piece?.title ?? ""}
				loading={deleteLoading}
				onConfirm={handleDelete}
				onDismiss={() => setDeleteDialogVisible(false)}
			/>
		</View>
	);
}
