import type { TFunction } from "i18next";

export function formatDaysAgo(date: Date | null | undefined, t: TFunction): string {
	if (!date) {
		return t("common.neverPracticed");
	}

	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return t("common.today");
	if (diffDays === 1) return t("common.yesterday");
	return t("common.daysAgo", { count: diffDays });
}
