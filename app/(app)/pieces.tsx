import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, ScrollView, useWindowDimensions, View } from "react-native";
import {
	Appbar,
	Card,
	Chip,
	Divider,
	IconButton,
	List,
	Menu,
	Searchbar,
	Snackbar,
	Text,
	useTheme,
} from "react-native-paper";
import { PieceStateChip } from "@/components/piece/PieceStateChip";
import { DeletePieceDialog } from "@/components/ui/DeletePieceDialog";
import { PieceProgressBar } from "@/components/ui/PieceProgressBar";
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
	const { pieces } = usePieces();
	const { deletePiece } = useDeletePiece();
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

	const renderCardMenu = (item: Piece) => (
		<Menu
			visible={menuVisible === item.id}
			onDismiss={() => setMenuVisible(null)}
			anchor={
				<IconButton
					icon="dots-vertical"
					size={20}
					onPress={() => setMenuVisible(item.id ?? null)}
				/>
			}
		>
			<Menu.Item
				leadingIcon="pencil"
				onPress={() => {
					setMenuVisible(null);
					router.push(`/edit-piece/${item.id}`);
				}}
				title={t("screen.pieces.menu.edit")}
			/>
			<Menu.Item
				leadingIcon="delete"
				onPress={() => {
					setMenuVisible(null);
					setDeletingPiece(item);
				}}
				title={t("screen.pieces.menu.delete")}
			/>
		</Menu>
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

	const filterChips = (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			className="py-2"
		>
			<View className="flex-row gap-2 px-4">
				{(["all", ...PIECE_STATES] as StateFilter[]).map((s) => (
					<Chip
						key={s}
						selected={stateFilter === s}
						onPress={() => setStateFilter(s)}
						compact
					>
						{s === "all" ? t("screen.pieces.filterAll") : t(`piece.state.${s}`)}
					</Chip>
				))}
			</View>
		</ScrollView>
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
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={t("screen.pieces.title")} />
			</Appbar.Header>

			<View className="px-4 pt-4">
				<Searchbar
					placeholder={t("screen.pieces.searchPlaceholder")}
					value={searchQuery}
					onChangeText={setSearchQuery}
				/>
			</View>

			{filterChips}

			{filteredPieces.length === 0 ? (
				emptyState
			) : isCompact ? (
				<FlatList
					data={filteredPieces}
					keyExtractor={(item) => item.id ?? ""}
					renderItem={renderCompactItem}
					ItemSeparatorComponent={() => <Divider />}
				/>
			) : (
				<ScrollView>
					<View
						className="w-full max-w-xl self-center gap-3"
						style={{ paddingHorizontal: 24, paddingBottom: 24 }}
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
			<Menu
				visible={contextMenu !== null}
				onDismiss={() => setContextMenu(null)}
				anchor={contextMenu ?? { x: 0, y: 0 }}
			>
				<Menu.Item
					leadingIcon="pencil"
					onPress={() => {
						const pieceId = contextMenu?.pieceId;
						setContextMenu(null);
						if (pieceId) router.push(`/edit-piece/${pieceId}`);
					}}
					title={t("screen.pieces.menu.edit")}
				/>
				<Menu.Item
					leadingIcon="delete"
					onPress={() => {
						const piece = pieces.find((p) => p.id === contextMenu?.pieceId);
						setContextMenu(null);
						if (piece) setDeletingPiece(piece);
					}}
					title={t("screen.pieces.menu.delete")}
				/>
			</Menu>

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
				action={{ label: "OK", onPress: () => setDeleteError(null) }}
			>
				{deleteError ?? ""}
			</Snackbar>
		</View>
	);
}
