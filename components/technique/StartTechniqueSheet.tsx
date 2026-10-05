import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { Button, List, Searchbar, Text, useTheme } from "react-native-paper";
import { TechniqueStateChip } from "@/components/technique/TechniqueStateChip";
import { SheetFrame } from "@/components/ui/FilterSheet";
import type { TechniqueItem } from "@/models/technique";
import { space } from "@/theme/tokens";

interface StartTechniqueSheetProps {
	visible: boolean;
	onDismiss: () => void;
	fromTitle: string;
	/** Not started techniques, in queue order. */
	candidates: TechniqueItem[];
	onPick: (id: string) => void;
	onCreate: () => void;
	/** Present while more of the queue is still unread. */
	onShowMore?: () => void;
}

export function StartTechniqueSheet({
	visible,
	onDismiss,
	fromTitle,
	candidates,
	onPick,
	onCreate,
	onShowMore,
}: StartTechniqueSheetProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const [query, setQuery] = useState("");

	const needle = query.trim().toLowerCase();
	const shown = candidates.filter((c) =>
		c.title.toLowerCase().includes(needle),
	);

	return (
		<SheetFrame visible={visible} onDismiss={onDismiss}>
			<View
				style={{
					paddingHorizontal: space.xl,
					paddingTop: space.xl,
					gap: space.xs,
				}}
			>
				<Text variant="titleLarge">
					{t("technique.curriculum.sheet.title")}
				</Text>
				<Text
					variant="bodyMedium"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{t("technique.curriculum.sheet.moves", { title: fromTitle })}
				</Text>
			</View>
			<View style={{ paddingHorizontal: space.lg, paddingTop: space.lg }}>
				<Searchbar
					placeholder={t("technique.curriculum.sheet.search")}
					value={query}
					onChangeText={setQuery}
				/>
			</View>
			<ScrollView contentContainerStyle={{ paddingVertical: space.sm }}>
				{shown.map((c) => (
					<List.Item
						key={c.id}
						title={c.title}
						onPress={() => c.id && onPick(c.id)}
						right={() => (
							<View style={{ justifyContent: "center" }}>
								<TechniqueStateChip state={c.state} />
							</View>
						)}
					/>
				))}
				{onShowMore && (
					<View
						style={{ alignItems: "flex-start", paddingHorizontal: space.sm }}
					>
						<Button mode="text" icon="chevron-down" onPress={onShowMore}>
							{t("technique.curriculum.sheet.more")}
						</Button>
					</View>
				)}
			</ScrollView>
			<View
				style={{
					alignItems: "flex-start",
					paddingHorizontal: space.sm,
					paddingBottom: space.lg,
				}}
			>
				<Button mode="text" icon="plus" onPress={onCreate}>
					{t("technique.curriculum.sheet.create")}
				</Button>
			</View>
		</SheetFrame>
	);
}
