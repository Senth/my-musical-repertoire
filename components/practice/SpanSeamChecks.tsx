import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Checkbox, Text, TouchableRipple, useTheme } from "react-native-paper";
import type { SectionState } from "@/models/section";
import { border, radius, space } from "@/theme/tokens";
import { seamBarRange } from "@/utils/span-display";
import { sectionStateVisual } from "@/utils/state-colors";

export interface SeamCheckSection {
	id?: string;
	label: string;
	state: SectionState;
	startBar: number;
	endBar: number;
}

interface SpanSeamChecksProps {
	sections: SeamCheckSection[];
	/** One entry per join, `sections.length - 1` long. */
	checked: boolean[];
	onToggle: (seamIndex: number) => void;
}

const DOT_SIZE = 8;

/**
 * The B1 seam ticks: one set for the whole span, asked once below the
 * per-mode fields. Sections are drawn as context; the join between each pair
 * is the thing being asked about. Every box starts ticked, so the student
 * unticks what broke — the same "say nothing, it went fine" polarity as an
 * untouched Save everywhere else.
 */
export function SpanSeamChecks({
	sections,
	checked,
	onToggle,
}: SpanSeamChecksProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<View
			style={{
				borderTopWidth: border.hairline,
				borderTopColor: theme.colors.outlineVariant,
				paddingTop: space.md,
				gap: space.sm,
			}}
		>
			<Text variant="titleSmall">{t("screen.practice.span.seam.title")}</Text>
			<View>
				{sections.map((section, i) => {
					const visual = sectionStateVisual(section.state, theme.dark);
					const join = sections[i + 1];
					const range = join ? seamBarRange(section, join) : null;
					return (
						<View key={section.id ?? i}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: space.sm,
									paddingVertical: space.xs,
								}}
							>
								<View
									style={{
										width: DOT_SIZE,
										height: DOT_SIZE,
										borderRadius: radius.full,
										backgroundColor: visual.accent,
									}}
								/>
								<Text variant="bodyMedium">{section.label}</Text>
							</View>
							{join && (
								<TouchableRipple
									onPress={() => onToggle(i)}
									accessibilityRole="checkbox"
									accessibilityState={{ checked: checked[i] }}
									accessibilityLabel={t(
										"screen.practice.span.seam.a11yToggle",
										{
											first: section.label,
											second: join.label,
										},
									)}
									style={{ borderRadius: radius.chip }}
								>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: space.sm,
											paddingLeft: space.md,
											paddingVertical: space.xs,
										}}
									>
										<Checkbox.Android
											status={checked[i] ? "checked" : "unchecked"}
										/>
										<View>
											<Text variant="bodyMedium">
												{t("screen.practice.span.seam.joinHeld")}
											</Text>
											{range && (
												<Text
													variant="bodySmall"
													style={{ color: theme.colors.onSurfaceVariant }}
												>
													{t("screen.practice.span.seam.bars", {
														start: range.startBar,
														end: range.endBar,
													})}
												</Text>
											)}
										</View>
									</View>
								</TouchableRipple>
							)}
						</View>
					);
				})}
			</View>
		</View>
	);
}
