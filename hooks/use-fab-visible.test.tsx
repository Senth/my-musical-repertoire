import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { useFabVisible } from "./use-fab-visible";

const mockUseIsFocused = jest.fn();

jest.mock("expo-router", () => ({
	useIsFocused: () => mockUseIsFocused(),
}));

function Probe({ onValue }: { onValue: (v: boolean) => void }) {
	const visible = useFabVisible();
	onValue(visible);
	return <Text>probe</Text>;
}

describe("useFabVisible", () => {
	afterEach(() => mockUseIsFocused.mockReset());

	it("returns true when the screen is focused", async () => {
		mockUseIsFocused.mockReturnValue(true);
		const onValue = jest.fn();
		await render(<Probe onValue={onValue} />);
		expect(onValue).toHaveBeenLastCalledWith(true);
	});

	it("returns false when the screen is not focused", async () => {
		mockUseIsFocused.mockReturnValue(false);
		const onValue = jest.fn();
		await render(<Probe onValue={onValue} />);
		expect(onValue).toHaveBeenLastCalledWith(false);
	});
});
