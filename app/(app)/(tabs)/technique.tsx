import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, ScrollView, useWindowDimensions, View } from "react-native";
import {
	Card,
	Chip,
	Divider,
	FAB,
	IconButton,
	List,
	Menu,
	Snackbar,
	Text,
	useTheme,
} from "react-native-paper";
import { DeleteTechniqueDialog } from "@/components/technique/DeleteTechniqueDialog";
import { TechniqueStateChip } from "@/components/technique/TechniqueStateChip";
import { useDeleteTechnique, useTechniques } from "@/hooks/use-techniques";
import type { TechniqueItem } from "@/models/technique";
import { formatDaysAgo } from "@/utils/date";

const MD3_MEDIUM_BREAKPOINT = 600;
type ContextMenu = { techniqueId: string; x: number; y: number };

export default function TechniquesScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { techniques } = useTechniques();
	const { deleteTechnique } = useDeleteTechnique();
	const [menuVisible, setMenuVisible] = useState<string | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
	const [deletingItem, setDeletingItem] = useState<TechniqueItem | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [showRetired, setShowRetired] = useState(false);
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

	const visibleTechniques = useMemo(
		() =>
			showRetired
				? techniques
				: techniques.filter((t) => t.state !== "retired"),
		[techniques, showRetired],
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

	const renderCardMenu = (item: TechniqueItem) => (
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
					router.push(`/technique/${item.id}/edit`);
				}}
				title={t("screen.techniques.menu.edit")}
			/>
			<Menu.Item
				leadingIcon="delete"
				onPress={() => {
					setMenuVisible(null);
					setDeletingItem(item);
				}}
				title={t("screen.techniques.menu.delete")}
			/>
		</Menu>
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
				<View className="justify-center">
					<IconButton
						icon="dots-vertical"
						size={20}
						onPress={() =>
							setMenuVisible(menuVisible === item.id ? null : (item.id ?? null))
						}
					/>
					{menuVisible === item.id && (
						<Menu
							visible
							onDismiss={() => setMenuVisible(null)}
							anchor={{ x: 0, y: 0 }}
						>
							<Menu.Item
								leadingIcon="pencil"
								onPress={() => {
									setMenuVisible(null);
									router.push(`/technique/${item.id}/edit`);
								}}
								title={t("screen.techniques.menu.edit")}
							/>
							<Menu.Item
								leadingIcon="delete"
								onPress={() => {
									setMenuVisible(null);
									setDeletingItem(item);
								}}
								title={t("screen.techniques.menu.delete")}
							/>
						</Menu>
					)}
				</View>
			)}
			onPress={() => router.push(`/technique/${item.id}/edit`)}
			onLongPress={(e) =>
				setContextMenu({
					techniqueId: item.id ?? "",
					x: e.nativeEvent.pageX,
					y: e.nativeEvent.pageY,
				})
			}
		/>
	);

	const emptyState = (
		<View className="flex-1 items-center justify-center p-8">
			<Text
				variant="bodyLarge"
				style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
			>
				{t("screen.techniques.noResults")}
			</Text>
		</View>
	);

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
				<Text variant="headlineSmall">{t("screen.techniques.title")}</Text>
				<Chip
					compact
					onPress={() => setShowRetired((v) => !v)}
					selected={showRetired}
				>
					{showRetired
						? t("screen.techniques.hideRetired")
						: t("screen.techniques.showRetired")}
				</Chip>
			</View>

			{visibleTechniques.length === 0 ? (
				emptyState
			) : isCompact ? (
				<FlatList
					data={visibleTechniques}
					keyExtractor={(item) => item.id ?? ""}
					renderItem={renderCompactItem}
					ItemSeparatorComponent={() => <Divider />}
				/>
			) : (
				<ScrollView>
					<View
						className="w-full max-w-xl self-center gap-3"
						style={{ paddingHorizontal: 24, paddingBottom: 100 }}
					>
						{visibleTechniques.map((item) => (
							<Card
								key={item.id}
								mode="elevated"
								onPress={() => router.push(`/technique/${item.id}/edit`)}
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
						const id = contextMenu?.techniqueId;
						setContextMenu(null);
						if (id) router.push(`/technique/${id}/edit`);
					}}
					title={t("screen.techniques.menu.edit")}
				/>
				<Menu.Item
					leadingIcon="delete"
					onPress={() => {
						const item = techniques.find(
							(t) => t.id === contextMenu?.techniqueId,
						);
						setContextMenu(null);
						if (item) setDeletingItem(item);
					}}
					title={t("screen.techniques.menu.delete")}
				/>
			</Menu>

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
				action={{ label: "OK", onPress: () => setDeleteError(null) }}
			>
				{deleteError ?? ""}
			</Snackbar>

			<FAB
				icon="plus"
				style={{ position: "absolute", margin: 16, right: 0, bottom: 0 }}
				onPress={() => router.push("/technique/add")}
			/>
		</View>
	);
}
