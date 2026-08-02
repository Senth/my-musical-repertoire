import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";
import { StateChip } from "@/components/ui/StateChip";
import type { PieceState } from "@/models/piece";
import { pieceStateVisual } from "@/utils/state-colors";

interface PieceStateChipProps {
	state: PieceState;
}

export function PieceStateChip({ state }: PieceStateChipProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<StateChip
			label={t(`piece.state.${state}`)}
			visual={pieceStateVisual(state, theme.dark)}
		/>
	);
}
