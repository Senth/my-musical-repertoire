import { render } from "@testing-library/react-native";
import "@/i18n";
import { AddNextSectionNudge } from "./AddNextSectionNudge";

const actions = {
	onAddSection: jest.fn(),
	onNoMoreSections: jest.fn(),
};

describe("AddNextSectionNudge", () => {
	it("offers the first passage without an All sections added decision", async () => {
		const screen = await render(
			<AddNextSectionNudge
				pieceTitle="Nocturne"
				kind="add"
				onAddSection={actions.onAddSection}
			/>,
		);
		expect(screen.getByText("Ready to add the first passage?")).toBeTruthy();
		expect(screen.queryByText("All sections added")).toBeNull();
		expect(screen.getByText("Add section")).toBeTruthy();
	});

	it("keeps the decision for an anchored passage", async () => {
		const screen = await render(
			<AddNextSectionNudge
				pieceTitle="Nocturne"
				sectionLabel="Opening"
				stateLabel="Stabilizing"
				kind="add"
				{...actions}
			/>,
		);
		expect(screen.getByText("Ready for the next passage?")).toBeTruthy();
		expect(screen.getByText("All sections added")).toBeTruthy();
	});
});
