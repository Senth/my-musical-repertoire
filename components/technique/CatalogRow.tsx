import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Platform,
	Pressable,
	ScrollView,
	useWindowDimensions,
	View,
	type ViewInstance,
} from "react-native";
import {
	IconButton,
	List,
	Menu,
	Portal,
	Surface,
	Text,
	useTheme,
} from "react-native-paper";
import { TechniqueStateChip } from "@/components/technique/TechniqueStateChip";
import { usePageInset } from "@/hooks/use-page-inset";
import { contentWidth, elevation, icon, radius, space } from "@/theme/tokens";
import {
	catalogTitle,
	type TechniqueCatalogEntry,
} from "@/utils/technique-catalog";
import type { TechniqueCatalogMode } from "@/utils/technique-catalog-writes";
import type { TechniqueCatalogMatch } from "@/utils/technique-match";

interface CatalogRowProps {
	entry: TechniqueCatalogEntry;
	match: TechniqueCatalogMatch;
	disabled: boolean;
	onAdd: (mode: TechniqueCatalogMode) => void;
}

export function CatalogRow({ entry, match, disabled, onAdd }: CatalogRowProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const pageInset = usePageInset();
	const { height, width } = useWindowDimensions();
	const [menuVisible, setMenuVisible] = useState(false);
	const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
		null,
	);
	const addButtonRef = useRef<View & ViewInstance>(null);
	const title = catalogTitle(entry, t);
	const addButtonId = `technique-catalog-add-${entry.key}`;
	const menuId = `technique-catalog-menu-${entry.key}`;
	const exact = match.kind === "exact";
	const openMenu = useCallback(() => {
		if (Platform.OS === "web") {
			addButtonRef.current?.measureInWindow((x, y, buttonWidth, buttonHeight) =>
				setMenuAnchor({ x: x + buttonWidth, y: y + buttonHeight }),
			);
		} else {
			setMenuVisible(true);
		}
	}, []);
	const dismissMenu = useCallback(
		(restoreFocus = false) => {
			setMenuVisible(false);
			setMenuAnchor(null);
			if (restoreFocus && Platform.OS === "web") {
				requestAnimationFrame(() =>
					document.getElementById(addButtonId)?.focus(),
				);
			}
		},
		[addButtonId],
	);
	const addButton = useMemo(
		() => (
			<IconButton
				ref={addButtonRef}
				icon="plus"
				size={icon.md}
				iconColor={theme.colors.primary}
				disabled={disabled}
				nativeID={addButtonId}
				accessibilityLabel={t("technique.catalog.add", { title })}
				onPress={openMenu}
			/>
		),
		[addButtonId, disabled, openMenu, t, theme.colors.primary, title],
	);

	useEffect(() => {
		if (!menuAnchor || Platform.OS !== "web") return;
		const frame = requestAnimationFrame(() =>
			document
				.getElementById(menuId)
				?.querySelector<HTMLElement>('[role="menuitem"]')
				?.focus(),
		);
		return () => cancelAnimationFrame(frame);
	}, [menuAnchor, menuId]);
	useEffect(() => {
		if (!menuAnchor) return;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			dismissMenu(true);
		};
		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [dismissMenu, menuAnchor]);

	const row = (
		<List.Item
			title={title}
			titleNumberOfLines={1}
			titleStyle={exact ? { color: theme.colors.onSurfaceVariant } : undefined}
			style={{
				flex: exact ? undefined : 1,
				paddingHorizontal: pageInset - space.sm,
				paddingRight: exact ? pageInset - space.sm : 0,
			}}
			description={
				match.kind === "none"
					? undefined
					: () => (
							<View
								style={{
									flexDirection: "row",
									flexWrap: "wrap",
									alignItems: "center",
									gap: space.sm,
									marginTop: space.xs,
								}}
							>
								{exact && match.technique && (
									<TechniqueStateChip state={match.technique.state} />
								)}
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{exact
										? t("technique.catalog.inYourList")
										: t("technique.catalog.nearMatch", {
												title: match.technique?.title,
											})}
								</Text>
							</View>
						)
			}
			right={
				exact
					? (props) => (
							<List.Icon {...props} icon="check" color={theme.colors.outline} />
						)
					: undefined
			}
		/>
	);
	if (exact) return row;
	const menuWidth = Math.min(contentWidth.form, width - pageInset * 2);
	const menuMaxHeight = Math.min(space.xxl * 8, height - space.sm * 2);
	const menuItems = (["start", "later"] as const).map((mode) => (
		<List.Item
			key={mode}
			title={t(`technique.catalog.menu.${mode}`)}
			description={t(`technique.catalog.menu.${mode}Hint`)}
			titleNumberOfLines={2}
			descriptionNumberOfLines={3}
			descriptionStyle={{
				...theme.fonts.bodySmall,
				color: theme.colors.onSurfaceVariant,
			}}
			style={{ width: menuWidth }}
			left={(props) => (
				<List.Icon
					{...props}
					icon={mode === "start" ? "play-circle-outline" : "clock-outline"}
				/>
			)}
			accessibilityRole="menuitem"
			onPress={() => {
				dismissMenu();
				onAdd(mode);
			}}
		/>
	));

	return (
		<View style={{ flexDirection: "row", alignItems: "center" }}>
			{row}
			{Platform.OS === "web" ? (
				<>
					{addButton}
					{menuAnchor && (
						<Portal>
							<Pressable
								accessible={false}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									bottom: 0,
								}}
								onPress={() => dismissMenu(true)}
							/>
							<View
								nativeID={menuId}
								accessibilityRole="menu"
								accessibilityLabel={t("technique.catalog.add", { title })}
								style={{
									position: "absolute",
									left: Math.max(
										pageInset,
										Math.min(
											menuAnchor.x - menuWidth,
											width - pageInset - menuWidth,
										),
									),
									...(menuAnchor.y + menuMaxHeight + space.sm > height
										? { bottom: height - menuAnchor.y }
										: { top: menuAnchor.y }),
								}}
							>
								<Surface
									elevation={elevation.level2}
									style={{
										maxHeight: menuMaxHeight,
										borderRadius: radius.card,
									}}
								>
									<ScrollView style={{ maxHeight: menuMaxHeight }}>
										{menuItems}
									</ScrollView>
								</Surface>
							</View>
						</Portal>
					)}
				</>
			) : (
				<Menu visible={menuVisible} onDismiss={dismissMenu} anchor={addButton}>
					{menuItems}
				</Menu>
			)}
		</View>
	);
}
