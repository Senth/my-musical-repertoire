import { fireEvent, render } from "@testing-library/react-native";
import "@/i18n";
import { MissingBarsNotice } from "@/components/piece/MissingBarsNotice";
import { makeSection } from "@/utils/test-factories";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
}));

const opening = makeSection({
	id: "opening",
	pieceId: "invention",
	label: "Exposition",
	state: "stabilizing",
	startBar: 1,
	endBar: 16,
});
const middle = makeSection({
	id: "middle",
	pieceId: "invention",
	label: "Middle entries",
	order: 1,
	state: "stabilizing",
});

it("names missing bars, opens that section, and clears when bars or state change", async () => {
	const screen = await render(
		<MissingBarsNotice pieceId="invention" sections={[opening, middle]} />,
	);
	expect(
		screen.getByText("Combined practice needs bar numbers on Middle entries."),
	).toBeTruthy();
	await fireEvent.press(screen.getByLabelText("Add bars to Middle entries"));
	expect(mockPush).toHaveBeenCalledWith("/piece/invention/section/middle");
	await screen.rerender(
		<MissingBarsNotice
			pieceId="invention"
			sections={[opening, { ...middle, startBar: 17, endBar: 24 }]}
		/>,
	);
	expect(screen.queryByText("Add bars")).toBeNull();
	await screen.rerender(
		<MissingBarsNotice
			pieceId="invention"
			sections={[opening, { ...middle, state: "learning" }]}
		/>,
	);
	expect(screen.queryByText("Add bars")).toBeNull();
});

it("joins multiple names in list order and opens the first missing section", async () => {
	const screen = await render(
		<MissingBarsNotice
			pieceId="invention"
			sections={[middle, { ...opening, startBar: null, endBar: null }]}
		/>,
	);
	expect(
		screen.getByText(
			"Combined practice needs bar numbers on Exposition and Middle entries.",
		),
	).toBeTruthy();
	await fireEvent.press(screen.getByLabelText("Add bars to Exposition"));
	expect(mockPush).toHaveBeenCalledWith("/piece/invention/section/opening");
});

it("shows no notice for an empty list", async () => {
	const screen = await render(
		<MissingBarsNotice pieceId="invention" sections={[]} />,
	);
	expect(screen.queryByText("Add bars")).toBeNull();
});
