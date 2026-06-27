import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { StateFilterDropdown } from "@/components/ui/StateFilterDropdown";
import { useFabStyleTabs } from "@/hooks/use-fab-style";
import { useFabVisible } from "@/hooks/use-fab-visible";
import { useIsCompact } from "@/hooks/use-is-compact";
import { useDeleteTechnique, useTechniques } from "@/hooks/use-techniques";
import {
	TECHNIQUE_STATES,
	type TechniqueItem,
	type TechniqueState,
} from "@/models/technique";
import { formatDaysAgo } from "@/utils/date";

type StateFilter = TechniqueState | "all";
type ContextMenu = { techniqueId: string; x: number; y: number };

export default function TechniquesScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
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
	const [stateFilter, setStateFilter] = useState<StateFilter>("all");
	const isCompact = useIsCompact();

	const visibleTechniques = useMemo(() => {
		let result = techniques;
		if (stateFilter !== "all") {
			result = result.filter((item) => item.state === stateFilter);
		} else {
			// By default hide retired unless explicitly selected
			result = result.filter((item) => item.state !== "retired");
		}
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter((item) =>
				item.title.toLowerCase().includes(query),
			);
		}
		return result;
	}, [techniques, stateFilter, searchQuery]);

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

	const noTechniquesAtAll = techniques.length === 0;
	const filterHidesAll = !noTechniquesAtAll && visibleTechniques.length === 0;

	const emptyState = (
		<View className="flex-1 items-center justify-center p-8 gap-3">
			<Text
				variant="bodyLarge"
				style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
			>
				{noTechniquesAtAll
					? t("screen.techniques.noTechniques")
					: filterHidesAll
						? t("screen.techniques.noTechniquesMatchFilter")
						: t("screen.techniques.noResults")}
			</Text>
			{noTechniquesAtAll ? (
				<Button mode="contained" onPress={() => router.push("/technique/add")}>
					{t("screen.techniques.addTechnique")}
				</Button>
			) : filterHidesAll ? (
				<Button
					mode="outlined"
					onPress={() => {
						setStateFilter("all");
						setSearchQuery("");
					}}
				>
					{t("screen.techniques.showAll")}
				</Button>
			) : null}
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

			<StateFilterDropdown
				states={TECHNIQUE_STATES}
				selected={stateFilter}
				onSelect={setStateFilter}
				labelFor={(s) => t(`technique.state.${s}` as Parameters<typeof t>[0])}
				statusLabel={t("common.filterStatus")}
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
