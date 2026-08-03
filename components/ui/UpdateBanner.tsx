import { useTranslation } from "react-i18next";
import { Snackbar } from "react-native-paper";
import { useHasActiveSession } from "@/hooks/use-has-active-session";
import { useServiceWorker } from "@/hooks/use-service-worker";

/**
 * Offers a reload once a new service worker is waiting.
 *
 * Held back while a session is in progress — the reload discards the current
 * block's unsaved input — and re-offered on the next navigation without one.
 */
export function UpdateBanner() {
	const { t } = useTranslation();
	const { updateReady, applyUpdate } = useServiceWorker();
	const hasActiveSession = useHasActiveSession();

	return (
		<Snackbar
			visible={updateReady && !hasActiveSession}
			// Dismissing would hide the only way to pick the update up, so the bar
			// stays until it is used.
			duration={Number.POSITIVE_INFINITY}
			onDismiss={() => {}}
			action={{ label: t("common.update.reload"), onPress: applyUpdate }}
		>
			{t("common.update.available")}
		</Snackbar>
	);
}
