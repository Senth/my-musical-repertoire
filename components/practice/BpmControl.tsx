import type { MutableRefObject } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { HelperText, SegmentedButtons, TextInput } from "react-native-paper";
import { addTap, bpmFromTaps } from "@/utils/tap-tempo";
import { MetronomeButton } from "./MetronomeButton";

const SIGNATURES = [
	{ key: "fourFour", beats: 4 },
	{ key: "threeFour", beats: 3 },
	{ key: "sixEight", beats: 6 },
	{ key: "twoFour", beats: 2 },
] as const;

type SignatureKey = (typeof SIGNATURES)[number]["key"];

interface BpmControlProps {
	value: string;
	onChangeText: (text: string) => void;
	error: string | null;
	onBlur: () => void;
	stopRef?: MutableRefObject<(() => void) | null>;
}

const BPM_MIN = 20;
const BPM_MAX = 240;

function clamp(n: number): number {
	return Math.max(BPM_MIN, Math.min(BPM_MAX, n));
}

const BTN = { flex: 1, minWidth: 0, paddingHorizontal: 4 } as const;
const GROUP = { flex: 1, minWidth: 0 } as const;
const FULL = { width: "100%" } as const;

export function BpmControl({
	value,
	onChangeText,
	error,
	onBlur,
	stopRef,
}: BpmControlProps) {
	const { t } = useTranslation();
	const parsed = Number.parseInt(value.trim(), 10);
	const isValid = !Number.isNaN(parsed);
	const [signature, setSignature] = useState<SignatureKey>("fourFour");
	const tapsRef = useRef<number[]>([]);

	function adjust(delta: number) {
		if (!isValid) return;
		onChangeText(clamp(parsed + delta).toString());
	}

	function tap() {
		tapsRef.current = addTap(tapsRef.current, Date.now());
		const bpm = bpmFromTaps(tapsRef.current);
		if (bpm !== null) onChangeText(clamp(bpm).toString());
	}

	function halve() {
		if (!isValid) return;
		onChangeText(clamp(Math.round(parsed / 2)).toString());
	}

	function doDouble() {
		if (!isValid) return;
		onChangeText(clamp(parsed * 2).toString());
	}

	const off = !isValid;

	return (
		<View className="gap-4">
			<View className="flex-row items-center gap-4">
				<View className="flex-1">
					<TextInput
						mode="outlined"
						keyboardType="numeric"
						value={value}
						onChangeText={onChangeText}
						placeholder={t("common.bpm.placeholder")}
						error={!!error}
						onBlur={onBlur}
					/>
				</View>
				{stopRef !== undefined && (
					<MetronomeButton
						bpm={value}
						beatsPerBar={
							SIGNATURES.find((s) => s.key === signature)?.beats ?? 4
						}
						disabled={!!error}
						stopRef={stopRef}
					/>
				)}
			</View>
			<View className="flex-row gap-4 w-full">
				<View style={GROUP}>
					<SegmentedButtons
						style={FULL}
						value=""
						onValueChange={(v) => adjust(v === "minus" ? -1 : 1)}
						buttons={[
							{
								value: "minus",
								icon: "chevron-down",
								accessibilityLabel: t("common.bpm.decreaseOne"),
								disabled: off,
								style: BTN,
							},
							{
								value: "plus",
								icon: "chevron-up",
								accessibilityLabel: t("common.bpm.increaseOne"),
								disabled: off,
								style: BTN,
							},
						]}
					/>
				</View>
				<View style={GROUP}>
					<SegmentedButtons
						style={FULL}
						value=""
						onValueChange={(v) => adjust(v === "minus" ? -5 : 5)}
						buttons={[
							{
								value: "minus",
								icon: "chevron-double-down",
								accessibilityLabel: t("common.bpm.decreaseFive"),
								disabled: off,
								style: BTN,
							},
							{
								value: "plus",
								icon: "chevron-double-up",
								accessibilityLabel: t("common.bpm.increaseFive"),
								disabled: off,
								style: BTN,
							},
						]}
					/>
				</View>
				<View style={GROUP}>
					<SegmentedButtons
						style={FULL}
						value=""
						onValueChange={(v) => {
							if (v === "half") halve();
							else if (v === "tap") tap();
							else doDouble();
						}}
						buttons={[
							{
								value: "half",
								label: t("common.bpm.half"),
								disabled: off,
								style: BTN,
							},
							{
								value: "double",
								label: t("common.bpm.double"),
								disabled: off,
								style: BTN,
							},
							{
								value: "tap",
								label: t("common.bpm.tap"),
								accessibilityLabel: t("common.bpm.tapTempo"),
								style: BTN,
							},
						]}
					/>
				</View>
			</View>
			<SegmentedButtons
				style={FULL}
				value={signature}
				onValueChange={(v) => setSignature(v as SignatureKey)}
				buttons={SIGNATURES.map(({ key }) => ({
					value: key,
					label: t(`common.metronome.timeSignatures.${key}`),
					accessibilityLabel: t("common.metronome.timeSignatureA11y", {
						signature: t(`common.metronome.timeSignatures.${key}`),
					}),
					disabled: off,
					style: BTN,
				}))}
			/>
			<HelperText type="error" visible={!!error}>
				{error ?? ""}
			</HelperText>
		</View>
	);
}
