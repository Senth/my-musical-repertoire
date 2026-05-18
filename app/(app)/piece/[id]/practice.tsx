import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, useWindowDimensions, View } from "react-native";
import {
	ActivityIndicator,
	Appbar,
	Button,
	Divider,
	HelperText,
	List,
	Menu,
	Modal,
	Portal,
	RadioButton,
	SegmentedButtons,
	Snackbar,
	Text,
	TextInput,
	TouchableRipple,
	useTheme,
} from "react-native-paper";
import { PracticeComparison } from "@/components/practice/PracticeComparison";
import { DeletePieceDialog } from "@/components/ui/DeletePieceDialog";
import { useDeletePiece, usePieces } from "@/hooks/use-pieces";
import { useSavePractice } from "@/hooks/use-practices";
import { useSections } from "@/hooks/use-sections";
import { PracticeMistakes } from "@/models/practice";
import { formatDaysAgo } from "@/utils/date";

function formatDateForInput(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

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
	const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
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

	// Capture previous practice data before save overwrites it
	const previousDataRef = useRef({
		technicalMistakes: piece?.lastTechnicalMistakes,
		memoryMistakes: piece?.lastMemoryMistakes,
	});

	const [date, setDate] = useState(formatDateForInput(new Date()));
	const [technicalMistakes, setTechnicalMistakes] = useState<PracticeMistakes>(
		PracticeMistakes.none,
	);
	const [memoryMistakes, setMemoryMistakes] = useState<PracticeMistakes>(
		PracticeMistakes.none,
	);
	const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
		null,
	);
	const [sectionPickerVisible, setSectionPickerVisible] = useState(false);
	const [achievedBpm, setAchievedBpm] = useState<string>("");
	const [bpmError, setBpmError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

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

	const selectedSection = selectedSectionId
		? (sections.find((s) => s.id === selectedSectionId) ?? null)
		: null;

	// Re-initialize BPM whenever selected section changes
	useEffect(() => {
		setAchievedBpm(selectedSection?.currentBpm?.toString() ?? "");
	}, [selectedSection?.currentBpm]);

	const handleSave = async () => {
		if (!id) return;

		const bpmErr = validateBpm(achievedBpm);
		setBpmError(bpmErr);
		if (bpmErr) return;

		setLoading(true);
		setError(null);

		try {
			const practiceDate = new Date(`${date}T12:00:00`);
			const bpm =
				selectedSectionId && achievedBpm.trim()
					? Number.parseInt(achievedBpm.trim(), 10) || null
					: null;
			await savePractice(
				id,
				practiceDate,
				technicalMistakes,
				memoryMistakes,
				bpm,
				selectedSectionId,
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

	const selectedSectionLabel =
		selectedSection?.label ?? t("screen.practice.fullPiece");

	const mistakeButtons = MISTAKE_BUTTONS.map((b) => ({
		value: b.value,
		label: t(b.labelKey),
	}));

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={piece?.title ?? t("screen.practice.title")} />
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
								<Text variant="headlineSmall">{piece.title}</Text>
								<Text
									variant="bodyLarge"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{piece.composer}
								</Text>
							</View>

							<Divider />
							<List.Item
								title={t("screen.practice.sectionLabel")}
								description={selectedSectionLabel}
								left={(props) => (
									<List.Icon {...props} icon="music-note-plus" />
								)}
								right={(props) => <List.Icon {...props} icon="chevron-down" />}
								onPress={() => setSectionPickerVisible(true)}
							/>

							{selectedSection && (
								<View className="gap-2">
									<Text variant="titleSmall">
										{t("screen.practice.achievedBpmLabel")}
									</Text>
									<TextInput
										mode="outlined"
										keyboardType="numeric"
										value={achievedBpm}
										onChangeText={setAchievedBpm}
										placeholder="e.g. 80"
										error={!!bpmError}
										onBlur={handleBpmBlur}
									/>
									<HelperText type="error" visible={!!bpmError}>
										{bpmError ?? ""}
									</HelperText>
								</View>
							)}
							<Divider />

							<View className="gap-2">
								<Text variant="titleSmall">
									{t("screen.practice.dateLabel")}
								</Text>
								{Platform.OS === "web" ? (
									<input
										type="date"
										value={date}
										onChange={(e) => setDate(e.target.value)}
										style={{
											padding: 12,
											borderRadius: 4,
											border: `1px solid ${theme.colors.outline}`,
											backgroundColor: theme.colors.surface,
											color: theme.colors.onSurface,
											fontSize: 16,
										}}
									/>
								) : (
									<Button
										mode="outlined"
										onPress={() => {
											/* TODO: Native date picker */
										}}
									>
										{new Date(`${date}T12:00:00`).toLocaleDateString()}
									</Button>
								)}
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{t("screen.practice.lastPracticed", {
										when: formatDaysAgo(piece.lastPracticed, t),
									})}
								</Text>
							</View>

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

			<Portal>
				<Modal
					visible={sectionPickerVisible}
					onDismiss={() => setSectionPickerVisible(false)}
					contentContainerStyle={{
						backgroundColor: theme.colors.surface,
						margin: 24,
						padding: 24,
						borderRadius: 12,
					}}
				>
					<Text variant="titleMedium" style={{ marginBottom: 12 }}>
						{t("screen.practice.sectionPickerTitle")}
					</Text>
					<RadioButton.Group
						value={selectedSectionId ?? "__full__"}
						onValueChange={(v) => {
							setSelectedSectionId(v === "__full__" ? null : v);
							setSectionPickerVisible(false);
						}}
					>
						<TouchableRipple
							onPress={() => {
								setSelectedSectionId(null);
								setSectionPickerVisible(false);
							}}
						>
							<View className="flex-row items-center">
								<RadioButton value="__full__" />
								<Text variant="bodyLarge">
									{t("screen.practice.fullPiece")}
								</Text>
							</View>
						</TouchableRipple>
						{sections.map((s) => (
							<TouchableRipple
								key={s.id}
								onPress={() => {
									setSelectedSectionId(s.id ?? null);
									setSectionPickerVisible(false);
								}}
							>
								<View className="flex-row items-center">
									<RadioButton value={s.id ?? ""} />
									<Text variant="bodyLarge">{s.label}</Text>
								</View>
							</TouchableRipple>
						))}
					</RadioButton.Group>
				</Modal>
			</Portal>

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
