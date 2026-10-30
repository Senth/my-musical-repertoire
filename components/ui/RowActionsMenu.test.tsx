import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";

const mockMenuMounts = jest.fn();

jest.mock("react-native-paper", () => {
	const { isValidElement } = require("react");
	const { View } = require("react-native");
	function Menu({
		anchor,
		children,
		visible,
	}: {
		anchor: ReactNode;
		children: ReactNode;
		visible: boolean;
	}) {
		mockMenuMounts(visible);
		return (
			<View>
				{isValidElement(anchor) ? anchor : null}
				{visible ? children : null}
			</View>
		);
	}
	Menu.Item = () => null;
	return { Menu };
});

const props = {
	onDismiss: jest.fn(),
	onPractice: jest.fn(),
	onEdit: jest.fn(),
	onDelete: jest.fn(),
	labels: { practice: "Practice", edit: "Edit", delete: "Delete" },
};

beforeEach(() => jest.clearAllMocks());

it("renders the anchor without mounting a closed Paper Menu that steals focus", async () => {
	const screen = await render(
		<RowActionsMenu {...props} visible={false} anchor={<Text>Options</Text>} />,
	);
	expect(screen.getByText("Options")).toBeTruthy();
	expect(mockMenuMounts).not.toHaveBeenCalled();
});

it("does not mount an unused coordinate menu", async () => {
	await render(
		<RowActionsMenu {...props} visible={false} anchor={{ x: 10, y: 20 }} />,
	);
	expect(mockMenuMounts).not.toHaveBeenCalled();
});

it("mounts open and keeps the same Paper Menu for its intentional close and focus return", async () => {
	const anchor = <View />;
	const screen = await render(
		<RowActionsMenu {...props} visible={false} anchor={anchor} />,
	);
	await screen.rerender(<RowActionsMenu {...props} visible anchor={anchor} />);
	expect(mockMenuMounts).toHaveBeenLastCalledWith(true);
	await screen.rerender(
		<RowActionsMenu {...props} visible={false} anchor={anchor} />,
	);
	expect(mockMenuMounts).toHaveBeenLastCalledWith(false);
});
