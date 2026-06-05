import type { MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { HelperText, SegmentedButtons, TextInput } from "react-native-paper";
import { MetronomeButton } from "./MetronomeButton";

interface BpmControlProps {
	value: string;
	onChangeText: (text: string) => void;
	error: string | null;
	onBlur: () => void;
	stopRef?: MutableRefObject<(() => void) | null>;
	placeholder?: string;
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
	placeholder = "e.g. 72",
}: BpmControlProps) {
	const { t } = useTranslation();
	const parsed = Number.parseInt(value.trim(), 10);
	const isValid = !Number.isNaN(parsed);

	function adjust(delta: number) {
		if (!isValid) return;
		onChangeText(clamp(parsed + delta).toString());
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
						placeholder={placeholder}
						error={!!error}
						onBlur={onBlur}
					/>
				</View>
				{stopRef !== undefined && (
					<MetronomeButton bpm={value} disabled={!!error} stopRef={stopRef} />
				)}
			</View>
			<View className="flex-row gap-4 w-full">
				<View style={GROUP}>
					<SegmentedButtons
						style={FULL}
						value=""
						onValueChange={(v) => adjust(v === "minus" ? -1 : 1)}
						buttons={[
							{ value: "minus", label: "−1", disabled: off, style: BTN },
							{ value: "plus", label: "+1", disabled: off, style: BTN },
						]}
					/>
				</View>
				<View style={GROUP}>
					<SegmentedButtons
						style={FULL}
						value=""
						onValueChange={(v) => adjust(v === "minus" ? -5 : 5)}
						buttons={[
							{ value: "minus", label: "−5", disabled: off, style: BTN },
							{ value: "plus", label: "+5", disabled: off, style: BTN },
						]}
					/>
				</View>
				<View style={GROUP}>
					<SegmentedButtons
						style={FULL}
						value=""
						onValueChange={(v) => {
							if (v === "half") halve();
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
						]}
					/>
				</View>
			</View>
			<HelperText type="error" visible={!!error}>
				{error ?? ""}
			</HelperText>
		</View>
	);
}
