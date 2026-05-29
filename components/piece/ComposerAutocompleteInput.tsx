import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { HelperText, Text, TextInput, useTheme } from "react-native-paper";
import type { Piece } from "@/models/piece";

interface Props {
	value: string;
	onChangeText: (text: string) => void;
	label: string;
	error?: boolean;
	helperText?: string;
	pieces: Piece[];
}

export function ComposerAutocompleteInput({
	value,
	onChangeText,
	label,
	error,
	helperText,
	pieces,
}: Props) {
	const theme = useTheme();
	const [open, setOpen] = useState(false);
	const [inputHeight, setInputHeight] = useState(56);

	const composerHistory = useMemo(() => {
		const seen = new Map<string, string>();
		for (const piece of pieces) {
			const key = piece.composer.toLowerCase().trim();
			if (key && !seen.has(key)) {
				seen.set(key, piece.composer.trim());
			}
		}
		return Array.from(seen.values()).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase()),
		);
	}, [pieces]);

	const suggestions = useMemo(() => {
		if (!value.trim()) return [];
		const lower = value.toLowerCase();
		return composerHistory
			.filter((c) => c.toLowerCase().includes(lower))
			.slice(0, 5);
	}, [value, composerHistory]);

	const handleChangeText = (text: string) => {
		onChangeText(text);
		setOpen(text.trim().length >= 1);
	};

	const handleSelect = (suggestion: string) => {
		onChangeText(suggestion);
		setOpen(false);
	};

	const showDropdown = open && suggestions.length > 0;

	return (
		<View>
			<View style={{ position: "relative", zIndex: showDropdown ? 10 : 0 }}>
				<TextInput
					label={label}
					value={value}
					onChangeText={handleChangeText}
					mode="outlined"
					error={error}
					onFocus={() => {
						if (value.trim().length >= 1) setOpen(true);
					}}
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
