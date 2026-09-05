import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { NormalizedLastLog } from "@/hooks/use-last-practice-log";
import { PracticeMistakes } from "@/models/practice";
import { formatDaysAgo } from "@/utils/date";

const AFTER_BREAK_DAYS = 10;

/**
 * History rows use the short wording. The descriptive phrasing belongs to the
 * helper line under the input, where a whole line is free; here it would push
 * the "Previous: …" column off a phone screen.
 */
const MISTAKE_LEVEL_KEYS: Record<PracticeMistakes, string> = {
	[PracticeMistakes.none]: "screen.practice.mistakeLevelShort.none",
	[PracticeMistakes.few]: "screen.practice.mistakeLevelShort.few",
	[PracticeMistakes.some]: "screen.practice.mistakeLevelShort.some",
	[PracticeMistakes.many]: "screen.practice.mistakeLevelShort.many",
	[PracticeMistakes.everywhere]: "screen.practice.mistakeLevelShort.everywhere",
};

interface LastSessionCardProps {
	lastLog: NormalizedLastLog | null;
	loading: boolean;
	scope: "piece" | "section" | "technique";
	targetBpm?: number | null;
}

export function LastSessionCard({
	lastLog,
	loading,
	scope,
	targetBpm,
}: LastSessionCardProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	if (loading) return null;

	if (!lastLog) {
		return (
			<Text
				variant="bodySmall"
				style={{ color: theme.colors.onSurfaceVariant }}
			>
				{t("screen.practice.lastSession.firstPractice")}
			</Text>
		);
	}

	const daysAgo = Math.round(
		(Date.now() - lastLog.date.getTime()) / (1000 * 60 * 60 * 24),
	);
	const isAfterBreak = daysAgo > AFTER_BREAK_DAYS;

	const headerText = isAfterBreak
		? t("screen.practice.lastSession.headerAfterBreak", {
				when: formatDaysAgo(lastLog.date, t),
			})
		: t("screen.practice.lastSession.header", {
				when: formatDaysAgo(lastLog.date, t),
			});

	const bpmDisplay =
		lastLog.achievedBpm != null
			? targetBpm != null
				? `${lastLog.achievedBpm} BPM ${t("screen.practice.lastSession.tempoTarget", { bpm: targetBpm })}`
				: `${lastLog.achievedBpm} BPM`
			: t("screen.practice.lastSession.tempoNone");

	return (
		<View
			style={{
				backgroundColor: theme.colors.surfaceVariant,
				borderRadius: 12,
				padding: 12,
				gap: 4,
			}}
		>
			<Text
				variant="labelLarge"
				style={{ color: theme.colors.onSurfaceVariant }}
			>
				{headerText}
			</Text>

			{lastLog.note ? (
				// The teacher's "where we were last time" — the note outranks the
				// metrics below it, hence bodyMedium on onSurface against their
				// bodySmall on onSurfaceVariant. Italic marks it as a quotation.
				<Text
					variant="bodyMedium"
					style={{
						color: theme.colors.onSurface,
						fontStyle: "italic",
					}}
				>
					{t("screen.practice.lastSession.note", { note: lastLog.note })}
				</Text>
			) : null}

			<Text
				variant="bodySmall"
				style={{ color: theme.colors.onSurfaceVariant }}
			>
				{t("screen.practice.lastSession.tempo")}: {bpmDisplay}
			</Text>

			{scope === "piece" && (
				<>
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.practice.lastSession.technical")}:{" "}
						{lastLog.technicalMistakes != null
							? t(MISTAKE_LEVEL_KEYS[lastLog.technicalMistakes])
							: "—"}
					</Text>
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.practice.lastSession.memory")}:{" "}
						{lastLog.memoryMistakes != null
							? t(MISTAKE_LEVEL_KEYS[lastLog.memoryMistakes])
							: "—"}
					</Text>
				</>
			)}

			{(scope === "section" || scope === "technique") && (
				<>
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.practice.lastSession.quality")}:{" "}
						{lastLog.quality != null
							? t(`technique.qualityShort.${lastLog.quality}`)
							: "—"}
					</Text>
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.practice.lastSession.effort")}:{" "}
						{lastLog.effort != null
							? t(`technique.effortShort.${lastLog.effort}`)
							: "—"}
					</Text>
				</>
			)}
		</View>
	);
}
