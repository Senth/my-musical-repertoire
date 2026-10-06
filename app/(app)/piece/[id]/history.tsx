import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView } from "react-native";
import { Chip, TouchableRipple } from "react-native-paper";
import { HistoryScreen } from "@/components/history/HistoryScreen";
import { LoadingScreen, MessageScreen } from "@/components/ui/CenteredScreen";
import { usePieces } from "@/hooks/use-pieces";
import { usePracticeHistory } from "@/hooks/use-practice-history";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import { radius, space } from "@/theme/tokens";
import {
	filterHistoryEntries,
	type HistoryFilter,
} from "@/utils/practice-history";

const CHIP_HIT_SLOP = {
	top: space.sm,
	bottom: space.sm,
	left: space.xs,
	right: space.xs,
};

export default function PieceHistoryScreen() {
	const { id, sectionId } = useLocalSearchParams<{
		id: string;
		sectionId?: string;
	}>();
	const { t } = useTranslation();
	const router = useRouter();
	const goBack = useUpNavigation(`/piece/${id}`);
	const { pieces, loading: piecesLoading } = usePieces();
	const piece = pieces.find((candidate) => candidate.id === id);
	const history = usePracticeHistory({ type: "piece", pieceId: id ?? "" });
	const routeKey = JSON.stringify([id, sectionId]);
	const [selection, setSelection] = useState<{
		routeKey: string;
		filter: HistoryFilter;
	} | null>(null);
	const requested: HistoryFilter =
		selection?.routeKey === routeKey
			? selection.filter
			: sectionId
				? `section:${sectionId}`
				: "all";
	const liveSections = history.sections
		.filter((section) => !section.archived)
		.sort((a, b) => a.order - b.order);
	const selectedSection = liveSections.find(
		(section) => requested === `section:${section.id}`,
	);
	const filter =
		requested.startsWith("section:") && !selectedSection ? "all" : requested;
	const filters: { value: HistoryFilter; label: string }[] = [
		{ value: "all", label: t("screen.history.all") },
		{ value: "run-throughs", label: t("screen.history.runThroughs") },
		...liveSections.map((section) => ({
			value: `section:${section.id}` as HistoryFilter,
			label: section.label,
		})),
	];
	if (piecesLoading) return <LoadingScreen />;
	if (!piece)
		return <MessageScreen message={t("screen.pieceDetail.pieceNotFound")} />;
	return (
		<HistoryScreen
			kind="piece"
			subtitle={piece.title}
			history={history}
			entries={filterHistoryEntries(history.entries, filter)}
			onBack={goBack}
			onPractice={() => router.push(`/piece/${id}/practice?from=piece-detail`)}
			emptyBody={t("screen.history.emptyPieceBody")}
			emptyMessage={
				filter === "all"
					? undefined
					: filter === "run-throughs"
						? t("screen.history.emptyRunThroughs")
						: t("screen.history.emptySection", {
								section: selectedSection?.label,
							})
			}
			filters={
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ gap: space.sm }}
				>
					{filters.map((option) => (
						<TouchableRipple
							key={option.value}
							borderless
							accessibilityRole="button"
							accessibilityLabel={option.label}
							accessibilityState={{ selected: filter === option.value }}
							aria-pressed={filter === option.value}
							onPress={() => setSelection({ routeKey, filter: option.value })}
							hitSlop={Platform.OS === "web" ? undefined : CHIP_HIT_SLOP}
							style={{ borderRadius: radius.chip }}
						>
							<Chip
								mode={filter === option.value ? "flat" : "outlined"}
								selected={filter === option.value}
								accessibilityRole="text"
								accessible={false}
								accessibilityElementsHidden
								importantForAccessibility="no-hide-descendants"
								pointerEvents="none"
								style={{ borderRadius: radius.chip }}
							>
								{option.label}
							</Chip>
						</TouchableRipple>
					))}
				</ScrollView>
			}
		/>
	);
}
