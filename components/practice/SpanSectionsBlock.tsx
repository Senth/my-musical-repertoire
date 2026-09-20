import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";
import type { SectionState } from "@/models/section";
import { icon, radius, space } from "@/theme/tokens";
import { sectionStateVisual, withAlpha } from "@/utils/state-colors";

export interface SpanChipSection {
	id?: string;
	label: string;
	state: SectionState;
	startBar: number;
	endBar: number;
}

interface SpanSectionsBlockProps {
	sections: SpanChipSection[];
}

/**
 * The E1 chips block: one section per line unconditionally, so the block's
 * height never changes with label length. Bars sit inside the chip, and the
 * arrow trails every line but the last — the only thing saying these are
 * played in sequence.
 */
export function SpanSectionsBlock({ sections }: SpanSectionsBlockProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<View style={{ gap: space.xs, alignItems: "flex-start" }}>
			{sections.map((section, i) => {
				const visual = sectionStateVisual(section.state, theme.dark);
				return (
					<View
						key={section.id ?? i}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: space.sm,
							maxWidth: "100%",
						}}
					>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: space.xs,
								flexShrink: 1,
								paddingVertical: space.xs,
								paddingHorizontal: space.sm,
								borderRadius: radius.chip,
								backgroundColor: visual.outlined
									? "transparent"
									: withAlpha(visual.accent, visual.tint),
								borderColor: visual.outlined
									? theme.colors.outlineVariant
									: "transparent",
								borderWidth: visual.outlined ? 1 : 0,
							}}
						>
							<Text
								variant="bodySmall"
								numberOfLines={1}
								style={{ color: visual.accent, flexShrink: 1 }}
							>
								{section.label}
							</Text>
							<Text
								variant="labelSmall"
								numberOfLines={1}
								style={{
									color: visual.accent,
									opacity: 0.75,
									flexShrink: 0,
								}}
							>
								{t("screen.practice.span.chip.bars", {
									start: section.startBar,
									end: section.endBar,
								})}
							</Text>
						</View>
						{i < sections.length - 1 && (
							<Icon
								source="arrow-right"
								size={icon.sm}
								color={theme.colors.onSurfaceVariant}
							/>
						)}
					</View>
				);
			})}
		</View>
	);
}
