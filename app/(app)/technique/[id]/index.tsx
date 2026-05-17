import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import {
	ActivityIndicator,
	Appbar,
	Button,
	Chip,
	Divider,
	Snackbar,
	Text,
	useTheme,
} from "react-native-paper";
import { DeleteTechniqueDialog } from "@/components/technique/DeleteTechniqueDialog";
import { TechniqueStateChip } from "@/components/technique/TechniqueStateChip";
import { useDeleteTechnique, useTechniques } from "@/hooks/use-techniques";
import { formatDaysAgo } from "@/utils/date";

export default function TechniqueDetailScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();

	const { techniques, loading } = useTechniques();
	const { deleteTechnique } = useDeleteTechnique();

	const item = techniques.find((tech) => tech.id === id);

	const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleDelete = async () => {
		if (!id) return;
		setDeleteLoading(true);
		try {
			await deleteTechnique(id);
			router.replace("/(app)/(tabs)/technique");
		} catch {
			setDeleteDialogVisible(false);
			setError(t("error.deleteTechnique"));
		} finally {
			setDeleteLoading(false);
		}
	};

	if (loading) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: theme.colors.background }}
			>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (!item) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: theme.colors.background }}
			>
				<Text variant="bodyLarge">{t("screen.techniqueDetail.notFound")}</Text>
			</View>
		);
	}

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={item.title} />
				<Appbar.Action
					icon="pencil"
					accessibilityLabel={t("a11y.action.edit")}
					onPress={() => router.push(`/technique/${id}/edit`)}
				/>
				<Appbar.Action
					icon="delete"
					accessibilityLabel={t("a11y.action.delete")}
					onPress={() => setDeleteDialogVisible(true)}
				/>
			</Appbar.Header>

			<ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
				{/* Header info */}
				<View className="px-4 pt-4 gap-2">
					<View className="flex-row items-center gap-2 flex-wrap">
						<TechniqueStateChip state={item.state} />
						{item.type && (
							<Chip compact textStyle={{ fontSize: 11 }}>
								{t(`technique.type.${item.type}` as Parameters<typeof t>[0])}
							</Chip>
						)}
					</View>
					<Text
						variant="bodyMedium"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.techniqueDetail.lastPracticed", {
							when: formatDaysAgo(item.lastPracticedAt, t),
						})}
					</Text>
					{item.targetTempoBpm != null && (
						<Text
							variant="bodyMedium"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{t("screen.techniqueDetail.targetBpm", {
								bpm: item.targetTempoBpm,
							})}
						</Text>
					)}
				</View>

				{/* Practice button */}
				<View className="px-4 pt-4">
					<Button
						mode="contained"
						onPress={() => router.push(`/technique/${id}/practice`)}
						contentStyle={{ paddingVertical: 4 }}
					>
						{t("screen.techniqueDetail.practice")}
					</Button>
				</View>

				{item.notes && (
					<>
						<Divider className="mt-6" />
						<View className="px-4 pt-4 gap-2">
							<Text
								variant="titleSmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{t("screen.techniqueDetail.notes")}
							</Text>
							<Text
								variant="bodyMedium"
								style={{ color: theme.colors.onSurface }}
							>
								{item.notes}
							</Text>
						</View>
					</>
				)}
			</ScrollView>

			<DeleteTechniqueDialog
				visible={deleteDialogVisible}
				techniqueName={item.title}
				loading={deleteLoading}
				onConfirm={handleDelete}
				onDismiss={() => setDeleteDialogVisible(false)}
			/>

			<Snackbar
				visible={!!error}
				onDismiss={() => setError(null)}
				duration={4000}
				action={{ label: t("common.ok"), onPress: () => setError(null) }}
			>
				{error ?? ""}
			</Snackbar>
		</View>
	);
}
