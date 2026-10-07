import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import "@/i18n";
import { ScoreMeter } from "@/components/history/ScoreMeter";
import { lightTheme } from "@/theme";
import { size, space } from "@/theme/tokens";

it.each([
	["quality", 4, "Quality: Minor slips", 4],
	["effort", 5, "Effort: At my limit", 5],
	["technical", 1, "Technical: A slip or two", 4],
	["memory", 4, "Memory: Breaking down throughout", 1],
	["quality", null, "Quality: not rated yet", 0],
	["memory", undefined, "Memory: not rated yet", 0],
] as const)("%s reads %s and fills %s", async (metric, value, label, count) => {
	const screen = await render(
		<PaperProvider theme={lightTheme}>
			<ScoreMeter metric={metric} value={value} />
		</PaperProvider>,
	);
	expect(screen.getByLabelText(label)).toBeTruthy();
	const steps = screen
		.getByLabelText(label)
		.queryAll(
			(view) =>
				view.props.style?.width === space.md &&
				view.props.style?.height === size.track,
		);
	expect(steps).toHaveLength(5);
	expect(
		steps.filter(
			(step) =>
				step.props.style.backgroundColor === lightTheme.colors.onSurfaceVariant,
		),
	).toHaveLength(count);
});
