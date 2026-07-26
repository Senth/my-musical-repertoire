import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Checkbox, RadioButton, Text, useTheme } from "react-native-paper";
import {
	PRACTICE_DRILLS,
	type PracticeDrill,
	TECHNIQUE_HANDS_MODES,
	type TechniqueHandsMode,
} from "@/models/practice";

interface TechniqueModeFieldsProps {
	/** i18n prefix — `screen.addTechnique` or `screen.editTechnique`. */
	screen: string;
	handsMode: TechniqueHandsMode;
	onChangeHandsMode: (mode: TechniqueHandsMode) => void;
	activeDrills: PracticeDrill[];
	onChangeActiveDrills: (drills: PracticeDrill[]) => void;
}

/** Hands radio group + drill checkboxes, shared by the add and edit forms. */
export function TechniqueModeFields({
	screen,
	handsMode,
	onChangeHandsMode,
	activeDrills,
	onChangeActiveDrills,
}: TechniqueModeFieldsProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const toggleDrill = (drill: PracticeDrill) => {
		onChangeActiveDrills(
			activeDrills.includes(drill)
				? activeDrills.filter((d) => d !== drill)
				: [...activeDrills, drill],
		);
	};

	return (
		<>
			<View className="gap-1">
				<Text variant="titleSmall">{t(`${screen}.handsLabel`)}</Text>
				<Text
					variant="bodySmall"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{t(`${screen}.handsHelp`)}
				</Text>
				<RadioButton.Group
					value={handsMode}
					onValueChange={(v) => onChangeHandsMode(v as TechniqueHandsMode)}
				>
					{TECHNIQUE_HANDS_MODES.map((mode) => (
						<RadioButton.Item
							key={mode}
							value={mode}
							label={t(`technique.handsMode.${mode}`)}
							position="leading"
							// Paper right-aligns the label when the control leads.
							labelStyle={{ textAlign: "left" }}
							accessibilityLabel={t(`technique.handsMode.${mode}`)}
						/>
					))}
				</RadioButton.Group>
			</View>

			<View className="gap-1">
				<Text variant="titleSmall">{t(`${screen}.drillsLabel`)}</Text>
				{PRACTICE_DRILLS.map((drill) => (
					<Checkbox.Item
						key={drill}
						label={t(`screen.practice.modes.drill.${drill}`)}
						status={activeDrills.includes(drill) ? "checked" : "unchecked"}
						position="leading"
						labelStyle={{ textAlign: "left" }}
						onPress={() => toggleDrill(drill)}
						accessibilityLabel={t(`screen.practice.modes.drill.${drill}`)}
					/>
				))}
			</View>
		</>
	);
}
