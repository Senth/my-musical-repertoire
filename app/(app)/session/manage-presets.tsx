import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
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
import { ScreenContent } from "@/components/ui/ScreenContent";
import {
	useSessionPresetActions,
	useSessionPresets,
} from "@/hooks/use-session-presets";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import {
	presetTotalMinutes,
	type SessionPreset,
} from "@/models/session-preset";

export default function ManagePresetsScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const goBack = useUpNavigation("/(app)/(tabs)/overview");
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

	const move = async (index: number, delta: number) => {
		const next = index + delta;
		if (next < 0 || next >= presets.length) return;
		const ids = presets.map((p) => p.id ?? "");
		[ids[index], ids[next]] = [ids[next], ids[index]];
		await reorderPresets(ids);
	};

	const handleRestore = async () => {
		const restored = await restoreDefaults(presets);
		setNotice(
			restored === 0
				? t("screen.session.manage.nothingToRestore")
				: t("screen.session.manage.restored", { count: restored }),
		);
	};

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={goBack} />
				<Appbar.Content title={t("screen.session.manage.title")} />
			</Appbar.Header>

			{loading ? (
				<LoadingScreen />
			) : (
				<ScreenContent gap={3} paddingBottom={32}>
					{presets.length === 0 && (
						<Text
							variant="bodyMedium"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{t("screen.session.manage.empty")}
						</Text>
					)}

					{/* Reorder stays inline; everything else lives behind the overflow —
					    six trailing icons squeeze the name to nothing on a phone. */}
					{presets.map((preset, index) => (
						<Card key={preset.id} mode="contained">
							<View
								className="flex-row items-center"
								style={{ minHeight: 56, paddingLeft: 16, paddingRight: 4 }}
							>
								<View className="flex-1" style={{ paddingVertical: 8 }}>
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
									icon="arrow-up"
									disabled={index === 0}
									accessibilityLabel={t("screen.session.manage.moveUp")}
									onPress={() => move(index, -1)}
								/>
								<IconButton
									icon="arrow-down"
									disabled={index === presets.length - 1}
									accessibilityLabel={t("screen.session.manage.moveDown")}
									onPress={() => move(index, 1)}
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
					))}

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
				</ScreenContent>
			)}

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
