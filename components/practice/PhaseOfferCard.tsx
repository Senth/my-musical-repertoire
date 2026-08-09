import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	Button,
	Card,
	Dialog,
	Portal,
	Text,
	useTheme,
} from "react-native-paper";
import {
	offerTitleKey,
	PhaseOfferBody,
} from "@/components/practice/PhaseOfferBody";
import {
	CARD_TITLE_STYLE,
	TITLE_ONLY_CARD_STYLE,
} from "@/components/ui/card-style";
import type { PhaseOffer, PhaseOfferStatus } from "@/utils/phase-offer";
import type { AdvanceCriterion } from "@/utils/section-progression";

interface PhaseOfferProps {
	offer: PhaseOffer;
	/** Disables both actions while the write is in flight. */
	busy?: boolean;
	onAccept: () => void;
	onDismiss: () => void;
}

function actionLabelKey(offer: PhaseOffer): string {
	return offer.kind === "advance"
		? "screen.practice.phaseOffer.advanceAction"
		: "screen.practice.phaseOffer.demoteAction";
}

/**
 * The standalone-practice surface for a phase nudge: a card above the Done
 * button. See `docs/specs/section-phases.md` §6.1.
 */
export function PhaseOfferCard({
	offer,
	busy,
	onAccept,
	onDismiss,
}: PhaseOfferProps) {
	const { t } = useTranslation();
	const [ready, setReady] = useState(false);
	const onReadyChange = useCallback((v: boolean) => setReady(v), []);

	return (
		<Card mode="contained">
			<Card.Title
				title={t(offerTitleKey(offer))}
				titleStyle={CARD_TITLE_STYLE}
				titleNumberOfLines={2}
				style={TITLE_ONLY_CARD_STYLE}
			/>
			<Card.Content>
				<PhaseOfferBody offer={offer} onReadyChange={onReadyChange} />
				<View className="flex-row gap-2 mt-2">
					<Button
						mode="contained"
						onPress={onAccept}
						disabled={!ready || busy}
						loading={busy}
					>
						{t(actionLabelKey(offer))}
					</Button>
					<Button mode="text" onPress={onDismiss} disabled={busy}>
						{t("screen.practice.phaseOffer.notYet")}
					</Button>
				</View>
			</Card.Content>
		</Card>
	);
}

/**
 * The coach surface: the same body in a dialog fired between the save and the
 * block advancing, mirroring `DurationPromptDialog`.
 */
export function PhaseOfferDialog({
	offer,
	busy,
	onAccept,
	onDismiss,
}: {
	offer: PhaseOffer | null;
	busy?: boolean;
	onAccept: () => void;
	onDismiss: () => void;
}) {
	const { t } = useTranslation();
	const [ready, setReady] = useState(false);
	const onReadyChange = useCallback((v: boolean) => setReady(v), []);

	// Paper's Dialog clones its children to position them, so they have to be
	// `Dialog.*` elements directly — a Fragment wrapper takes the injected
	// `style` prop and React warns. Rendering nothing at all when there is no
	// offer keeps the children unconditional.
	if (!offer) return null;

	return (
		<Portal>
			<Dialog visible onDismiss={onDismiss} dismissable={false}>
				<Dialog.Title>{t(offerTitleKey(offer))}</Dialog.Title>
				<Dialog.Content>
					<PhaseOfferBody offer={offer} onReadyChange={onReadyChange} />
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={onDismiss} disabled={busy}>
						{t("screen.practice.phaseOffer.notYet")}
					</Button>
					<Button
						mode="contained"
						onPress={onAccept}
						disabled={!ready || busy}
						loading={busy}
					>
						{t(actionLabelKey(offer))}
					</Button>
				</Dialog.Actions>
			</Dialog>
		</Portal>
	);
}

/**
 * The passive line shown in the offer's place — one criterion short, or the
 * offer suppressed. §3.6: it never renders when the section is further off than
 * that, because a line that always renders stops being read.
 */
export function PhaseStatusLine({ status }: { status: PhaseOfferStatus }) {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
			{status.kind === "suppressed"
				? t("screen.practice.phaseOffer.status.suppressed")
				: criterionText(status.criterion, t)}
		</Text>
	);
}

type Translate = ReturnType<typeof useTranslation>["t"];

function criterionText(criterion: AdvanceCriterion, t: Translate): string {
	const prefix = "screen.practice.phaseOffer.status";
	switch (criterion.kind) {
		case "no-target":
			return t(`${prefix}.noTarget`);
		case "ht-tempo":
			return criterion.current == null
				? t(`${prefix}.htTempoNone`, {
						required: Math.round(criterion.required),
					})
				: t(`${prefix}.htTempo`, {
						current: criterion.current,
						required: Math.round(criterion.required),
					});
		case "hands-separate":
			return criterion.current == null
				? t(`${prefix}.handsSeparateNone`, {
						mode: t(`screen.practice.modes.hands.${criterion.hands}`),
						required: criterion.required,
					})
				: t(`${prefix}.handsSeparate`, {
						mode: t(`screen.practice.modes.hands.${criterion.hands}`),
						current: criterion.current,
						required: criterion.required,
					});
		case "clean-days":
			return t(`${prefix}.cleanDays`, {
				count: criterion.count,
				required: criterion.required,
			});
		default:
			return t(`${prefix}.bpmTrend`);
	}
}
