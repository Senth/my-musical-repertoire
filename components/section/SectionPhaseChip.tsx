import { useTranslation } from "react-i18next";
import { Chip, useTheme } from "react-native-paper";
import type { SectionPhase } from "@/models/section";

interface SectionPhaseChipProps {
	phase: SectionPhase;
}

export function SectionPhaseChip({ phase }: SectionPhaseChipProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const bgColor: Record<SectionPhase, string> = {
		learning: theme.colors.secondaryContainer,
		stabilizing: theme.colors.tertiaryContainer,
		maintenance: theme.colors.primaryContainer,
	};

	const textColor: Record<SectionPhase, string> = {
		learning: theme.colors.onSecondaryContainer,
		stabilizing: theme.colors.onTertiaryContainer,
		maintenance: theme.colors.onPrimaryContainer,
	};

	return (
		<Chip
			compact
			style={{ backgroundColor: bgColor[phase], alignSelf: "flex-start" }}
			textStyle={{ color: textColor[phase], fontSize: 11 }}
		>
			{t(`section.phase.${phase}`)}
		</Chip>
	);
}
