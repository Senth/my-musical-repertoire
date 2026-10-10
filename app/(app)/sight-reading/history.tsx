import { useTranslation } from "react-i18next";
import { HistoryScreen } from "@/components/history/HistoryScreen";
import { useSightReadingHistory } from "@/hooks/use-sight-reading-history";
import { useUpNavigation } from "@/hooks/use-up-navigation";

export default function SightReadingHistoryScreen() {
	const { t } = useTranslation();
	const history = useSightReadingHistory();
	const goBack = useUpNavigation("/technique");
	return (
		<HistoryScreen
			kind="sight-reading"
			subtitle={t("screen.history.sightReadingTitle")}
			history={history}
			entries={history.entries}
			emptyBody={t("screen.history.emptySightReadingBody")}
			onBack={goBack}
		/>
	);
}
