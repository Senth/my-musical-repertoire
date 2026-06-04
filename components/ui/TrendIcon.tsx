import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";

interface TrendIconProps {
	/** Positive = improvement (up), negative = regression (down), 0 = unchanged. */
	diff: number;
	/** When false, renders nothing (e.g. no previous value to compare against). */
	visible?: boolean;
}

/** Up/down/flat arrow coloured by direction, used in the practice comparison rows. */
export function TrendIcon({ diff, visible = true }: TrendIconProps) {
	const theme = useTheme();
	if (!visible) return null;

	const improved = diff > 0;
	const regressed = diff < 0;
	const name = improved ? "arrow-up" : regressed ? "arrow-down" : "minus";
	const color = improved
		? theme.colors.tertiary
		: regressed
			? theme.colors.error
			: theme.colors.onSurfaceVariant;

	return <MaterialCommunityIcons name={name} size={20} color={color} />;
}
