import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Checkbox, Text, useTheme } from "react-native-paper";
import type { PhaseOffer } from "@/utils/phase-offer";
import type { DemoteReason } from "@/utils/section-progression";

/** Which self-report questions gate which transition. */
export type OfferCheck = "memory" | "continuity";

export function checksFor(offer: PhaseOffer): OfferCheck[] {
	if (offer.kind === "demote") return [];
	if (offer.toPhase === "stabilizing") return ["memory"];
	return ["memory", "continuity"];
}

export function offerTitleKey(offer: PhaseOffer): string {
	return `screen.practice.phaseOffer.title.${offer.kind}.${offer.toPhase}`;
}

/** "today" / "yesterday" read as a warning; "0 days ago" reads as a bug. */
function cyclingGuardKey(days: number): string {
	const prefix = "screen.practice.phaseOffer.cyclingGuard";
	if (days === 0) return `${prefix}.today`;
	if (days === 1) return `${prefix}.yesterday`;
	return `${prefix}.daysAgo`;
}

/**
 * The shared body of a phase nudge — title, the one line of evidence, the
 * cycling-guard warning, and the self-report checkboxes. The card and the coach
 * dialog wrap it with their own actions.
 *
 * `onChecksChange` reports whether every checkbox shown has been ticked, so the
 * wrapper can enable its primary action. See
 * `docs/specs/section-progression-nudges.md` §5.1.
 */
export function PhaseOfferBody({
	offer,
	onReadyChange,
}: {
	offer: PhaseOffer;
	onReadyChange: (ready: boolean) => void;
}) {
	const { t } = useTranslation();
	const theme = useTheme();
	const checks = useMemo(() => checksFor(offer), [offer]);
	const [ticked, setTicked] = useState<OfferCheck[]>([]);

	// The coach reuses one dialog across blocks, so a new offer must arrive
	// unticked rather than inheriting the last section's answers. Adjusting
	// during render rather than in an effect avoids a frame showing the stale
	// ticks with the new offer's copy.
	const [seenOffer, setSeenOffer] = useState(offer);
	if (seenOffer !== offer) {
		setSeenOffer(offer);
		setTicked([]);
	}

	// A demote has no checkboxes, so it reports ready as soon as it mounts.
	useEffect(() => {
		onReadyChange(checks.every((c) => ticked.includes(c)));
	}, [checks, ticked, onReadyChange]);

	const toggle = (check: OfferCheck) =>
		setTicked((prev) =>
			prev.includes(check) ? prev.filter((c) => c !== check) : [...prev, check],
		);

	return (
		<View className="gap-2">
			<Text variant="bodyMedium">{offerReasonText(offer, t)}</Text>

			{offer.cyclingDays != null && (
				<Text variant="bodySmall" style={{ color: theme.colors.error }}>
					{t(cyclingGuardKey(offer.cyclingDays), {
						phase: t(`section.phase.${offer.fromPhase}`).toLowerCase(),
						count: offer.cyclingDays,
					})}
				</Text>
			)}

			{checks.map((check) => (
				<Checkbox.Item
					key={check}
					label={t(`screen.practice.phaseOffer.check.${check}`)}
					status={ticked.includes(check) ? "checked" : "unchecked"}
					onPress={() => toggle(check)}
					position="leading"
					style={{ paddingHorizontal: 0 }}
					labelStyle={{ textAlign: "left" }}
				/>
			))}
		</View>
	);
}

type Translate = ReturnType<typeof useTranslation>["t"];

/** The single line of evidence under the title. */
export function offerReasonText(offer: PhaseOffer, t: Translate): string {
	if (offer.kind === "advance") {
		if (offer.htBpm == null) {
			return t("screen.practice.phaseOffer.reason.advanceNoBpm", {
				count: offer.cleanDays,
			});
		}
		return t("screen.practice.phaseOffer.reason.advance", {
			bpm: offer.htBpm,
			count: offer.cleanDays,
		});
	}
	return demoteReasonText(offer.demoteReason, t);
}

function demoteReasonText(reason: DemoteReason | null, t: Translate): string {
	if (!reason) return t("screen.practice.phaseOffer.reason.demoteGeneric");
	switch (reason.kind) {
		case "bpm-drop":
			return t("screen.practice.phaseOffer.reason.bpmDrop", {
				percent: Math.round((1 - reason.bpm / reason.previousBpm) * 100),
			});
		case "low-quality":
			return t("screen.practice.phaseOffer.reason.lowQuality", {
				quality: reason.quality,
			});
		default:
			return t("screen.practice.phaseOffer.reason.strain", {
				quality: reason.quality,
			});
	}
}
