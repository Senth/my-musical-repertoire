import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import DraggableFlatList, {
	type RenderItemParams,
	ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
	Appbar,
	Button,
	Dialog,
	FAB,
	IconButton,
	Portal,
	Snackbar,
	Text,
	useTheme,
} from "react-native-paper";
import { SectionListItem } from "@/components/section/SectionListItem";
import { usePieces } from "@/hooks/use-pieces";
import {
	useArchiveSection,
	useReorderSections,
	useSections,
} from "@/hooks/use-sections";
import type { Section } from "@/models/section";

export default function PieceSectionsScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { id: pieceId } = useLocalSearchParams<{ id: string }>();

	const { pieces } = usePieces();
	const piece = pieces.find((p) => p.id === pieceId);

	const { sections, loading } = useSections(pieceId ?? "");
	const { archiveSection } = useArchiveSection();
	const { reorderSections } = useReorderSections();

	const [archivingSection, setArchivingSection] = useState<Section | null>(
		null,
	);
	const [archiveLoading, setArchiveLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleAddPress = () => {
		if (!pieceId) return;
		router.push(`/piece/${pieceId}/section/new`);
	};

	const handleEdit = useCallback(
		(section: Section) => {
			if (!pieceId || !section.id) return;
			router.push(`/piece/${pieceId}/section/${section.id}`);
		},
		[pieceId, router],
	);

	const handleArchiveConfirm = async () => {
		if (!archivingSection?.id || !pieceId) return;
		setArchiveLoading(true);
		try {
			await archiveSection(pieceId, archivingSection.id);
			setArchivingSection(null);
		} catch {
			setArchivingSection(null);
			setError(t("error.deleteSection"));
		} finally {
			setArchiveLoading(false);
		}
	};

	const handleDragEnd = useCallback(
		async ({ data }: { data: Section[] }) => {
			if (!pieceId) return;
			const ids = data.map((s) => s.id).filter((id): id is string => !!id);
			try {
				await reorderSections(pieceId, ids);
			} catch {
				setError(t("error.reorderSections"));
			}
		},
		[pieceId, reorderSections, t],
	);

	const renderItem = useCallback(
		({ item, drag, isActive }: RenderItemParams<Section>) => (
			<ScaleDecorator>
				<SectionListItem
					section={item}
					onEdit={handleEdit}
					onArchive={(s) => setArchivingSection(s)}
					dragHandle={
						<IconButton
							icon="drag"
							size={20}
							onLongPress={drag}
							disabled={isActive}
							style={{ margin: 0 }}
						/>
					}
				/>
			</ScaleDecorator>
		),
		[handleEdit],
	);

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<View
				className="flex-1"
				style={{ backgroundColor: theme.colors.background }}
			>
				<Appbar.Header>
					<Appbar.BackAction onPress={() => router.back()} />
					<Appbar.Content
						title={t("screen.pieceSections.title")}
						subtitle={piece ? `${piece.composer} — ${piece.title}` : undefined}
					/>
				</Appbar.Header>

				{!loading && sections.length === 0 ? (
					<View className="flex-1 items-center justify-center p-8">
						<Text
							variant="bodyLarge"
							style={{
								color: theme.colors.onSurfaceVariant,
								textAlign: "center",
							}}
						>
							{t("screen.pieceSections.empty")}
						</Text>
					</View>
				) : (
					<DraggableFlatList
						data={sections}
						keyExtractor={(item) => item.id ?? ""}
						renderItem={renderItem}
						onDragEnd={handleDragEnd}
						contentContainerStyle={{ paddingBottom: 96 }}
					/>
				)}

				<FAB
					icon="plus"
					style={{
						position: "absolute",
						right: 16,
						bottom: 16,
					}}
					onPress={handleAddPress}
				/>

				<Portal>
					<Dialog
						visible={archivingSection !== null}
						onDismiss={() => setArchivingSection(null)}
					>
						<Dialog.Title>
							{t("screen.pieceSections.archiveDialog.title")}
						</Dialog.Title>
						<Dialog.Content>
							<Text>
								{t("screen.pieceSections.archiveDialog.message", {
									name: archivingSection?.label ?? "",
								})}
							</Text>
						</Dialog.Content>
						<Dialog.Actions>
							<Button onPress={() => setArchivingSection(null)}>
								{t("screen.pieceSections.archiveDialog.cancel")}
							</Button>
							<Button
								onPress={handleArchiveConfirm}
								loading={archiveLoading}
								disabled={archiveLoading}
							>
								{t("screen.pieceSections.archiveDialog.confirm")}
							</Button>
						</Dialog.Actions>
					</Dialog>
				</Portal>

				<Snackbar
					visible={!!error}
					onDismiss={() => setError(null)}
					duration={4000}
					action={{ label: "OK", onPress: () => setError(null) }}
				>
					{error ?? ""}
				</Snackbar>
			</View>
		</GestureHandlerRootView>
	);
}
