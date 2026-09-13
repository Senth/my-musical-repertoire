import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, useTheme } from "react-native-paper";
import { useIsCompact } from "@/hooks/use-is-compact";
import { border, contentWidth } from "@/theme/tokens";

interface PracticeFooterProps {
	primaryLabel: string;
	onPrimary: () => void;
	primaryLoading?: boolean;
	/** Block controls — the coach passes them; a standalone screen has no block. */
	onSkip?: () => void;
	onExtend?: () => void;
}

/**
 * Pinned footer. In the coach: `Skip · +2 min · Save & next`; standalone:
 * `Save` alone. The band inside matches `ScreenContent`'s centred `max-w-xl`,
 * so the footer never stretches wider than the form above it.
 */
export function PracticeFooter({
	primaryLabel,
	onPrimary,
	primaryLoading,
	onSkip,
	onExtend,
}: PracticeFooterProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const isCompact = useIsCompact();

	return (
		<View
			style={{
				borderTopWidth: border.hairline,
				borderTopColor: theme.colors.outlineVariant,
				backgroundColor: theme.colors.background,
				paddingHorizontal: isCompact ? 16 : 24,
				paddingVertical: 10,
			}}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 10,
					width: "100%",
					maxWidth: contentWidth.page,
					alignSelf: "center",
				}}
			>
				{onSkip && (
					<Button mode="contained-tonal" onPress={onSkip}>
						{t("screen.session.coach.skip")}
					</Button>
				)}
				{onExtend && (
					<Button mode="contained-tonal" onPress={onExtend}>
						{t("screen.session.coach.extend")}
					</Button>
				)}
				<View style={{ flex: 1 }}>
					<Button
						mode="contained"
						onPress={onPrimary}
						loading={primaryLoading}
						disabled={primaryLoading}
					>
						{primaryLabel}
					</Button>
				</View>
			</View>
		</View>
	);
}
