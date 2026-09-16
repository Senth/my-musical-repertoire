import { useRouter } from "expo-router";
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
	Card,
	Dialog,
	IconButton,
	Menu,
	Portal,
	Snackbar,
	Text,
	TextInput,
	useTheme,
} from "react-native-paper";
import { LoadingScreen } from "@/components/ui/CenteredScreen";
import { useIsCompact } from "@/hooks/use-is-compact";
import {
	useSessionPresetActions,
	useSessionPresets,
} from "@/hooks/use-session-presets";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import {
	presetTotalMinutes,
	type SessionPreset,
} from "@/models/session-preset";
import { contentWidth, inset, space } from "@/theme/tokens";

/** The preset row keeps a hand above MD3's touch minimum so the drag handle
 * and both icon buttons stay comfortable in a scrolling list. */
const PRESET_ROW_MIN_HEIGHT = 56;

export default function ManagePresetsScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const goBack = useUpNavigation("/(app)/(tabs)/overview");
	const isCompact = useIsCompact();
	const { presets, loading } = useSessionPresets();
	const {
		addPreset,
		updatePreset,
		deletePreset,
		reorderPresets,
		restoreDefaults,
	} = useSessionPresetActions();

	// Anchored by press coordinates so the Menu can stay unmounted until opened:
	// a mounted-but-closed Paper Menu steals focus on web.
	const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(
		null,
	);
	const [renaming, setRenaming] = useState<SessionPreset | null>(null);
	const [renameText, setRenameText] = useState("");
	const [pendingDelete, setPendingDelete] = useState<SessionPreset | null>(
		null,
	);
	const [notice, setNotice] = useState<string | null>(null);

	const handleDragEnd = useCallback(
		async ({ data }: { data: SessionPreset[] }) => {
			await reorderPresets(data.map((p) => p.id ?? ""));
		},
		[reorderPresets],
	);

	const handleRestore = async () => {
		const restored = await restoreDefaults(presets);
		setNotice(
			restored === 0
				? t("screen.session.manage.nothingToRestore")
				: t("screen.session.manage.restored", { count: restored }),
		);
	};

	const renderPreset = useCallback(
		({ item: preset, drag, isActive }: RenderItemParams<SessionPreset>) => (
			<ScaleDecorator>
				<Card mode="contained" style={{ marginBottom: space.md }}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							minHeight: PRESET_ROW_MIN_HEIGHT,
							paddingLeft: space.lg,
							paddingRight: space.xs,
						}}
					>
						<View style={{ flex: 1, minHeight: 0, paddingVertical: space.sm }}>
							<Text variant="bodyLarge">{preset.name}</Text>
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{t("screen.session.preset.minutes", {
									minutes: presetTotalMinutes(preset.lines),
								})}
							</Text>
						</View>
						<IconButton
							icon="drag"
							size={20}
							disabled={isActive}
							accessibilityLabel={t("a11y.drag.reorder")}
							onLongPress={drag}
							onPressIn={drag}
						/>
						<IconButton
							icon="dots-vertical"
							accessibilityLabel={t("screen.session.preset.rowActions", {
								name: preset.name,
							})}
							onPress={(e) =>
								setMenu({
									id: preset.id ?? "",
									x: e.nativeEvent.pageX,
									y: e.nativeEvent.pageY,
								})
							}
						/>
						{menu !== null && menu.id === preset.id && (
							<Menu
								visible
								onDismiss={() => setMenu(null)}
								anchor={{ x: menu.x, y: menu.y }}
							>
								<Menu.Item
									leadingIcon="pencil"
									title={t("screen.session.preset.edit")}
									onPress={() => {
										setMenu(null);
										router.push(
											`/session/preset-editor?presetId=${preset.id}` as const,
										);
									}}
								/>
								<Menu.Item
									leadingIcon="rename-box"
									title={t("screen.session.manage.rename")}
									onPress={() => {
										setMenu(null);
										setRenameText(preset.name);
										setRenaming(preset);
									}}
								/>
								<Menu.Item
									leadingIcon="content-copy"
									title={t("screen.session.preset.duplicate")}
									onPress={() => {
										setMenu(null);
										addPreset(
											t("screen.session.preset.copyName", {
												name: preset.name,
											}),
											preset.lines,
											preset.order + 1,
										);
									}}
								/>
								<Menu.Item
									leadingIcon="delete"
									title={t("screen.session.preset.delete")}
									onPress={() => {
										setMenu(null);
										setPendingDelete(preset);
									}}
								/>
							</Menu>
						)}
					</View>
				</Card>
			</ScaleDecorator>
		),
		[addPreset, menu, router, t, theme.colors.onSurfaceVariant],
	);

	if (loading) {
		return <LoadingScreen />;
	}

	return (
		<View
			style={{
				flex: 1,
				minHeight: 0,
				backgroundColor: theme.colors.background,
			}}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={goBack} />
				<Appbar.Content title={t("screen.session.manage.title")} />
			</Appbar.Header>

			<GestureHandlerRootView style={{ flex: 1 }}>
				<DraggableFlatList
					data={presets}
					keyExtractor={(preset) => preset.id ?? ""}
					renderItem={renderPreset}
					onDragEnd={handleDragEnd}
					activationDistance={8}
					ListEmptyComponent={
						<Text
							variant="bodyMedium"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{t("screen.session.manage.empty")}
						</Text>
					}
					ListFooterComponent={
						<View style={{ gap: space.md }}>
							<Button
								mode="outlined"
								icon="plus"
								onPress={() => router.push("/session/preset-editor")}
							>
								{t("screen.session.manage.newPreset")}
							</Button>

							<Button mode="text" icon="restore" onPress={handleRestore}>
								{t("screen.session.manage.restore")}
							</Button>
						</View>
					}
					contentContainerStyle={{
						width: "100%",
						maxWidth:
							contentWidth.page + (isCompact ? inset.compact : inset.roomy) * 2,
						alignSelf: "center",
						paddingHorizontal: isCompact ? inset.compact : inset.roomy,
						paddingTop: space.xl,
						paddingBottom: space.xxl,
					}}
				/>
			</GestureHandlerRootView>

			<Portal>
				<Dialog visible={renaming != null} onDismiss={() => setRenaming(null)}>
					<Dialog.Title>{t("screen.session.manage.renameTitle")}</Dialog.Title>
					<Dialog.Content>
						<TextInput
							mode="outlined"
							label={t("screen.session.editor.nameLabel")}
							aria-label={t("screen.session.editor.nameLabel")}
							value={renameText}
							onChangeText={setRenameText}
						/>
					</Dialog.Content>
					<Dialog.Actions>
						<Button onPress={() => setRenaming(null)}>
							{t("screen.session.manage.cancel")}
						</Button>
						<Button
							disabled={!renameText.trim()}
							onPress={async () => {
								const target = renaming;
								setRenaming(null);
								if (target?.id)
									await updatePreset(target.id, { name: renameText.trim() });
							}}
						>
							{t("screen.session.editor.save")}
						</Button>
					</Dialog.Actions>
				</Dialog>

				<Dialog
					visible={pendingDelete != null}
					onDismiss={() => setPendingDelete(null)}
				>
					<Dialog.Title>
						{t("screen.session.manage.deleteTitle", {
							name: pendingDelete?.name ?? "",
						})}
					</Dialog.Title>
					<Dialog.Content>
						<Text variant="bodyMedium">
							{t("screen.session.manage.deleteMessage")}
						</Text>
					</Dialog.Content>
					<Dialog.Actions>
						<Button onPress={() => setPendingDelete(null)}>
							{t("screen.session.manage.cancel")}
						</Button>
						<Button
							onPress={async () => {
								const target = pendingDelete;
								setPendingDelete(null);
								if (target?.id) await deletePreset(target.id);
							}}
						>
							{t("screen.session.manage.confirmDelete")}
						</Button>
					</Dialog.Actions>
				</Dialog>
			</Portal>

			<Snackbar visible={notice != null} onDismiss={() => setNotice(null)}>
				{notice ?? ""}
			</Snackbar>
		</View>
	);
}
