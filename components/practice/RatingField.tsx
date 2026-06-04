import type { ComponentProps } from "react";
import { View } from "react-native";
import { SegmentedButtons, Text } from "react-native-paper";

type Rating = 1 | 2 | 3 | 4 | 5;

interface RatingFieldProps {
	label: string;
	value: Rating;
	onChange: (value: Rating) => void;
	buttons: ComponentProps<typeof SegmentedButtons>["buttons"];
}

/** A titled 1–5 rating selector used for quality/effort on the practice screens. */
export function RatingField({
	label,
	value,
	onChange,
	buttons,
}: RatingFieldProps) {
	return (
		<View className="gap-2">
			<Text variant="titleSmall">{label}</Text>
			<SegmentedButtons
				value={value.toString()}
				onValueChange={(v) => onChange(Number(v) as Rating)}
				buttons={buttons}
			/>
		</View>
	);
}
