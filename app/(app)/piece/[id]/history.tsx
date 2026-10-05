import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { Chip } from "react-native-paper";
import { HistoryScreen } from "@/components/history/HistoryScreen";
import { LoadingScreen, MessageScreen } from "@/components/ui/CenteredScreen";
import { usePieces } from "@/hooks/use-pieces";
import { usePracticeHistory } from "@/hooks/use-practice-history";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import { space, touchTarget } from "@/theme/tokens";
import {
	filterHistoryEntries,
	type HistoryFilter,
} from "@/utils/practice-history";

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
						<Chip
							key={option.value}
							selected={filter === option.value}
							accessibilityLabel={option.label}
							accessibilityState={{ selected: filter === option.value }}
							onPress={() => setSelection({ routeKey, filter: option.value })}
							style={{
								minHeight: touchTarget.minimum,
								justifyContent: "center",
							}}
						>
							{option.label}
						</Chip>
					))}
				</ScrollView>
			}
		/>
	);
}
