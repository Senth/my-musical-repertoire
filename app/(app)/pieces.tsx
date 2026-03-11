import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, View } from "react-native";
import { Appbar, List, Searchbar, Text, useTheme } from "react-native-paper";
import { PieceProgressBar } from "@/components/ui/PieceProgressBar";
import { usePieces } from "@/hooks/use-pieces";
import type { Piece } from "@/models/piece";
import { formatDaysAgo } from "@/utils/date";

export default function PiecesScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { pieces } = usePieces();
	const [searchQuery, setSearchQuery] = useState("");

	const filteredPieces = useMemo(() => {
		if (!searchQuery.trim()) return pieces;
		const query = searchQuery.toLowerCase();
		return pieces.filter(
			(p) =>
				p.title.toLowerCase().includes(query) ||
				p.composer.toLowerCase().includes(query),
		);
	}, [pieces, searchQuery]);

	const renderItem = ({ item }: { item: Piece }) => (
		<List.Item
			title={item.title}
			description={() => (
				<View className="gap-1 mt-1">
					<Text
						variant="bodyMedium"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{item.composer}
					</Text>
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{formatDaysAgo(item.lastPracticed, t)}
					</Text>
				</View>
			)}
			right={() => (
				<View className="justify-center w-24">
					<PieceProgressBar
						technicalMistakes={item.lastTechnicalMistakes}
						memoryMistakes={item.lastMemoryMistakes}
					/>
				</View>
			)}
			onPress={() => router.push(`/practice/${item.id}`)}
		/>
	);

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
				<Appbar.BackAction
					onPress={() => router.back()}
					color={theme.colors.onPrimary}
				/>
				<Appbar.Content
					title={t("screen.pieces.title")}
					titleStyle={{ color: theme.colors.onPrimary }}
				/>
			</Appbar.Header>

			<View className="p-4">
				<Searchbar
					placeholder={t("screen.pieces.searchPlaceholder")}
					value={searchQuery}
					onChangeText={setSearchQuery}
				/>
			</View>

			{filteredPieces.length === 0 ? (
				<View className="flex-1 items-center justify-center p-4">
					<Text
						variant="bodyLarge"
						style={{
							color: theme.colors.onSurfaceVariant,
							textAlign: "center",
						}}
					>
						{t("screen.pieces.noResults")}
					</Text>
				</View>
			) : (
				<FlatList
					data={filteredPieces}
					keyExtractor={(item) => item.id ?? ""}
					renderItem={renderItem}
					contentContainerStyle={{ paddingHorizontal: 16 }}
				/>
			)}
		</View>
	);
}
