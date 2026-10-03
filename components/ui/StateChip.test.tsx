import { fireEvent, render } from "@testing-library/react-native";
import { StateChip } from "@/components/ui/StateChip";
import { space, touchTarget } from "@/theme/tokens";
import { pieceStateVisual } from "@/utils/state-colors";

it.each([
	"learning",
	"shelved",
] as const)("%s has one native touch owner without changing its informational pill", async (state) => {
	const visual = pieceStateVisual(state, false);
	const onPress = jest.fn();
	const hitSlop = {
		top: space.xs,
		bottom: space.md,
		left: space.lg,
		right: space.sm,
	};
	const screen = await render(<StateChip label={state} visual={visual} />);
	const pillStyle = screen.getByTestId("chip-container").props.style;
	expect(screen.queryByRole("button")).toBeNull();
	await screen.rerender(
		<StateChip
			label={state}
			visual={visual}
			onPress={onPress}
			expanded={false}
			hitSlop={hitSlop}
		/>,
	);
	const button = screen.getByRole("button", { name: state });
	expect(screen.getAllByRole("button")).toHaveLength(1);
	expect(button.props.hitSlop).toEqual(hitSlop);
	expect(button).toHaveStyle({ position: "absolute" });
	expect(button).not.toHaveStyle({ minHeight: touchTarget.minimum });
	expect(
		screen.getByTestId("chip-container", { includeHiddenElements: true }).props
			.style,
	).toEqual(pillStyle);
	await fireEvent.press(button);
	expect(onPress).toHaveBeenCalledTimes(1);
	expect(button.props.accessibilityState.expanded).toBe(false);
});
