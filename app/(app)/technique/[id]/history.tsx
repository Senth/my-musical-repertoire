import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { HistoryScreen } from "@/components/history/HistoryScreen";
import { LoadingScreen, MessageScreen } from "@/components/ui/CenteredScreen";
import { usePracticeHistory } from "@/hooks/use-practice-history";
import { useTechniques } from "@/hooks/use-techniques";
import { useUpNavigation } from "@/hooks/use-up-navigation";

export default function TechniqueHistoryScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { t } = useTranslation();
	const router = useRouter();
	const goBack = useUpNavigation(`/technique/${id}`);
	const { techniques, loading } = useTechniques();
	const technique = techniques.find((candidate) => candidate.id === id);
	const history = usePracticeHistory({
		type: "technique",
		techniqueId: id ?? "",
	});
	if (loading) return <LoadingScreen />;
	if (!technique)
		return <MessageScreen message={t("screen.techniqueDetail.notFound")} />;
	return (
		<HistoryScreen
			kind="technique"
			subtitle={technique.title}
			history={history}
			entries={history.entries}
			emptyBody={t("screen.history.emptyTechniqueBody")}
			onBack={goBack}
			onPractice={() =>
				router.push(`/technique/${id}/practice?from=technique-detail`)
			}
		/>
	);
}
