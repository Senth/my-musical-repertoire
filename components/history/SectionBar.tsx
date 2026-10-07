import { View } from "react-native";
import { useAppTheme } from "@/theme";
import { radius, size, space } from "@/theme/tokens";
import type { SectionBarSegment } from "@/utils/section-bar";

export function SectionBar({
	segments,
	accessibilityLabel,
}: {
	segments: readonly SectionBarSegment[];
	accessibilityLabel: string;
}) {
	const theme = useAppTheme();
	if (segments.length === 0) return null;
	return (
		<View
			accessible
			accessibilityLabel={accessibilityLabel}
			style={{
				height: size.track,
				borderRadius: radius.hairline,
				overflow: "hidden",
			}}
		>
			{segments.map((segment, index) => (
				<View
					key={segment.sectionId}
					style={{
						position: "absolute",
						left: `${segment.start * 100}%`,
						width: `${segment.width * 100}%`,
						height: "100%",
						backgroundColor: theme.colors.outlineVariant,
						borderRightWidth: index === segments.length - 1 ? 0 : space.xxs,
						borderRightColor: theme.colors.surface,
					}}
				>
					<View
						style={{
							width: `${segment.fill * 100}%`,
							height: "100%",
							backgroundColor: segment.flagged
								? theme.colors.warning
								: theme.colors.onSurfaceVariant,
						}}
					/>
				</View>
			))}
		</View>
	);
}
