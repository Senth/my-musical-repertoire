import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { HistoryLink } from "@/components/history/HistoryLink";
import { useAuth } from "@/contexts/AuthContext";
import { fetchLastSightReading } from "@/hooks/use-sight-reading-logs";
import { formatDaysAgo } from "@/utils/date";

export function SightReadingHistoryLink() {
	const { t } = useTranslation();
	const router = useRouter();
	const { user } = useAuth();
	const uid = user?.uid;
	const [lastRead, setLastRead] = useState({
		uid,
		date: undefined as Date | null | undefined,
	});
	useFocusEffect(
		useCallback(() => {
			if (!uid) return;
			let active = true;
			fetchLastSightReading(uid)
				.then((log) => {
					if (active) setLastRead({ uid, date: log?.date ?? null });
				})
				.catch(() => {
					if (active) setLastRead({ uid, date: undefined });
				});
			return () => {
				active = false;
			};
		}, [uid]),
	);
	const date = uid && lastRead.uid === uid ? lastRead.date : undefined;
	return (
		<HistoryLink
			title={t("screen.sightReadingHistory.entryTitle")}
			description={
				date === undefined
					? undefined
					: date === null
						? t("screen.sightReadingHistory.notReadYet")
						: t("screen.sightReadingHistory.lastRead", {
								when: formatDaysAgo(date, t),
							})
			}
			onPress={() => router.push("/sight-reading/history")}
		/>
	);
}
