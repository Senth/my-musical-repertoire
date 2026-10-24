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
	const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
		null,
	);
	const title = catalogTitle(entry, t);
	const exact = match.kind === "exact";

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

	return (
		<View style={{ flexDirection: "row", alignItems: "center" }}>
			{row}
			{menuAnchor && (
				<Menu visible onDismiss={() => setMenuAnchor(null)} anchor={menuAnchor}>
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
								setMenuAnchor(null);
								onAdd(mode);
							}}
						/>
					))}
				</Menu>
			)}
			<IconButton
				icon="plus"
				size={icon.md}
				iconColor={theme.colors.primary}
				disabled={disabled}
				accessibilityLabel={t("technique.catalog.add", { title })}
				onPress={(event) =>
					setMenuAnchor({
						x: event.nativeEvent.pageX,
						y: event.nativeEvent.pageY,
					})
				}
			/>
		</View>
	);
}
