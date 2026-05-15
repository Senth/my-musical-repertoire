import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { IconButton, Menu, Text, useTheme } from "react-native-paper";
import { SectionPhaseChip } from "@/components/section/SectionPhaseChip";
import type { Section } from "@/models/section";

interface SectionListItemProps {
	section: Section;
	onEdit: (section: Section) => void;
	onArchive: (section: Section) => void;
	dragHandle?: React.ReactNode;
}

export function SectionListItem({
	section,
	onEdit,
	onArchive,
	dragHandle,
}: SectionListItemProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const [menuVisible, setMenuVisible] = useState(false);

	const barRangeText = () => {
		if (section.startBar != null && section.endBar != null) {
			return t("screen.pieceSections.barRange", {
				start: section.startBar,
				end: section.endBar,
			});
		}
		if (section.startBar != null) {
			return t("screen.pieceSections.barFrom", { start: section.startBar });
		}
		return null;
	};

	const bpmText =
		section.currentBpm != null
			? t("screen.pieceSections.bpm", { bpm: section.currentBpm })
			: null;

	const metaItems = [barRangeText(), bpmText].filter(Boolean);

	return (
		<View
			className="flex-row items-center py-2 px-4"
			style={{ backgroundColor: theme.colors.surface }}
		>
			{dragHandle}

			<View className="flex-1 gap-1 ml-2">
				<Text variant="bodyLarge">{section.label}</Text>
				<View className="flex-row items-center gap-2 flex-wrap">
					<SectionPhaseChip phase={section.phase} />
					{metaItems.map((item) => (
						<Text
							key={item}
							variant="bodySmall"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{item}
						</Text>
					))}
				</View>
				{section.notes ? (
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
						numberOfLines={1}
					>
						{section.notes}
					</Text>
				) : null}
			</View>

			<Menu
				visible={menuVisible}
				onDismiss={() => setMenuVisible(false)}
				anchor={
					<IconButton
						icon="dots-vertical"
						size={20}
						onPress={() => setMenuVisible(true)}
					/>
				}
			>
				<Menu.Item
					leadingIcon="pencil"
					title={t("screen.pieceSections.menu.edit")}
					onPress={() => {
						setMenuVisible(false);
						onEdit(section);
					}}
				/>
				<Menu.Item
					leadingIcon="archive"
					title={t("screen.pieceSections.menu.archive")}
					onPress={() => {
						setMenuVisible(false);
						onArchive(section);
					}}
				/>
			</Menu>
		</View>
	);
}
