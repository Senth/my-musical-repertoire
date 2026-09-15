import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SegmentedButtons, Text, useTheme } from "react-native-paper";
import { border, type } from "@/theme/tokens";

export interface EstimationOption<V extends string | number> {
	value: V;
	/** Sits on the button. Must stay short enough to fit five segments at 320px. */
	short: string;
	/** Spelled out beside the question once a value is chosen. */
	full: string;
}

interface EstimationFieldProps<V extends string | number> {
	/** The question — "How clean?", never a bare label. */
	label: string;
	/** `null` renders with nothing selected — the student has not rated yet. */
	value: V | null;
	onChange: (value: V) => void;
	/** Ordered worst → best, so the good end is always on the right. */
	options: EstimationOption<V>[];
	/** Last logged answer for this question, when there is one. */
	previous?: V | null;
}

/**
 * One self-estimation group: question with the chosen word beside it, and the
 * five-word row under it. All of them share this component so they stay
 * consistent — same geometry, text-not-numbers labels, best answer on the
 * right.
 */
export function EstimationField<V extends string | number>({
	label,
	value,
	onChange,
	options,
	previous = null,
}: EstimationFieldProps<V>) {
	const { t } = useTranslation();
	const theme = useTheme();
	const selected = options.find((o) => o.value === value);
	const previousOption = options.find((o) => o.value === previous);

	return (
		<View style={{ gap: 8 }}>
			<View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
				<Text variant="labelLarge">{label}</Text>
				<Text
					variant="bodySmall"
					style={{
						color: theme.colors.onSurfaceVariant,
						// Chosen word plus "was <answer>" wraps inside the band instead
						// of pushing the row past a 320px phone.
						flexShrink: 1,
					}}
				>
					{selected?.full ?? t("screen.practice.notRated")}
					{previousOption && (
						<Text>
							{" "}
							{t("screen.practice.previousAnswer", {
								answer: previousOption.full,
							})}
						</Text>
					)}
				</Text>
			</View>
			<SegmentedButtons
				style={{ width: "100%" }}
				value={value?.toString() ?? ""}
				onValueChange={(v) => {
					const match = options.find((o) => o.value.toString() === v);
					if (match) onChange(match.value);
				}}
				buttons={options.map((o) => ({
					value: o.value.toString(),
					label: o.short,
					// Paper floors each segment at minWidth 76 — five of them measure
					// 380px against the 358px band and overflow at 390. minWidth 0
					// lets them flex; 11px is round 8's small-segment size, which
					// fits the words inside the label's max-width.
					style: {
						minWidth: 0,
						// The previous answer's tick: a hairline under its own segment.
						// Muted, never the accent — the accent means chosen, and the
						// previous answer is not a choice. When it sits under the
						// chosen segment the fill wins and the tick is dropped.
						...(previousOption &&
							o.value === previousOption.value &&
							previousOption.value !== value && {
								borderBottomWidth: border.hairline,
								borderBottomColor: theme.colors.onSurfaceVariant,
							}),
					},
					labelStyle: { fontSize: type.labelSmall, marginHorizontal: 0 },
				}))}
			/>
		</View>
	);
}
