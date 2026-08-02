import { useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, View } from "react-native";
import {
	ActivityIndicator,
	Button,
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
import {
	accentBorderStyle,
	CARD_TITLE_STYLE,
} from "@/components/ui/card-style";
import { DeletePieceDialog } from "@/components/ui/DeletePieceDialog";
import { FilterPillRow } from "@/components/ui/FilterPillRow";
import {
	FilterSheet,
	type FilterSheetSection,
} from "@/components/ui/FilterSheet";
import { ListHeaderActions } from "@/components/ui/ListHeaderActions";
import { PieceProgressBar } from "@/components/ui/PieceProgressBar";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { SortMenu } from "@/components/ui/SortMenu";
import { useFabStyleTabs } from "@/hooks/use-fab-style";
import { useFabVisible } from "@/hooks/use-fab-visible";
import { useIsCompact } from "@/hooks/use-is-compact";
import { useListPrefs } from "@/hooks/use-list-prefs";
import { usePieceScores } from "@/hooks/use-piece-scores";
import { useDeletePiece, usePieces } from "@/hooks/use-pieces";
import { PIECE_STATES, type Piece } from "@/models/piece";
import { formatDaysAgo } from "@/utils/date";
import {
	availableCollections,
	availableComposers,
	DEFAULT_PIECE_FILTERS,
	DIFFICULTIES,
	type Difficulty,
	filterPieces,
	hasNonDefaultPieceFilters,
	type PieceFilterPill,
	piecePills,
	removePiecePill,
	searchPieces,
	toggleValue,
} from "@/utils/list-filtering";
import { DEFAULT_PIECE_LIST_PREFS } from "@/utils/list-prefs";
import {
	nextSort,
	PIECE_SORTS,
	type PieceSortKey,
	sortPieces,
} from "@/utils/list-sorting";
import { formatComposerLine } from "@/utils/piece-display";
import {
	readPieceListPrefs,
	writePieceListPrefs,
} from "@/utils/session-storage";
import { pieceStateVisual } from "@/utils/state-colors";

type ContextMenu = { pieceId: string; x: number; y: number };

/** Digits only — an empty box means "no bound", not zero. */
function parseMinutes(text: string): number | null {
	const digits = text.replace(/\D/g, "");
	return digits ? Number(digits) : null;
}

function minutesText(value: number | null): string {
	return value == null ? "" : String(value);
}

export default function PiecesScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const navigation = useNavigation();
	const { pieces, loading } = usePieces();
	const { scores } = usePieceScores();
	const { deletePiece } = useDeletePiece();
	const fabStyle = useFabStyleTabs();
	const fabVisible = useFabVisible();
	const [searchQuery, setSearchQuery] = useState("");
	const [menuVisible, setMenuVisible] = useState<string | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
	const [deletingPiece, setDeletingPiece] = useState<Piece | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [sortAnchor, setSortAnchor] = useState<{ x: number; y: number } | null>(
		null,
	);
	const [filterOpen, setFilterOpen] = useState(false);
	const isCompact = useIsCompact();

	const { prefs, setPrefs } = useListPrefs(
		DEFAULT_PIECE_LIST_PREFS,
		readPieceListPrefs,
		writePieceListPrefs,
	);
	const { filters } = prefs;
	const filtersActive = hasNonDefaultPieceFilters(filters);

	const setFilters = useCallback(
		(update: (prev: typeof filters) => typeof filters) => {
			setPrefs((prev) => ({ ...prev, filters: update(prev.filters) }));
		},
		[setPrefs],
	);

	useLayoutEffect(() => {
		navigation.setOptions({
			headerRight: () => (
				<ListHeaderActions
					sortLabel={t("common.sort.open")}
					filterLabel={t("common.filter.open")}
					filtersActive={filtersActive}
					onOpenSort={setSortAnchor}
					onOpenFilter={() => setFilterOpen(true)}
				/>
			),
		});
	}, [navigation, t, filtersActive]);

	const visiblePieces = useMemo(() => {
		const matched = filterPieces(searchPieces(pieces, searchQuery), filters);
		return sortPieces(
			matched,
			{ key: prefs.sortKey, dir: prefs.sortDir },
			scores,
		);
	}, [pieces, searchQuery, filters, prefs.sortKey, prefs.sortDir, scores]);

	const composers = useMemo(() => availableComposers(pieces), [pieces]);
	const collections = useMemo(() => availableCollections(pieces), [pieces]);

	const pillLabel = useCallback(
		(pill: PieceFilterPill): string => {
			switch (pill.kind) {
				case "state":
					return t(`piece.state.${pill.value}` as Parameters<typeof t>[0]);
				case "composer":
				case "collection":
					return pill.value;
				case "difficulty":
					return t("common.filter.pill.difficulty", { value: pill.value });
				case "length":
					if (pill.min != null && pill.max != null) {
						return t("common.filter.pill.lengthRange", {
							min: pill.min,
							max: pill.max,
						});
					}
					if (pill.min != null) {
						return t("common.filter.pill.lengthFrom", { min: pill.min });
					}
					return t("common.filter.pill.lengthTo", { max: pill.max });
			}
		},
		[t],
	);

	const pills = useMemo(() => piecePills(filters), [filters]);
	const pillItems = useMemo(
		() =>
			pills.map((pill) => {
				const label = pillLabel(pill);
				return {
					id: pill.id,
					label,
					removeLabel: t("common.filter.remove", { label }),
				};
			}),
		[pills, pillLabel, t],
	);

	const removePill = useCallback(
		(id: string) => {
			const pill = pills.find((p) => p.id === id);
			if (!pill) return;
			setFilters((prev) => removePiecePill(prev, pill));
		},
		[pills, setFilters],
	);

	const clearFilters = useCallback(() => {
		setFilters(() => DEFAULT_PIECE_FILTERS);
	}, [setFilters]);

	const filterSections = useMemo((): FilterSheetSection[] => {
		const sections: FilterSheetSection[] = [
			{
				id: "status",
				title: t("common.filter.status"),
				type: "multi",
				options: PIECE_STATES.map((state) => ({
					value: state,
					label: t(`piece.state.${state}` as Parameters<typeof t>[0]),
				})),
				selected: filters.states,
				onToggle: (value) =>
					setFilters((prev) => ({
						...prev,
						states: toggleValue(
							prev.states,
							value as (typeof PIECE_STATES)[number],
							PIECE_STATES,
						),
					})),
			},
		];

		// A single-composer library has nothing to choose between.
		if (composers.length >= 2) {
			sections.push({
				id: "composer",
				title: t("common.filter.composer"),
				type: "multi",
				options: composers.map((c) => ({ value: c, label: c })),
				selected: filters.composers,
				onToggle: (value) =>
					setFilters((prev) => ({
						...prev,
						composers: toggleValue(prev.composers, value),
					})),
			});
		}

		if (collections.length >= 2) {
			sections.push({
				id: "collection",
				title: t("common.filter.collection"),
				type: "multi",
				options: collections.map((c) => ({ value: c, label: c })),
				selected: filters.collections,
				onToggle: (value) =>
					setFilters((prev) => ({
						...prev,
						collections: toggleValue(prev.collections, value),
					})),
			});
		}

		sections.push({
			id: "difficulty",
			title: t("common.filter.difficulty"),
			type: "multi",
			options: DIFFICULTIES.map((d) => ({
				value: String(d),
				label: String(d),
			})),
			selected: filters.difficulties.map(String),
			onToggle: (value) =>
				setFilters((prev) => ({
					...prev,
					difficulties: toggleValue(
						prev.difficulties,
						Number(value) as Difficulty,
						DIFFICULTIES,
					),
				})),
		});

		sections.push({
			id: "length",
			title: t("common.filter.length"),
			type: "range",
			minLabel: t("common.filter.lengthMin"),
			maxLabel: t("common.filter.lengthMax"),
			min: minutesText(filters.lengthMinMin),
			max: minutesText(filters.lengthMaxMin),
			onChangeMin: (value) =>
				setFilters((prev) => ({ ...prev, lengthMinMin: parseMinutes(value) })),
			onChangeMax: (value) =>
				setFilters((prev) => ({ ...prev, lengthMaxMin: parseMinutes(value) })),
		});

		return sections;
	}, [t, filters, composers, collections, setFilters]);

	const sortOptions = useMemo(
		() =>
			PIECE_SORTS.map((option) => ({
				key: option.key,
				label: t(`screen.pieces.sort.${option.key}` as Parameters<typeof t>[0]),
			})),
		[t],
	);

	const handleSelectSort = useCallback(
		(key: PieceSortKey) => {
			setSortAnchor(null);
			setPrefs((prev) => {
				const next = nextSort(
					PIECE_SORTS,
					{ key: prev.sortKey, dir: prev.sortDir },
					key,
				);
				return { ...prev, sortKey: next.key, sortDir: next.dir };
			});
		},
		[setPrefs],
	);

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
						{formatComposerLine(item.composer, item.collectionName)}
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

	const libraryEmpty = pieces.length === 0;
	const hiddenBySearch = searchQuery.trim().length > 0;

	const emptyState = (
		<View className="flex-1 items-center justify-center p-8 gap-3">
			<Text
				variant="bodyLarge"
				style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
			>
				{libraryEmpty
					? t("screen.pieces.noPieces")
					: hiddenBySearch
						? t("screen.pieces.noResults")
						: t("screen.pieces.noMatchFilters")}
			</Text>
			{libraryEmpty ? (
				<Button mode="contained" onPress={() => router.push("/piece/add")}>
					{t("screen.pieces.addPiece")}
				</Button>
			) : (
				<Button
					mode="outlined"
					onPress={() => {
						clearFilters();
						setSearchQuery("");
					}}
				>
					{t("common.filter.clearAllFilters")}
				</Button>
			)}
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

			<FilterPillRow
				pills={pillItems}
				onRemove={removePill}
				onClearAll={clearFilters}
				clearAllLabel={t("common.filter.clearAll")}
			/>

			{loading ? (
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator size="large" />
				</View>
			) : visiblePieces.length === 0 ? (
				emptyState
			) : isCompact ? (
				<FlatList
					data={visiblePieces}
					keyExtractor={(item) => item.id ?? ""}
					renderItem={renderCompactItem}
					ItemSeparatorComponent={() => <Divider />}
					style={{ flex: 1 }}
				/>
			) : (
				<ScreenContent
					gap={3}
					paddingTop={0}
					paddingBottom={100}
					style={{ flex: 1 }}
				>
					{visiblePieces.map((item) => (
						<Card
							key={item.id}
							mode="elevated"
							onPress={() => router.push(`/piece/${item.id}`)}
							style={accentBorderStyle(
								pieceStateVisual(item.state, theme.dark),
							)}
						>
							<Card.Title
								title={item.title}
								titleStyle={CARD_TITLE_STYLE}
								subtitle={formatComposerLine(
									item.composer,
									item.collectionName,
								)}
								subtitleStyle={{ color: theme.colors.onSurfaceVariant }}
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
				</ScreenContent>
			)}

			<SortMenu
				anchor={sortAnchor}
				onDismiss={() => setSortAnchor(null)}
				options={sortOptions}
				sortKey={prefs.sortKey}
				sortDir={prefs.sortDir}
				onSelect={handleSelectSort}
			/>

			<FilterSheet
				visible={filterOpen}
				onDismiss={() => setFilterOpen(false)}
				title={t("common.filter.title")}
				sections={filterSections}
				onClearAll={clearFilters}
				clearAllLabel={t("common.filter.clearAll")}
				doneLabel={t("common.done")}
			/>

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
