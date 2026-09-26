import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Checkbox, Text, useTheme } from "react-native-paper";
import { space } from "@/theme/tokens";
import { formatDaysAgo } from "@/utils/date";
import type { DemoteReason } from "@/utils/section-progression";
import type { StateOffer } from "@/utils/state-offer";

/** Which self-report questions gate which transition. */
export type OfferCheck = "memory" | "continuity";

export function checksFor(offer: StateOffer): OfferCheck[] {
	if (offer.kind === "demote") return [];
	if (offer.toState === "stabilizing") return ["memory"];
	return ["memory", "continuity"];
}

/**
 * A seam the app saw hold is evidence, not an answer (#204): the check starts
 * ticked so the student confirms rather than re-attests, and can untick it.
 */
export function initialChecks(offer: StateOffer): OfferCheck[] {
	if (offer.seamHeldAt == null) return [];
	return checksFor(offer).includes("continuity") ? ["continuity"] : [];
}

export function offerTitleKey(offer: StateOffer): string {
	return `screen.practice.stateOffer.title.${offer.kind}.${offer.toState}`;
}

/** "today" / "yesterday" read as a warning; "0 days ago" reads as a bug. */
function cyclingGuardKey(days: number): string {
	const prefix = "screen.practice.stateOffer.cyclingGuard";
	if (days === 0) return `${prefix}.today`;
	if (days === 1) return `${prefix}.yesterday`;
	return `${prefix}.daysAgo`;
}

/**
 * The shared body of a state nudge — title, the one line of evidence, the
 * cycling-guard warning, and the self-report checkboxes. The card and the coach
 * dialog wrap it with their own actions.
 *
 * `onChecksChange` reports whether every checkbox shown has been ticked, so the
 * wrapper can enable its primary action.
 */
export function StateOfferBody({
	offer,
	onReadyChange,
}: {
	offer: StateOffer;
	onReadyChange: (ready: boolean) => void;
}) {
	const { t } = useTranslation();
	const theme = useTheme();
	const checks = useMemo(() => checksFor(offer), [offer]);
	const [ticked, setTicked] = useState<OfferCheck[]>(() =>
		initialChecks(offer),
	);

	// The coach reuses one dialog across blocks, so a new offer must arrive
	// with its own answers rather than inheriting the last section's. Adjusting
	// during render rather than in an effect avoids a frame showing the stale
	// ticks with the new offer's copy.
	const [seenOffer, setSeenOffer] = useState(offer);
	if (seenOffer !== offer) {
		setSeenOffer(offer);
		setTicked(initialChecks(offer));
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
		<View style={{ gap: space.sm }}>
			<Text variant="bodyMedium">{offerReasonText(offer, t)}</Text>

			{offer.cyclingDays != null && (
				<Text variant="bodySmall" style={{ color: theme.colors.error }}>
					{t(cyclingGuardKey(offer.cyclingDays), {
						state: t(`section.state.${offer.fromState}`).toLowerCase(),
						count: offer.cyclingDays,
					})}
				</Text>
			)}

			{checks.map((check) => (
				<Checkbox.Item
					key={check}
					label={t(`screen.practice.stateOffer.check.${check}`)}
					status={ticked.includes(check) ? "checked" : "unchecked"}
					onPress={() => toggle(check)}
					position="leading"
					style={{ paddingHorizontal: 0 }}
					labelStyle={{ textAlign: "left" }}
				/>
			))}

			{offer.seamHeldAt != null && checks.includes("continuity") && (
				<Text
					variant="bodySmall"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{t("screen.practice.stateOffer.seamHeld", {
						when: formatDaysAgo(offer.seamHeldAt, t).toLowerCase(),
					})}
				</Text>
			)}
		</View>
	);
}

type Translate = ReturnType<typeof useTranslation>["t"];

/** The single line of evidence under the title. */
export function offerReasonText(offer: StateOffer, t: Translate): string {
	if (offer.kind === "advance") {
		// No HT tempo on an advance means the hands-only gate passed (#173) —
		// there are no clean HT days to quote either.
		if (offer.htBpm == null) {
			return t("screen.practice.stateOffer.reason.advanceHands");
		}
		return t("screen.practice.stateOffer.reason.advance", {
			bpm: offer.htBpm,
			count: offer.cleanDays,
		});
	}
	return demoteReasonText(offer.demoteReason, t);
}

function demoteReasonText(reason: DemoteReason | null, t: Translate): string {
	if (!reason) return t("screen.practice.stateOffer.reason.demoteGeneric");
	switch (reason.kind) {
		case "bpm-drop":
			return t("screen.practice.stateOffer.reason.bpmDrop", {
				percent: Math.round((1 - reason.bpm / reason.previousBpm) * 100),
			});
		case "low-quality":
			return t("screen.practice.stateOffer.reason.lowQuality", {
				quality: reason.quality,
			});
		default:
			return t("screen.practice.stateOffer.reason.strain", {
				quality: reason.quality,
			});
	}
}
