import { useTranslation } from "react-i18next";
import { Chip, useTheme } from "react-native-paper";
import type { PieceState } from "@/models/piece";

interface PieceStateChipProps {
	state: PieceState;
}

export function PieceStateChip({ state }: PieceStateChipProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const bgColor: Record<PieceState, string> = {
		learning: theme.colors.secondaryContainer,
		stabilizing: theme.colors.tertiaryContainer,
		maintenance: theme.colors.primaryContainer,
		performance: theme.colors.errorContainer,
		on_hold: theme.colors.surfaceVariant,
		shelved: theme.colors.surfaceVariant,
	};

	const textColor: Record<PieceState, string> = {
		learning: theme.colors.onSecondaryContainer,
		stabilizing: theme.colors.onTertiaryContainer,
		maintenance: theme.colors.onPrimaryContainer,
		performance: theme.colors.onErrorContainer,
		on_hold: theme.colors.onSurfaceVariant,
		shelved: theme.colors.onSurfaceVariant,
	};

	return (
		<Chip
			compact
			style={{ backgroundColor: bgColor[state], alignSelf: "flex-start" }}
			textStyle={{ color: textColor[state], fontSize: 11 }}
		>
			{t(`piece.state.${state}`)}
		</Chip>
	);
}
