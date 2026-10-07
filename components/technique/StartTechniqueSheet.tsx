import { useEffect, useState } from "react";
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
	candidates: TechniqueItem[];
	onPick: (id: string) => void;
	onCreate: () => void;
	onShowMore?: () => Promise<boolean>;
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
	const [loading, setLoading] = useState(false);

	const needle = query.trim().toLowerCase();
	const shown = candidates.filter((c) =>
		c.title.toLowerCase().includes(needle),
	);
	const findMore =
		needle && shown.length === 0 && !loading ? onShowMore : undefined;

	useEffect(() => {
		if (!findMore) return;
		setLoading(true);
		findMore().then((loaded) => setLoading(!loaded));
	}, [findMore]);

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
			<View style={{ paddingHorizontal: space.xl, paddingTop: space.lg }}>
				<Searchbar
					style={{ backgroundColor: theme.colors.surfaceVariant }}
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
						style={{ paddingLeft: space.sm }}
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
						style={{ alignItems: "flex-start", paddingHorizontal: space.md }}
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
					paddingHorizontal: space.md,
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
