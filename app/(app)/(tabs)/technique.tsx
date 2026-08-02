import { useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, View } from "react-native";
import {
	ActivityIndicator,
	Button,
	Card,
	Chip,
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
import { DeleteTechniqueDialog } from "@/components/technique/DeleteTechniqueDialog";
import { TechniqueStateChip } from "@/components/technique/TechniqueStateChip";
import { FilterPillRow } from "@/components/ui/FilterPillRow";
import {
	FilterSheet,
	type FilterSheetSection,
} from "@/components/ui/FilterSheet";
import { ListHeaderActions } from "@/components/ui/ListHeaderActions";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { SortMenu } from "@/components/ui/SortMenu";
import { useFabStyleTabs } from "@/hooks/use-fab-style";
import { useFabVisible } from "@/hooks/use-fab-visible";
import { useIsCompact } from "@/hooks/use-is-compact";
import { useListPrefs } from "@/hooks/use-list-prefs";
import { useDeleteTechnique, useTechniques } from "@/hooks/use-techniques";
import {
	TECHNIQUE_STATES,
	TECHNIQUE_TYPES,
	type TechniqueItem,
} from "@/models/technique";
import { formatDaysAgo } from "@/utils/date";
import {
	DEFAULT_TECHNIQUE_FILTERS,
	filterTechniques,
	hasNonDefaultTechniqueFilters,
	removeTechniquePill,
	searchTechniques,
	type TechniqueFilterPill,
	techniquePills,
	toggleValue,
} from "@/utils/list-filtering";
import { DEFAULT_TECHNIQUE_LIST_PREFS } from "@/utils/list-prefs";
import {
	nextSort,
	sortTechniqueItems,
	TECHNIQUE_SORTS,
	type TechniqueSortKey,
} from "@/utils/list-sorting";
import { scoreTechnique } from "@/utils/planner-scoring";
import {
	readTechniqueListPrefs,
	writeTechniqueListPrefs,
} from "@/utils/session-storage";

type ContextMenu = { techniqueId: string; x: number; y: number };

export default function TechniquesScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const navigation = useNavigation();
	const { techniques, loading } = useTechniques();
	const { deleteTechnique } = useDeleteTechnique();
	const fabStyle = useFabStyleTabs();
	const fabVisible = useFabVisible();
	const [menuVisible, setMenuVisible] = useState<string | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
	const [deletingItem, setDeletingItem] = useState<TechniqueItem | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [sortAnchor, setSortAnchor] = useState<{ x: number; y: number } | null>(
		null,
	);
	const [filterOpen, setFilterOpen] = useState(false);
	const isCompact = useIsCompact();

	const { prefs, setPrefs } = useListPrefs(
		DEFAULT_TECHNIQUE_LIST_PREFS,
		readTechniqueListPrefs,
		writeTechniqueListPrefs,
	);
	const { filters } = prefs;
	const filtersActive = hasNonDefaultTechniqueFilters(filters);

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

	// Technique scores need no section data, so they are cheap to derive here.
	const scores = useMemo(() => {
		const now = new Date();
		const result: Record<string, number> = {};
		for (const item of techniques) {
			if (item.id) result[item.id] = scoreTechnique(item, now);
		}
		return result;
	}, [techniques]);

	const visibleTechniques = useMemo(() => {
		const matched = filterTechniques(
			searchTechniques(techniques, searchQuery),
			filters,
		);
		return sortTechniqueItems(
			matched,
			{ key: prefs.sortKey, dir: prefs.sortDir },
			scores,
		);
	}, [techniques, searchQuery, filters, prefs.sortKey, prefs.sortDir, scores]);

	const pillLabel = useCallback(
		(pill: TechniqueFilterPill): string =>
			pill.kind === "state"
				? t(`technique.state.${pill.value}` as Parameters<typeof t>[0])
				: t(`technique.type.${pill.value}` as Parameters<typeof t>[0]),
		[t],
	);

	const pills = useMemo(() => techniquePills(filters), [filters]);
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
			setFilters((prev) => removeTechniquePill(prev, pill));
		},
		[pills, setFilters],
	);

	const clearFilters = useCallback(() => {
		setFilters(() => DEFAULT_TECHNIQUE_FILTERS);
	}, [setFilters]);

	const filterSections = useMemo(
		(): FilterSheetSection[] => [
			{
				id: "status",
				title: t("common.filter.status"),
				type: "multi",
				options: TECHNIQUE_STATES.map((state) => ({
					value: state,
					label: t(`technique.state.${state}` as Parameters<typeof t>[0]),
				})),
				selected: filters.states,
				onToggle: (value) =>
					setFilters((prev) => ({
						...prev,
						states: toggleValue(
							prev.states,
							value as (typeof TECHNIQUE_STATES)[number],
							TECHNIQUE_STATES,
						),
					})),
			},
			{
				id: "type",
				title: t("common.filter.type"),
				type: "multi",
				options: TECHNIQUE_TYPES.map((type) => ({
					value: type,
					label: t(`technique.type.${type}` as Parameters<typeof t>[0]),
				})),
				selected: filters.types,
				onToggle: (value) =>
					setFilters((prev) => ({
						...prev,
						types: toggleValue(
							prev.types,
							value as (typeof TECHNIQUE_TYPES)[number],
							TECHNIQUE_TYPES,
						),
					})),
			},
		],
		[t, filters, setFilters],
	);

	const sortOptions = useMemo(
		() =>
			TECHNIQUE_SORTS.map((option) => ({
				key: option.key,
				label: t(
					`screen.techniques.sort.${option.key}` as Parameters<typeof t>[0],
				),
			})),
		[t],
	);

	const handleSelectSort = useCallback(
		(key: TechniqueSortKey) => {
			setSortAnchor(null);
			setPrefs((prev) => {
				const next = nextSort(
					TECHNIQUE_SORTS,
					{ key: prev.sortKey, dir: prev.sortDir },
					key,
				);
				return { ...prev, sortKey: next.key, sortDir: next.dir };
			});
		},
		[setPrefs],
	);

	const handleDelete = async () => {
		if (!deletingItem?.id) return;
		setDeleteLoading(true);
		try {
			await deleteTechnique(deletingItem.id);
			setDeletingItem(null);
		} catch {
			setDeletingItem(null);
			setDeleteError(t("error.deleteTechnique"));
		} finally {
			setDeleteLoading(false);
		}
	};

	const techniqueMenuLabels = {
		practice: t("screen.techniques.menu.practice"),
		edit: t("screen.techniques.menu.edit"),
		delete: t("screen.techniques.menu.delete"),
	};

	const renderCardMenu = (item: TechniqueItem) => (
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
				router.push(`/technique/${item.id}/practice?from=techniques`);
			}}
			onEdit={() => {
				setMenuVisible(null);
				router.push(`/technique/${item.id}/edit`);
			}}
			onDelete={() => {
				setMenuVisible(null);
				setDeletingItem(item);
			}}
			labels={techniqueMenuLabels}
		/>
	);

	const renderCompactItem = ({ item }: { item: TechniqueItem }) => (
		<List.Item
			title={item.title}
			description={() => (
				<View className="gap-1 mt-1">
					<View className="flex-row items-center gap-2 flex-wrap">
						<TechniqueStateChip state={item.state} />
						{item.type && (
							<Chip compact textStyle={{ fontSize: 11 }}>
								{t(`technique.type.${item.type}`)}
							</Chip>
						)}
						<Text
							variant="bodySmall"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{formatDaysAgo(item.lastPracticedAt, t)}
						</Text>
					</View>
				</View>
			)}
			right={() => (
				<View className="justify-center">{renderCardMenu(item)}</View>
			)}
			onPress={() => router.push(`/technique/${item.id}`)}
			onLongPress={(e) =>
				setContextMenu({
					techniqueId: item.id ?? "",
					x: e.nativeEvent.pageX,
					y: e.nativeEvent.pageY,
				})
			}
		/>
	);

	const libraryEmpty = techniques.length === 0;
	const hiddenBySearch = searchQuery.trim().length > 0;

	const emptyState = (
		<View className="flex-1 items-center justify-center p-8 gap-3">
			<Text
				variant="bodyLarge"
				style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
			>
				{libraryEmpty
					? t("screen.techniques.noTechniques")
					: hiddenBySearch
						? t("screen.techniques.noResults")
						: t("screen.techniques.noMatchFilters")}
			</Text>
			{libraryEmpty ? (
				<Button mode="contained" onPress={() => router.push("/technique/add")}>
					{t("screen.techniques.addTechnique")}
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
					placeholder={t("screen.techniques.searchPlaceholder")}
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
			) : visibleTechniques.length === 0 ? (
				emptyState
			) : isCompact ? (
				<FlatList
					data={visibleTechniques}
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
					{visibleTechniques.map((item) => (
						<Card
							key={item.id}
							mode="elevated"
							onPress={() => router.push(`/technique/${item.id}`)}
						>
							<Card.Title
								title={item.title}
								right={() => renderCardMenu(item)}
							/>
							<Card.Content>
								<View className="gap-2">
									<View className="flex-row items-center gap-2 flex-wrap">
										<TechniqueStateChip state={item.state} />
										{item.type && (
											<Chip compact textStyle={{ fontSize: 11 }}>
												{t(`technique.type.${item.type}`)}
											</Chip>
										)}
									</View>
									<Text
										variant="bodySmall"
										style={{ color: theme.colors.onSurfaceVariant }}
									>
										{formatDaysAgo(item.lastPracticedAt, t)}
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
					const id = contextMenu?.techniqueId;
					setContextMenu(null);
					if (id) router.push(`/technique/${id}/practice?from=techniques`);
				}}
				onEdit={() => {
					const id = contextMenu?.techniqueId;
					setContextMenu(null);
					if (id) router.push(`/technique/${id}/edit`);
				}}
				onDelete={() => {
					const item = techniques.find(
						(tn) => tn.id === contextMenu?.techniqueId,
					);
					setContextMenu(null);
					if (item) setDeletingItem(item);
				}}
				labels={techniqueMenuLabels}
			/>

			<DeleteTechniqueDialog
				visible={deletingItem !== null}
				techniqueName={deletingItem?.title ?? ""}
				loading={deleteLoading}
				onConfirm={handleDelete}
				onDismiss={() => setDeletingItem(null)}
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
						accessibilityLabel={t("a11y.fab.addTechnique")}
						style={fabStyle}
						onPress={() => router.push("/technique/add")}
					/>
				</Portal>
			)}
		</View>
	);
}
