import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { IconButton, ProgressBar, Text } from "react-native-paper";
import { SectionStateChip } from "@/components/section/SectionStateChip";
import type { Section, SectionState } from "@/models/section";
import { useAppTheme } from "@/theme";
import { icon, opacity, size, space, touchTarget } from "@/theme/tokens";
import { sectionRowFacts } from "@/utils/section-row";

interface SectionRowProps {
	section: Section;
	pieceTargetBpm?: number | null;
	leading?: ReactNode;
	onPress?: () => void;
	pressRole?: "button" | "checkbox";
	pressLabel?: string;
	checked?: boolean;
	onPractice?: () => void;
	onChangeState?: (state: SectionState) => void;
	showProgress?: boolean;
}

export function SectionRow({
	section,
	pieceTargetBpm,
	leading,
	onPress,
	pressRole = "button",
	pressLabel,
	checked,
	onPractice,
	onChangeState,
	showProgress,
}: SectionRowProps) {
	const { t } = useTranslation();
	const theme = useAppTheme();
	const { bars, tempo, lastPracticed, progress } = sectionRowFacts(
		section,
		pieceTargetBpm,
		t,
	);
	const quietText = {
		color: theme.colors.onSurfaceVariant,
		opacity: opacity.quiet,
	};

	return (
		<View style={{ backgroundColor: theme.colors.surface }}>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
			>
				<View
					style={{
						flex: 1,
						minWidth: 0,
						flexDirection: "row",
						alignItems: "center",
					}}
				>
					<Pressable
						onPress={onPress}
						disabled={!onPress}
						accessibilityRole={onPress ? pressRole : undefined}
						accessibilityState={
							pressRole === "checkbox" ? { checked } : undefined
						}
						aria-checked={pressRole === "checkbox" ? checked : undefined}
						accessibilityLabel={pressLabel ?? section.label}
						style={{ position: "absolute", width: "100%", height: "100%" }}
					/>
					<View pointerEvents="box-none">{leading}</View>
					<View
						pointerEvents="box-none"
						style={{
							flex: 1,
							minWidth: 0,
							paddingVertical: space.md,
							paddingHorizontal: space.lg,
							gap: space.xs,
						}}
					>
						<View
							pointerEvents="none"
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								gap: space.sm,
							}}
						>
							<Text
								variant="bodyLarge"
								numberOfLines={1}
								style={{ flexShrink: 1 }}
							>
								{section.label}
							</Text>
							{bars != null && (
								<Text
									variant="bodySmall"
									numberOfLines={1}
									style={{ ...quietText, flexShrink: 0 }}
								>
									{bars}
								</Text>
							)}
						</View>
						<View
							pointerEvents="box-none"
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								gap: space.sm,
							}}
						>
							<View
								pointerEvents="box-none"
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: space.sm,
									flexShrink: 1,
								}}
							>
								<SectionStateChip
									state={section.state}
									onChangeState={onChangeState}
									hitSlop={{
										top: space.xs,
										bottom: section.notes ? space.xs : space.md,
										left: space.lg,
										right: space.sm,
									}}
								/>
								{lastPracticed != null && (
									<Text
										pointerEvents="none"
										variant="bodySmall"
										numberOfLines={1}
										style={quietText}
									>
										{lastPracticed}
									</Text>
								)}
							</View>
							{tempo != null && (
								<Text
									pointerEvents="none"
									variant="bodySmall"
									numberOfLines={1}
									style={{ ...quietText, flexShrink: 0 }}
								>
									{tempo}
								</Text>
							)}
						</View>
						{section.notes ? (
							<Text
								pointerEvents="none"
								variant="bodySmall"
								numberOfLines={2}
								style={quietText}
							>
								{section.notes}
							</Text>
						) : null}
					</View>
				</View>
				{onPractice && (
					<IconButton
						icon="play"
						mode="contained-tonal"
						containerColor={theme.colors.secondaryContainer}
						iconColor={theme.colors.onSecondaryContainer}
						size={icon.md}
						onPress={onPractice}
						accessibilityLabel={t("section.a11yPractice", {
							label: section.label,
						})}
						style={{
							width: touchTarget.minimum,
							height: touchTarget.minimum,
							margin: 0,
							marginRight: space.sm,
						}}
					/>
				)}
			</View>
			{showProgress && progress != null && (
				<ProgressBar
					progress={progress.ratio}
					color={theme.colors[progress.tone]}
					style={{ height: size.track }}
				/>
			)}
		</View>
	);
}
