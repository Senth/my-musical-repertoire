import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SegmentedButtons, Text, useTheme } from "react-native-paper";
import { border, radius, size, space, type } from "@/theme/tokens";

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
	// Under the chosen segment the fill wins, so the tick is dropped.
	const showTick = !!previousOption && previousOption.value !== value;

	return (
		<View style={{ gap: space.sm }}>
			<View
				style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm }}
			>
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
			{/* Clipped to the row's own pill so a full-width tick under an end
			    segment stops where that segment's rounded outline does. */}
			<View
				style={{
					width: "100%",
					borderRadius: radius.full,
					overflow: "hidden",
				}}
			>
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
						style: { minWidth: 0 },
						labelStyle: { fontSize: type.labelSmall, marginHorizontal: 0 },
					}))}
				/>
				{showTick && (
					// The previous answer's tick, drawn over the row rather than as the
					// segment's own bottom border: a border would add to that one
					// segment's height and tilt the whole row. The overlay mirrors the
					// row's geometry — one flex cell per segment, same order — so the
					// bar spans exactly its own segment whatever the band measures.
					// Never the accent: the accent means chosen, and the previous
					// answer is not a choice. It takes the marker weight and the text
					// colour because a hairline in `onSurfaceVariant` reads as part of
					// the segment's own outline in dark mode.
					<View
						pointerEvents="none"
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							bottom: border.hairline,
							flexDirection: "row",
						}}
					>
						{options.map((o) => (
							<View key={o.value} style={{ flex: 1 }}>
								{o.value === previousOption?.value && (
									<View
										style={{
											height: size.marker,
											backgroundColor: theme.colors.onSurface,
										}}
									/>
								)}
							</View>
						))}
					</View>
				)}
			</View>
		</View>
	);
}
