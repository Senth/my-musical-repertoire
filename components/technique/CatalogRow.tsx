import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";
import { IconButton, List, Menu, Text, useTheme } from "react-native-paper";
import { TechniqueStateChip } from "@/components/technique/TechniqueStateChip";
import { usePageInset } from "@/hooks/use-page-inset";
import { contentWidth, icon, space } from "@/theme/tokens";
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
	const { width } = useWindowDimensions();
	const [menuVisible, setMenuVisible] = useState(false);
	const title = catalogTitle(entry, t);
	const exact = match.kind === "exact";

	return (
		<List.Item
			title={title}
			titleNumberOfLines={1}
			titleStyle={exact ? { color: theme.colors.onSurfaceVariant } : undefined}
			style={{ paddingHorizontal: pageInset - space.sm }}
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
			right={(props) =>
				exact ? (
					<List.Icon {...props} icon="check" color={theme.colors.outline} />
				) : (
					<Menu
						visible={menuVisible}
						onDismiss={() => setMenuVisible(false)}
						anchor={
							<IconButton
								icon="plus"
								size={icon.md}
								iconColor={theme.colors.primary}
								disabled={disabled}
								accessibilityLabel={t("technique.catalog.add", { title })}
								onPress={() => setMenuVisible(true)}
							/>
						}
					>
						{(["start", "later"] as const).map((mode) => (
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
								style={{
									width: Math.min(contentWidth.form, width - pageInset * 2),
								}}
								left={(props) => (
									<List.Icon
										{...props}
										icon={
											mode === "start" ? "play-circle-outline" : "clock-outline"
										}
									/>
								)}
								accessibilityRole="menuitem"
								onPress={() => {
									setMenuVisible(false);
									onAdd(mode);
								}}
							/>
						))}
					</Menu>
				)
			}
		/>
	);
}
