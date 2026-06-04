import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, ScrollView, useWindowDimensions, View } from "react-native";
import {
	ActivityIndicator,
	Card,
	Divider,
	FAB,
	IconButton,
	List,
	Portal,
	Searchbar,
	Snackbar,
	Text,
	useTheme,
} from "react-native-paper";
import { PieceStateChip } from "@/components/piece/PieceStateChip";
import { DeletePieceDialog } from "@/components/ui/DeletePieceDialog";
import { PieceProgressBar } from "@/components/ui/PieceProgressBar";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { StateFilterDropdown } from "@/components/ui/StateFilterDropdown";
import { useFabStyleTabs } from "@/hooks/use-fab-style";
import { useFabVisible } from "@/hooks/use-fab-visible";
import { useDeletePiece, usePieces } from "@/hooks/use-pieces";
import { PIECE_STATES, type Piece, type PieceState } from "@/models/piece";
import { formatDaysAgo } from "@/utils/date";

const MD3_MEDIUM_BREAKPOINT = 600;

type StateFilter = PieceState | "all";
type ContextMenu = { pieceId: string; x: number; y: number };

export default function PiecesScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { pieces, loading } = usePieces();
	const { deletePiece } = useDeletePiece();
	const fabStyle = useFabStyleTabs();
	const fabVisible = useFabVisible();
	const [searchQuery, setSearchQuery] = useState("");
	const [stateFilter, setStateFilter] = useState<StateFilter>("all");
	const [menuVisible, setMenuVisible] = useState<string | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
	const [deletingPiece, setDeletingPiece] = useState<Piece | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

	const filteredPieces = useMemo(() => {
		let result = pieces;
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(p) =>
					p.title.toLowerCase().includes(query) ||
					p.composer.toLowerCase().includes(query),
			);
		}
		if (stateFilter !== "all") {
			result = result.filter((p) => p.state === stateFilter);
		}
		return result;
	}, [pieces, searchQuery, stateFilter]);

	const handleDelete = async () => {
		if (!deletingPiece?.id) return;
		setDeleteLoading(true);
		try {
			await deletePiece(deletingPiece.id);
			setDeletingPiece(null);
		} catch {
			setDeletingPiece(null);
			setDeleteError(t("error.deletePiece"));
		} finally {
			setDeleteLoading(false);
		}
	};

	const pieceMenuLabels = {
		practice: t("screen.pieces.menu.practice"),
		edit: t("screen.pieces.menu.edit"),
		delete: t("screen.pieces.menu.delete"),
	};

	const renderCardMenu = (item: Piece) => (
		<RowActionsMenu
			visible={menuVisible === item.id}
			onDismiss={() => setMenuVisible(null)}
			anchor={
				<IconButton
					icon="dots-vertical"
					size={20}
					accessibilityLabel={t("a11y.menu.options")}
					onPress={() => setMenuVisible(item.id ?? null)}
				/>
			}
			onPractice={() => {
				setMenuVisible(null);
				router.push(`/piece/${item.id}/practice?from=pieces`);
			}}
			onEdit={() => {
				setMenuVisible(null);
				router.push(`/piece/${item.id}/edit`);
			}}
			onDelete={() => {
				setMenuVisible(null);
				setDeletingPiece(item);
			}}
			labels={pieceMenuLabels}
		/>
	);

	const renderCompactItem = ({ item }: { item: Piece }) => (
		<List.Item
			title={item.title}
			description={() => (
				<View className="gap-1 mt-1">
					<Text
						variant="bodyMedium"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{item.composer}
					</Text>
					<View className="flex-row items-center gap-2 flex-wrap">
						<PieceStateChip state={item.state} />
						{(item.sectionCount ?? 0) > 0 && (
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{t("piece.sectionCount", { count: item.sectionCount })}
							</Text>
						)}
						<Text
							variant="bodySmall"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{formatDaysAgo(item.lastPracticed, t)}
						</Text>
					</View>
				</View>
			)}
			right={() => (
				<View className="justify-center w-24">
					<PieceProgressBar
						technicalMistakes={item.lastTechnicalMistakes}
						memoryMistakes={item.lastMemoryMistakes}
					/>
				</View>
			)}
			onPress={() => router.push(`/piece/${item.id}`)}
			onLongPress={(e) =>
				setContextMenu({
					pieceId: item.id ?? "",
					x: e.nativeEvent.pageX,
					y: e.nativeEvent.pageY,
				})
			}
		/>
	);

	const emptyState = (
		<View className="flex-1 items-center justify-center p-4">
			<Text
				variant="bodyLarge"
				style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
			>
				{t("screen.pieces.noResults")}
			</Text>
		</View>
	);

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<View className="px-4 pt-3 pb-2">
				<Searchbar
					placeholder={t("screen.pieces.searchPlaceholder")}
					value={searchQuery}
					onChangeText={setSearchQuery}
				/>
			</View>

			<StateFilterDropdown
				states={PIECE_STATES}
				selected={stateFilter}
				onSelect={setStateFilter}
				labelFor={(s) => t(`piece.state.${s}` as Parameters<typeof t>[0])}
				statusLabel={t("common.filterStatus")}
			/>

			{loading ? (
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator size="large" />
				</View>
			) : filteredPieces.length === 0 ? (
				emptyState
			) : isCompact ? (
				<FlatList
					data={filteredPieces}
					keyExtractor={(item) => item.id ?? ""}
					renderItem={renderCompactItem}
					ItemSeparatorComponent={() => <Divider />}
					style={{ flex: 1 }}
				/>
			) : (
				<ScrollView style={{ flex: 1 }}>
					<View
						className="w-full max-w-xl self-center gap-3"
						style={{ paddingHorizontal: 24, paddingBottom: 100 }}
					>
						{filteredPieces.map((item) => (
							<Card
								key={item.id}
								mode="elevated"
								onPress={() => router.push(`/piece/${item.id}`)}
							>
								<Card.Title
									title={item.title}
									subtitle={item.composer}
									right={() => renderCardMenu(item)}
								/>
								<Card.Content>
									<View className="gap-2">
										<View className="flex-row items-center gap-2 flex-wrap">
											<PieceStateChip state={item.state} />
											{(item.sectionCount ?? 0) > 0 && (
												<Text
													variant="bodySmall"
													style={{ color: theme.colors.onSurfaceVariant }}
												>
													{t("piece.sectionCount", {
														count: item.sectionCount,
													})}
												</Text>
											)}
										</View>
										<PieceProgressBar
											technicalMistakes={item.lastTechnicalMistakes}
											memoryMistakes={item.lastMemoryMistakes}
										/>
										<Text
											variant="bodySmall"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											{formatDaysAgo(item.lastPracticed, t)}
										</Text>
									</View>
								</Card.Content>
							</Card>
						))}
					</View>
				</ScrollView>
			)}

			{/* Long-press context menu for compact list items */}
			<RowActionsMenu
				visible={contextMenu !== null}
				onDismiss={() => setContextMenu(null)}
				anchor={contextMenu ?? { x: 0, y: 0 }}
				onPractice={() => {
					const pieceId = contextMenu?.pieceId;
					setContextMenu(null);
					if (pieceId) router.push(`/piece/${pieceId}/practice?from=pieces`);
				}}
				onEdit={() => {
					const pieceId = contextMenu?.pieceId;
					setContextMenu(null);
					if (pieceId) router.push(`/piece/${pieceId}/edit`);
				}}
				onDelete={() => {
					const piece = pieces.find((p) => p.id === contextMenu?.pieceId);
					setContextMenu(null);
					if (piece) setDeletingPiece(piece);
				}}
				labels={pieceMenuLabels}
			/>

			<DeletePieceDialog
				visible={deletingPiece !== null}
				pieceName={deletingPiece?.title ?? ""}
				loading={deleteLoading}
				onConfirm={handleDelete}
				onDismiss={() => setDeletingPiece(null)}
			/>

			<Snackbar
				visible={!!deleteError}
				onDismiss={() => setDeleteError(null)}
				duration={4000}
				action={{ label: t("common.ok"), onPress: () => setDeleteError(null) }}
			>
				{deleteError ?? ""}
			</Snackbar>

			{fabVisible && (
				<Portal>
					<FAB
						icon="plus"
						accessibilityLabel={t("a11y.fab.addPiece")}
						style={fabStyle}
						onPress={() => router.push("/piece/add")}
					/>
				</Portal>
			)}
		</View>
	);
}
