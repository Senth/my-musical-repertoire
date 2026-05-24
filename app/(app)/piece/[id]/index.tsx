import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import DraggableFlatList, {
	type RenderItemParams,
	ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
	ActivityIndicator,
	Appbar,
	Button,
	Divider,
	FAB,
	IconButton,
	Menu,
	Snackbar,
	Text,
	TextInput,
	useTheme,
} from "react-native-paper";
import { PieceStateChip } from "@/components/piece/PieceStateChip";
import { SectionDetailRow } from "@/components/section/SectionDetailRow";
import { DeletePieceDialog } from "@/components/ui/DeletePieceDialog";
import { useFabStyleStack } from "@/hooks/use-fab-style";
import { useDeletePiece, usePieces, useUpdatePiece } from "@/hooks/use-pieces";
import { useReorderSections, useSections } from "@/hooks/use-sections";
import type { Section } from "@/models/section";
import { formatDaysAgo } from "@/utils/date";

export default function PieceDetailScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();

	const { pieces, loading: piecesLoading } = usePieces();
	const { sections, loading: sectionsLoading } = useSections(id ?? "");
	const fabStyle = useFabStyleStack();
	const { deletePiece } = useDeletePiece();
	const { updatePiece } = useUpdatePiece();
	const { reorderSections } = useReorderSections();

	const piece = pieces.find((p) => p.id === id);

	const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [notesEditing, setNotesEditing] = useState(false);
	const [notesText, setNotesText] = useState("");
	const [notesSaving, setNotesSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [sectionsMenuVisible, setSectionsMenuVisible] = useState(false);
	const [reordering, setReordering] = useState(false);

	// Seed notes text when piece data arrives
	useEffect(() => {
		if (!notesEditing) {
			setNotesText(piece?.notes ?? "");
		}
	}, [piece?.notes, notesEditing]);

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

	const handleNotesSave = async () => {
		if (!id) return;
		setNotesSaving(true);
		try {
			await updatePiece(id, { notes: notesText.trim() || null });
			setNotesEditing(false);
		} catch {
			setError(t("error.firebase"));
		} finally {
			setNotesSaving(false);
		}
	};

	const handleDragEnd = useCallback(
		async ({ data }: { data: Section[] }) => {
			if (!id) return;
			const ids = data.map((s) => s.id).filter((sid): sid is string => !!sid);
			try {
				await reorderSections(id, ids);
			} catch {
				setError(t("error.reorderSections"));
			}
		},
		[id, reorderSections, t],
	);

	const renderDragItem = useCallback(
		({ item, drag, isActive }: RenderItemParams<Section>) => {
			const barRangeText = (() => {
				if (item.startBar != null && item.endBar != null) {
					return t("screen.pieceSections.barRange", {
						start: item.startBar,
						end: item.endBar,
					});
				}
				if (item.startBar != null) {
					return t("screen.pieceSections.barFrom", { start: item.startBar });
				}
				return null;
			})();
			return (
				<ScaleDecorator>
					<View
						className="flex-row items-center py-2 px-4"
						style={{ backgroundColor: theme.colors.surface }}
					>
						<View className="flex-1 gap-1">
							<Text variant="bodyLarge">{item.label}</Text>
							{barRangeText != null && (
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{barRangeText}
								</Text>
							)}
						</View>
						<IconButton
							icon="drag"
							size={20}
							accessibilityLabel={t("a11y.drag.reorder")}
							onLongPress={drag}
							onPressIn={drag}
							disabled={isActive}
							style={{ margin: 0 }}
						/>
					</View>
				</ScaleDecorator>
			);
		},
		[t, theme.colors.surface, theme.colors.onSurfaceVariant],
	);

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
				<Text variant="bodyLarge">{t("screen.pieceDetail.pieceNotFound")}</Text>
			</View>
		);
	}

	const lastPracticedLine = t("screen.pieceDetail.lastPracticed", {
		when: formatDaysAgo(piece.lastPracticed, t),
	});
	const metaLine =
		piece.targetTempoBpm != null
			? `${lastPracticedLine} · ${t("screen.pieceDetail.targetBpm", { bpm: piece.targetTempoBpm })}`
			: lastPracticedLine;

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={piece.title} />
				<Appbar.Action
					icon="pencil"
					accessibilityLabel={t("a11y.action.edit")}
					onPress={() => router.push(`/piece/${id}/edit`)}
				/>
				<Appbar.Action
					icon="delete"
					accessibilityLabel={t("a11y.action.delete")}
					onPress={() => setDeleteDialogVisible(true)}
				/>
			</Appbar.Header>

			{reordering ? (
				<GestureHandlerRootView style={{ flex: 1 }}>
					<View className="flex-row items-center justify-between px-4 py-2">
						<Text
							variant="titleSmall"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{t("screen.pieceDetail.sections")}
						</Text>
						<Button onPress={() => setReordering(false)}>
							{t("common.done")}
						</Button>
					</View>
					<DraggableFlatList
						data={sections}
						keyExtractor={(item) => item.id ?? ""}
						renderItem={renderDragItem}
						onDragEnd={handleDragEnd}
						contentContainerStyle={{ paddingBottom: 96 }}
					/>
				</GestureHandlerRootView>
			) : (
				<ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
					{/* Piece header info */}
					<View className="px-4 pt-4 gap-2">
						<View className="flex-row items-center gap-2 flex-wrap">
							<Text
								variant="titleMedium"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{piece.composer}
							</Text>
							<PieceStateChip state={piece.state} />
						</View>
					</View>

					{/* Practice button (promoted above metadata) */}
					<View className="px-4 pt-4">
						<Button
							mode="contained"
							onPress={() =>
								router.push(`/piece/${id}/practice?from=piece-detail`)
							}
							contentStyle={{ paddingVertical: 4 }}
						>
							{t("screen.pieceDetail.practice")}
						</Button>
					</View>

					{/* Compact meta line */}
					<View className="px-4 pt-2">
						<Text
							variant="bodyMedium"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{metaLine}
						</Text>
					</View>

					<Divider className="mt-6" />

					{/* Notes section */}
					<View className="px-4 pt-4 gap-2">
						<View className="flex-row items-center justify-between">
							<Text
								variant="titleSmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{t("screen.pieceDetail.notes")}
							</Text>
							{!notesEditing && (
								<IconButton
									icon="pencil"
									size={18}
									accessibilityLabel={t("screen.pieceDetail.editNotes")}
									onPress={() => setNotesEditing(true)}
									style={{ margin: 0 }}
								/>
							)}
						</View>

						{notesEditing ? (
							<View className="gap-2">
								<TextInput
									value={notesText}
									onChangeText={setNotesText}
									mode="outlined"
									multiline
									numberOfLines={4}
									autoFocus
								/>
								<View className="flex-row gap-2 justify-end">
									<Button
										onPress={() => {
											setNotesText(piece.notes ?? "");
											setNotesEditing(false);
										}}
										disabled={notesSaving}
									>
										{t("screen.pieceSections.archiveDialog.cancel")}
									</Button>
									<Button
										mode="contained"
										onPress={handleNotesSave}
										loading={notesSaving}
										disabled={notesSaving}
									>
										{t("screen.editPiece.save")}
									</Button>
								</View>
							</View>
						) : (
							<Text
								variant="bodyMedium"
								style={{
									color: piece.notes
										? theme.colors.onSurface
										: theme.colors.onSurfaceVariant,
								}}
							>
								{piece.notes ?? t("screen.pieceDetail.noNotes")}
							</Text>
						)}
					</View>

					<Divider className="mt-6" />

					{/* Sections header */}
					<View className="flex-row items-center justify-between px-4 pt-4">
						<Text
							variant="titleSmall"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{t("screen.pieceDetail.sections")}
						</Text>
						{sections.length > 0 && (
							<Menu
								visible={sectionsMenuVisible}
								onDismiss={() => setSectionsMenuVisible(false)}
								anchor={
									<IconButton
										icon="dots-vertical"
										size={20}
										accessibilityLabel={t("a11y.menu.options")}
										onPress={() => setSectionsMenuVisible(true)}
										style={{ margin: 0 }}
									/>
								}
							>
								<Menu.Item
									leadingIcon="reorder-horizontal"
									title={t("screen.pieceDetail.reorderSections")}
									onPress={() => {
										setSectionsMenuVisible(false);
										setReordering(true);
									}}
								/>
							</Menu>
						)}
					</View>

					{/* Sections list / empty state */}
					{!sectionsLoading && sections.length === 0 ? (
						<View className="items-center py-8 gap-4 px-4">
							<IconButton
								icon="music-note-outline"
								size={48}
								disabled
								style={{ margin: 0, opacity: 0.6 }}
							/>
							<Text variant="titleMedium">
								{t("screen.pieceDetail.sectionsEmpty.title")}
							</Text>
							<Text
								variant="bodyMedium"
								style={{
									textAlign: "center",
									color: theme.colors.onSurfaceVariant,
								}}
							>
								{t("screen.pieceDetail.sectionsEmpty.body")}
							</Text>
							<Button
								mode="outlined"
								onPress={() => router.push(`/piece/${id}/section/new`)}
							>
								{t("screen.pieceDetail.sectionsEmpty.addButton")}
							</Button>
						</View>
					) : (
						<View className="pt-1">
							{sections.map((s) => (
								<SectionDetailRow
									key={s.id}
									section={s}
									pieceTargetBpm={piece.targetTempoBpm}
									onPress={() => router.push(`/piece/${id}/section/${s.id}`)}
									onPracticePress={() =>
										router.push(
											`/piece/${id}/practice?sectionId=${s.id}&from=piece-detail`,
										)
									}
								/>
							))}
						</View>
					)}
				</ScrollView>
			)}

			{!reordering && (
				<FAB
					icon="plus"
					accessibilityLabel={t("a11y.fab.addSection")}
					style={fabStyle}
					onPress={() => router.push(`/piece/${id}/section/new`)}
				/>
			)}

			<DeletePieceDialog
				visible={deleteDialogVisible}
				pieceName={piece.title}
				loading={deleteLoading}
				onConfirm={handleDelete}
				onDismiss={() => setDeleteDialogVisible(false)}
			/>

			<Snackbar
				visible={!!error}
				onDismiss={() => setError(null)}
				duration={4000}
				action={{ label: t("common.ok"), onPress: () => setError(null) }}
			>
				{error ?? ""}
			</Snackbar>
		</View>
	);
}
