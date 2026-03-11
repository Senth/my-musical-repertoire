import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { RadioButton, Text } from "react-native-paper";
import { PracticeMistakes } from "@/models/practice";

const MISTAKE_OPTIONS = [
	{
		value: PracticeMistakes.none,
		labelKey: "screen.practice.mistakeLevel.none",
	},
	{ value: PracticeMistakes.few, labelKey: "screen.practice.mistakeLevel.few" },
	{
		value: PracticeMistakes.some,
		labelKey: "screen.practice.mistakeLevel.some",
	},
	{
		value: PracticeMistakes.many,
		labelKey: "screen.practice.mistakeLevel.many",
	},
	{
		value: PracticeMistakes.everywhere,
		labelKey: "screen.practice.mistakeLevel.everywhere",
	},
];

interface MistakeRadioGroupProps {
	label: string;
	value: PracticeMistakes;
	onChange: (value: PracticeMistakes) => void;
}

export function MistakeRadioGroup({
	label,
	value,
	onChange,
}: MistakeRadioGroupProps) {
	const { t } = useTranslation();

	return (
		<View className="gap-1">
			<Text variant="titleSmall">{label}</Text>
			<RadioButton.Group
				value={String(value)}
				onValueChange={(v) => onChange(Number(v) as PracticeMistakes)}
			>
				{MISTAKE_OPTIONS.map((option) => (
					<RadioButton.Item
						key={option.value}
						label={t(option.labelKey)}
						value={String(option.value)}
						mode="android"
						position="leading"
						style={{ paddingVertical: 2 }}
						labelStyle={{ textAlign: "left" }}
					/>
				))}
			</RadioButton.Group>
		</View>
	);
}
