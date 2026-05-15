import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import {
	Appbar,
	Button,
	Divider,
	FAB,
	IconButton,
	List,
	Snackbar,
	Text,
	TextInput,
	useTheme,
} from "react-native-paper";
import { PieceStateChip } from "@/components/piece/PieceStateChip";
import { SectionDetailRow } from "@/components/section/SectionDetailRow";
import { DeletePieceDialog } from "@/components/ui/DeletePieceDialog";
import { useDeletePiece, usePieces, useUpdatePiece } from "@/hooks/use-pieces";
import { useSections } from "@/hooks/use-sections";
import { formatDaysAgo } from "@/utils/date";

export default function PieceDetailScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();

	const { pieces } = usePieces();
	const { sections, loading: sectionsLoading } = useSections(id ?? "");
	const { deletePiece } = useDeletePiece();
	const { updatePiece } = useUpdatePiece();

	const piece = pieces.find((p) => p.id === id);

	const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [notesEditing, setNotesEditing] = useState(false);
	const [notesText, setNotesText] = useState("");
	const [notesSaving, setNotesSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
					onPress={() => router.push(`/piece/${id}/edit`)}
				/>
				<Appbar.Action
					icon="delete"
					onPress={() => setDeleteDialogVisible(true)}
				/>
			</Appbar.Header>

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
					<Text
						variant="bodyMedium"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.pieceDetail.lastPracticed", {
							when: formatDaysAgo(piece.lastPracticed, t),
						})}
					</Text>
					{piece.targetTempoBpm != null && (
						<Text
							variant="bodyMedium"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{t("screen.pieceDetail.targetBpm", {
								bpm: piece.targetTempoBpm,
							})}
						</Text>
					)}
				</View>

				{/* Practice button */}
				<View className="px-4 pt-4">
					<Button
						mode="contained"
						onPress={() => router.push(`/piece/${id}/practice`)}
						contentStyle={{ paddingVertical: 4 }}
					>
						{t("screen.pieceDetail.practice")}
					</Button>
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

				{/* Sections */}
				<View className="pt-4 gap-1">
					<Text
						variant="titleSmall"
						className="px-4"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.pieceDetail.sections")}
					</Text>

					{!sectionsLoading && sections.length === 0 ? (
						<Text
							variant="bodyMedium"
							className="px-4 pt-2"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{t("screen.pieceSections.empty")}
						</Text>
					) : (
						<View>
							{sections.map((s) => (
								<SectionDetailRow
									key={s.id}
									section={s}
									pieceTargetBpm={piece.targetTempoBpm}
									onPress={() => router.push(`/piece/${id}/section/${s.id}`)}
								/>
							))}
						</View>
					)}

					{/* Link to manage / reorder */}
					<List.Item
						title={t("screen.pieceDetail.manageSections")}
						left={(props) => <List.Icon {...props} icon="playlist-edit" />}
						right={(props) => <List.Icon {...props} icon="chevron-right" />}
						onPress={() => router.push(`/piece/${id}/section`)}
					/>
				</View>
			</ScrollView>

			<FAB
				icon="plus"
				style={{ position: "absolute", right: 16, bottom: 16 }}
				onPress={() => router.push(`/piece/${id}/section/new`)}
			/>

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
				action={{ label: "OK", onPress: () => setError(null) }}
			>
				{error ?? ""}
			</Snackbar>
		</View>
	);
}
