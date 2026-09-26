import { render } from "@testing-library/react-native";
import "@/i18n";
import type { StateOffer } from "@/utils/state-offer";
import { initialChecks, StateOfferBody } from "./StateOfferBody";

const HELD_TWO_DAYS_AGO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

function offer(over: Partial<StateOffer> = {}): StateOffer {
	return {
		kind: "advance",
		fromState: "stabilizing",
		toState: "maintenance",
		htBpm: 96,
		cleanDays: 2,
		demoteReason: null,
		cyclingDays: null,
		seamHeldAt: null,
		...over,
	};
}

const CONTINUITY = "It connects cleanly to the section before it";
const MEMORY = "I can play this without the score";

function checkboxState(
	screen: Awaited<ReturnType<typeof render>>,
	label: string,
): { checked: boolean } {
	return screen.getByLabelText(label).props.accessibilityState;
}

describe("StateOfferBody seam pre-tick (#204)", () => {
	it("pre-ticks continuity and says when the join held", async () => {
		const onReadyChange = jest.fn();
		const screen = await render(
			<StateOfferBody
				offer={offer({ seamHeldAt: HELD_TWO_DAYS_AGO })}
				onReadyChange={onReadyChange}
			/>,
		);
		expect(
			screen.getByText("You played this join clean 2 days ago."),
		).toBeTruthy();
		expect(checkboxState(screen, CONTINUITY).checked).toBe(true);
		expect(checkboxState(screen, MEMORY).checked).toBe(false);
		// Not auto-accepted: the memory check is still the student's to tick.
		expect(onReadyChange).toHaveBeenLastCalledWith(false);
	});

	it("leaves both checks unticked without seam evidence", async () => {
		const onReadyChange = jest.fn();
		const screen = await render(
			<StateOfferBody offer={offer()} onReadyChange={onReadyChange} />,
		);
		expect(screen.queryByText(/join clean/)).toBeNull();
		expect(checkboxState(screen, CONTINUITY).checked).toBe(false);
	});

	it("pre-ticks nothing on an offer without a continuity check", async () => {
		const screen = await render(
			<StateOfferBody
				offer={offer({ toState: "stabilizing", seamHeldAt: HELD_TWO_DAYS_AGO })}
				onReadyChange={jest.fn()}
			/>,
		);
		expect(screen.queryByText(/join clean/)).toBeNull();
	});
});

describe("initialChecks", () => {
	it("pre-ticks only continuity, and only on its own evidence", () => {
		expect(initialChecks(offer({ seamHeldAt: HELD_TWO_DAYS_AGO }))).toEqual([
			"continuity",
		]);
		expect(initialChecks(offer())).toEqual([]);
		expect(
			initialChecks(
				offer({ toState: "stabilizing", seamHeldAt: HELD_TWO_DAYS_AGO }),
			),
		).toEqual([]);
	});
});
