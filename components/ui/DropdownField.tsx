import { useState } from "react";
import { Pressable, View } from "react-native";
import { Menu, TextInput } from "react-native-paper";

export interface DropdownOption {
	value: string | null;
	label: string;
}

interface DropdownFieldProps {
	label: string;
	value: string | null;
	options: DropdownOption[];
	onChange: (value: string | null) => void;
}

export function DropdownField({
	label,
	value,
	options,
	onChange,
}: DropdownFieldProps) {
	const [visible, setVisible] = useState(false);
	const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

	return (
		<Menu
			visible={visible}
			onDismiss={() => setVisible(false)}
			anchor={
				<View style={{ position: "relative" }}>
					<TextInput
						label={label}
						value={selectedLabel}
						mode="outlined"
						editable={false}
						right={<TextInput.Icon icon="chevron-down" />}
					/>
					<Pressable
						onPress={() => setVisible(true)}
						accessibilityRole="combobox"
						accessibilityLabel={label}
						accessibilityState={{ expanded: visible }}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
						}}
					/>
				</View>
			}
		>
			{options.map((opt) => (
				<Menu.Item
					key={String(opt.value ?? "__null__")}
					title={opt.label}
					onPress={() => {
						onChange(opt.value);
						setVisible(false);
					}}
				/>
			))}
		</Menu>
	);
}
