import { render } from "@testing-library/react-native";
import "@/i18n";
import { size } from "@/theme/tokens";
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

/** The tick is the only bar drawn at the marker weight; the segments carry no other fixed height. */
function tickCount(screen: { toJSON: () => unknown }): number {
	return (
		JSON.stringify(screen.toJSON()).split(`"height":${size.marker}`).length - 1
	);
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

	it("draws the tick without a border, so no segment grows taller", async () => {
		const screen = await renderField(3, 4);
		expect(JSON.stringify(screen.toJSON())).not.toContain("borderBottomWidth");
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
