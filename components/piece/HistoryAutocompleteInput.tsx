import { useState } from "react";
import { Pressable, View } from "react-native";
import { HelperText, Text, TextInput, useTheme } from "react-native-paper";

interface Props {
	value: string;
	onChangeText: (text: string) => void;
	label: string;
	error?: boolean;
	helperText?: string;
	/** Already filtered, ranked and capped by the caller. */
	suggestions: string[];
}

export function HistoryAutocompleteInput({
	value,
	onChangeText,
	label,
	error,
	helperText,
	suggestions,
}: Props) {
	const theme = useTheme();
	const [open, setOpen] = useState(false);
	const [inputHeight, setInputHeight] = useState(56);

	const handleChangeText = (text: string) => {
		onChangeText(text);
		setOpen(true);
	};

	const handleSelect = (suggestion: string) => {
		onChangeText(suggestion);
		setOpen(false);
	};

	const showDropdown = open && suggestions.length > 0;

	return (
		<View style={{ zIndex: showDropdown ? 10 : 0, position: "relative" }}>
			<View style={{ position: "relative" }}>
				<TextInput
					label={label}
					// Paper's floating label is a sibling element, not the
					// input's accessible name — see FormTextField.
					aria-label={label}
					value={value}
					onChangeText={handleChangeText}
					mode="outlined"
					error={error}
					onFocus={() => setOpen(true)}
					onBlur={() => {
						setTimeout(() => setOpen(false), 150);
					}}
					onLayout={(e) => setInputHeight(e.nativeEvent.layout.height)}
				/>
				{showDropdown && (
					<View
						style={{
							position: "absolute",
							top: inputHeight,
							left: 0,
							right: 0,
							zIndex: 1000,
							elevation: 4,
							backgroundColor: theme.colors.surface,
							borderRadius: 4,
							shadowColor: "#000",
							shadowOffset: { width: 0, height: 2 },
							shadowOpacity: 0.15,
							shadowRadius: 3,
						}}
					>
						{suggestions.map((suggestion) => (
							<Pressable
								key={suggestion}
								onPress={() => handleSelect(suggestion)}
								style={({ pressed }) => ({
									paddingHorizontal: 16,
									paddingVertical: 14,
									backgroundColor: pressed
										? theme.colors.surfaceVariant
										: "transparent",
								})}
							>
								<Text
									variant="bodyLarge"
									style={{ color: theme.colors.onSurface }}
								>
									{suggestion}
								</Text>
							</Pressable>
						))}
					</View>
				)}
			</View>
			<HelperText type="error" visible={!!helperText}>
				{helperText ?? ""}
			</HelperText>
		</View>
	);
}
