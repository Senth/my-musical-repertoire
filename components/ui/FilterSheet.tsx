import { ScrollView, View } from "react-native";
import {
	Button,
	Chip,
	Divider,
	Modal,
	Portal,
	Text,
	TextInput,
	useTheme,
} from "react-native-paper";
import { useIsCompact } from "@/hooks/use-is-compact";
import { inset, radius, space } from "@/theme/tokens";

export interface FilterOption {
	value: string;
	label: string;
}

export type FilterSheetSection =
	| {
			id: string;
			title: string;
			type: "multi";
			options: FilterOption[];
			selected: string[];
			onToggle: (value: string) => void;
	  }
	| {
			id: string;
			title: string;
			type: "range";
			minLabel: string;
			maxLabel: string;
			min: string;
			max: string;
			onChangeMin: (value: string) => void;
			onChangeMax: (value: string) => void;
	  };

interface FilterSheetProps {
	visible: boolean;
	onDismiss: () => void;
	title: string;
	sections: FilterSheetSection[];
	onClearAll: () => void;
	clearAllLabel: string;
	doneLabel: string;
}

/**
 * Config-driven filter sheet: bottom-anchored on compact, a centred card on
 * wide. Every tap applies immediately — the list behind updates as you go, so
 * there is no draft state and no Apply/Cancel to get wrong.
 */
export function FilterSheet({
	visible,
	onDismiss,
	title,
	sections,
	onClearAll,
	clearAllLabel,
	doneLabel,
}: FilterSheetProps) {
	const theme = useTheme();
	const isCompact = useIsCompact();

	return (
		<Portal>
			<Modal
				visible={visible}
				onDismiss={onDismiss}
				style={isCompact ? { justifyContent: "flex-end" } : undefined}
				contentContainerStyle={{
					backgroundColor: theme.colors.elevation.level3,
					marginHorizontal: isCompact ? 0 : inset.roomy,
					alignSelf: "center",
					width: "100%",
					maxWidth: isCompact ? undefined : 480,
					maxHeight: "80%",
					borderTopLeftRadius: radius.card,
					borderTopRightRadius: radius.card,
					borderBottomLeftRadius: isCompact ? 0 : radius.card,
					borderBottomRightRadius: isCompact ? 0 : radius.card,
					overflow: "hidden",
				}}
			>
				<View style={{ paddingHorizontal: space.xl, paddingTop: space.xl }}>
					<Text variant="titleLarge">{title}</Text>
				</View>

				<ScrollView
					contentContainerStyle={{
						paddingHorizontal: space.xl,
						paddingVertical: space.lg,
						gap: space.xl,
					}}
				>
					{sections.map((section) => (
						<View key={section.id} style={{ gap: space.sm }}>
							<Text
								variant="labelLarge"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{section.title}
							</Text>
							{section.type === "multi" ? (
								<View
									style={{
										flexDirection: "row",
										flexWrap: "wrap",
										gap: space.sm,
									}}
								>
									{section.options.map((option) => (
										<Chip
											key={option.value}
											compact
											showSelectedCheck
											selected={section.selected.includes(option.value)}
											onPress={() => section.onToggle(option.value)}
										>
											{option.label}
										</Chip>
									))}
								</View>
							) : (
								<View style={{ flexDirection: "row", gap: space.md }}>
									<TextInput
										mode="outlined"
										dense
										style={{ flex: 1 }}
										label={section.minLabel}
										value={section.min}
										keyboardType="number-pad"
										onChangeText={section.onChangeMin}
									/>
									<TextInput
										mode="outlined"
										dense
										style={{ flex: 1 }}
										label={section.maxLabel}
										value={section.max}
										keyboardType="number-pad"
										onChangeText={section.onChangeMax}
									/>
								</View>
							)}
						</View>
					))}
				</ScrollView>

				<Divider />
				<View
					style={{
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "center",
						paddingHorizontal: space.lg,
						paddingVertical: space.md,
					}}
				>
					<Button mode="text" onPress={onClearAll}>
						{clearAllLabel}
					</Button>
					<Button mode="contained" onPress={onDismiss}>
						{doneLabel}
					</Button>
				</View>
			</Modal>
		</Portal>
	);
}
