import { render } from "@testing-library/react-native";
import "@/i18n";
import { EstimationField } from "./EstimationField";

const OPTIONS = [
	{ value: 1, short: "Lost it", full: "Fell apart" },
	{ value: 2, short: "Rough", full: "Very rough" },
	{ value: 3, short: "OK", full: "Minor slips" },
	{ value: 4, short: "Good", full: "Good" },
	{ value: 5, short: "Clean", full: "Clean" },
];

async function renderField(value: number | null, previous?: number | null) {
	return render(
		<EstimationField
			label="How clean?"
			value={value}
			onChange={jest.fn()}
			options={OPTIONS}
			previous={previous}
		/>,
	);
}

/** The tick is the hairline under the previous segment; nothing else sets a bottom border colour. */
function tickCount(screen: { toJSON: () => unknown }): number {
	return JSON.stringify(screen.toJSON()).split("borderBottomColor").length - 1;
}

describe("EstimationField previous answer", () => {
	it("shows neither the word nor the tick when there is no previous answer", async () => {
		const screen = await renderField(3);
		expect(screen.getByText("Minor slips")).toBeTruthy();
		expect(screen.queryByText(/^· was/)).toBeNull();
		expect(tickCount(screen)).toBe(0);
	});

	it("shows the previous word and the tick when previous differs from chosen", async () => {
		const screen = await renderField(3, 4);
		expect(screen.getByText(/^· was Good$/)).toBeTruthy();
		expect(tickCount(screen)).toBe(1);
	});

	it("drops the tick but keeps the words when previous equals chosen", async () => {
		const screen = await renderField(4, 4);
		expect(screen.getByText(/^· was Good$/)).toBeTruthy();
		expect(tickCount(screen)).toBe(0);
	});

	it("reads the previous answer beside 'not rated yet' before anything is chosen", async () => {
		const screen = await renderField(null, 1);
		expect(screen.getByText(/^· was Fell apart$/)).toBeTruthy();
		expect(tickCount(screen)).toBe(1);
	});
});
