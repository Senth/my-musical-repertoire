import { useTranslation } from "react-i18next";
import { Chip, useTheme } from "react-native-paper";
import type { TechniqueState } from "@/models/technique";

interface TechniqueStateChipProps {
	state: TechniqueState;
}

export function TechniqueStateChip({ state }: TechniqueStateChipProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const bgColor: Record<TechniqueState, string> = {
		active: theme.colors.secondaryContainer,
		maintenance: theme.colors.primaryContainer,
		retired: theme.colors.surfaceVariant,
	};

	const textColor: Record<TechniqueState, string> = {
		active: theme.colors.onSecondaryContainer,
		maintenance: theme.colors.onPrimaryContainer,
		retired: theme.colors.onSurfaceVariant,
	};

	return (
		<Chip
			compact
			style={{ backgroundColor: bgColor[state], alignSelf: "flex-start" }}
			textStyle={{ color: textColor[state], fontSize: 11 }}
		>
			{t(`technique.state.${state}`)}
		</Chip>
	);
}
