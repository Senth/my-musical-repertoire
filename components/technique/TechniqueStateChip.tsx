import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";
import { StateChip } from "@/components/ui/StateChip";
import type { TechniqueState } from "@/models/technique";
import { techniqueStateVisual } from "@/utils/state-colors";

interface TechniqueStateChipProps {
	state: TechniqueState;
}

export function TechniqueStateChip({ state }: TechniqueStateChipProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<StateChip
			label={t(`technique.state.${state}`)}
			visual={techniqueStateVisual(state, theme.dark)}
		/>
	);
}
