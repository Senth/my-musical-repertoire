import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import "@/i18n";
import { SectionStateChip } from "@/components/section/SectionStateChip";
import { space } from "@/theme/tokens";

const mockAnchors: ReactNode[] = [];

jest.mock("react-native-paper", () => {
	const actual = jest.requireActual("react-native-paper");
	const { View } = require("react-native");
	function Menu({
		anchor,
		children,
	}: {
		anchor: ReactNode;
		children: ReactNode;
	}) {
		mockAnchors.push(anchor);
		return (
			<View>
				{anchor}
				{children}
			</View>
		);
	}
	Menu.Item = actual.Menu.Item;
	return { ...actual, Menu };
});

const hitSlop = {
	top: space.xs,
	bottom: space.md,
	left: space.lg,
	right: space.sm,
};

it("keeps the open menu's anchor across parent re-renders, so Paper never restarts its open animation", async () => {
	const screen = await render(
		<SectionStateChip
			state="learning"
			onChangeState={() => {}}
			hitSlop={hitSlop}
		/>,
	);
	await fireEvent.press(screen.getByRole("button", { name: "Learning" }));
	await screen.rerender(
		<SectionStateChip
			state="learning"
			onChangeState={() => {}}
			hitSlop={hitSlop}
		/>,
	);
	expect(mockAnchors.length).toBeGreaterThanOrEqual(2);
	expect(mockAnchors.at(-1) === mockAnchors.at(-2)).toBe(true);
});
