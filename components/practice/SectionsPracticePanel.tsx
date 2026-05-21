import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	Button,
	Checkbox,
	Divider,
	Text,
	TouchableRipple,
	useTheme,
} from "react-native-paper";
import { SectionPhaseChip } from "@/components/section/SectionPhaseChip";
import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";

interface SectionsPracticePanelProps {
	sections: Section[];
	piece: Piece;
	mistakeLevel: "normal" | "checkbox";
	flaggedIds: string[];
	onToggleFlag: (sectionId: string) => void;
	onPractice: (sectionId: string) => void;
}

export function SectionsPracticePanel({
	sections,
	piece,
	mistakeLevel,
	flaggedIds,
	onToggleFlag,
	onPractice,
}: SectionsPracticePanelProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	if (sections.length === 0) return null;

	const isCheckbox = mistakeLevel === "checkbox";
	const headerKey = isCheckbox
		? "screen.practice.sectionsPanel.headerCheckbox"
		: "screen.practice.sectionsPanel.header";

	return (
		<View className="gap-3">
			<Text variant="titleSmall">{t(headerKey)}</Text>
			<Divider />
			{sections.map((section) => {
				const sid = section.id ?? "";
				const checked = flaggedIds.includes(sid);
				const effectiveTarget =
					section.targetBpmOverride ?? piece.targetTempoBpm ?? null;
				const showBpm = section.currentBpm != null || effectiveTarget != null;
				const currentDisplay = section.currentBpm?.toString() ?? "—";
				const targetDisplay = effectiveTarget?.toString() ?? "—";

				const rowContent = (
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 8,
							flex: 1,
							paddingVertical: 4,
						}}
					>
						{isCheckbox && (
							<Checkbox.Android status={checked ? "checked" : "unchecked"} />
						)}
						<View style={{ flex: 1, gap: 4 }}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									flexWrap: "wrap",
									gap: 8,
								}}
							>
								<Text variant="bodyLarge">{section.label}</Text>
								<SectionPhaseChip phase={section.phase} />
								{showBpm && (
									<Text
										variant="bodySmall"
										style={{ color: theme.colors.onSurfaceVariant }}
									>
										{t("screen.practice.sectionsPanel.bpmLine", {
											current: currentDisplay,
											target: targetDisplay,
										})}
									</Text>
								)}
							</View>
							{section.notes ? (
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{section.notes}
								</Text>
							) : null}
						</View>
					</View>
				);

				return (
					<View
						key={sid}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 8,
						}}
					>
						{isCheckbox ? (
							<TouchableRipple
								onPress={() => onToggleFlag(sid)}
								accessibilityLabel={t(
									"screen.practice.sectionsPanel.a11yToggleFlag",
									{ label: section.label },
								)}
								accessibilityRole="checkbox"
								accessibilityState={{ checked }}
								style={{ flex: 1, borderRadius: 8 }}
							>
								{rowContent}
							</TouchableRipple>
						) : (
							rowContent
						)}
						<Button
							mode="outlined"
							onPress={() => onPractice(sid)}
							contentStyle={{ paddingHorizontal: 8 }}
							accessibilityLabel={t(
								"screen.practice.sectionsPanel.a11yPractice",
								{ label: section.label },
							)}
						>
							{t("screen.practice.sectionsPanel.practice")}
						</Button>
					</View>
				);
			})}
		</View>
	);
}
