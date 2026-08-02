import { View } from "react-native";
import { SegmentedButtons, Text, useTheme } from "react-native-paper";

export interface EstimationOption<V extends string | number> {
	value: V;
	/** Sits on the button. Must stay short enough to fit five segments at 320px. */
	short: string;
	/** Spelled out under the row, where there is a whole line to spend. */
	full: string;
}

interface EstimationFieldProps<V extends string | number> {
	label: string;
	/** `null` renders with nothing selected — the student has not rated yet. */
	value: V | null;
	onChange: (value: V) => void;
	/** Ordered worst → best, so the good end is always on the right. */
	options: EstimationOption<V>[];
}

/**
 * One self-estimation row: quality, effort, or a mistake count.
 *
 * All of them share this component so they stay consistent — same geometry,
 * same text-not-numbers labels, and the same rule that the best answer sits on
 * the right. Buttons carry a short word; the line underneath spells the chosen
 * one out in full, which is where the calibration wording lives.
 */
export function EstimationField<V extends string | number>({
	label,
	value,
	onChange,
	options,
}: EstimationFieldProps<V>) {
	const theme = useTheme();
	const selected = options.find((o) => o.value === value);

	return (
		<View className="gap-2">
			<Text variant="titleSmall">{label}</Text>
			<SegmentedButtons
				value={value?.toString() ?? ""}
				onValueChange={(v) => {
					const match = options.find((o) => o.value.toString() === v);
					if (match) onChange(match.value);
				}}
				buttons={options.map((o) => ({
					value: o.value.toString(),
					label: o.short,
					labelStyle: { fontSize: 12, marginHorizontal: 0 },
				}))}
			/>
			{/* Reserved even when unrated, so picking a value does not shift the form. */}
			<Text
				variant="bodySmall"
				style={{ color: theme.colors.onSurfaceVariant, minHeight: 16 }}
			>
				{selected?.full ?? ""}
			</Text>
		</View>
	);
}
