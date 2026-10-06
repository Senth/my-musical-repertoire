import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import "@/i18n";
import { PracticeHeaderMenu } from "./PracticeHeaderMenu";

const mockMenuMounts = jest.fn();

jest.mock("react-native-paper", () => {
	const actual = jest.requireActual("react-native-paper");
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
				{anchor}
				{visible ? children : null}
			</View>
		);
	}
	Menu.Item = actual.Menu.Item;
	return { ...actual, Menu };
});

const labels = { edit: "Edit", delete: "Delete" };

beforeEach(() => mockMenuMounts.mockClear());

it("never mounts a closed Paper Menu, whose hide animation steals focus on web", async () => {
	await render(
		<PracticeHeaderMenu
			onEdit={jest.fn()}
			onDelete={jest.fn()}
			labels={labels}
		/>,
	);
	expect(mockMenuMounts).not.toHaveBeenCalled();
});

it("opens on the anchor and unmounts after an item is chosen", async () => {
	const onEdit = jest.fn();
	const screen = await render(
		<PracticeHeaderMenu onEdit={onEdit} onDelete={jest.fn()} labels={labels} />,
	);
	await fireEvent.press(screen.getByLabelText("More options"));
	expect(mockMenuMounts).toHaveBeenLastCalledWith(true);
	await fireEvent.press(screen.getByText("Edit"));
	expect(onEdit).toHaveBeenCalledTimes(1);
	expect(screen.queryByText("Edit")).toBeNull();
});
