import { render } from "@testing-library/react-native";
import { useState } from "react";
import {
	CoachProvider,
	type PracticeHeading,
	usePracticeHeading,
} from "./CoachContext";

const noop = () => {};
const saveHandlerRef = { current: null };
const validateHandlerRef = { current: null };
const phaseOfferRef = { current: null };

function Harness({
	inCoach,
	title,
	subtitle,
	mounted,
	onHeading,
}: {
	inCoach: boolean;
	title: string;
	subtitle: string | null;
	mounted: boolean;
	onHeading: (heading: unknown) => void;
}) {
	const [heading, setHeading] = useState<PracticeHeading | null>(null);
	onHeading(heading);
	return (
		<CoachProvider
			inCoach={inCoach}
			sessionId={null}
			saveHandlerRef={saveHandlerRef}
			validateHandlerRef={validateHandlerRef}
			phaseOfferRef={phaseOfferRef}
			notify={noop}
			setHeading={setHeading}
			saveAndNext={noop}
			skipBlock={noop}
			extendBlock={noop}
			saving={false}
		>
			{mounted && <Probe title={title} subtitle={subtitle} />}
		</CoachProvider>
	);
}

function Probe({
	title,
	subtitle,
}: {
	title: string;
	subtitle: string | null;
}) {
	usePracticeHeading(title, subtitle);
	return null;
}

describe("usePracticeHeading", () => {
	it("publishes the heading inside the coach", async () => {
		const onHeading = jest.fn();
		await render(
			<Harness
				inCoach
				title="Exposition"
				subtitle="Invention No. 1 · Bach"
				mounted
				onHeading={onHeading}
			/>,
		);
		expect(onHeading).toHaveBeenLastCalledWith({
			title: "Exposition",
			subtitle: "Invention No. 1 · Bach",
		});
	});

	it("swaps the heading when the block body changes", async () => {
		const onHeading = jest.fn();
		const screen = await render(
			<Harness
				inCoach
				title="Exposition"
				subtitle={null}
				mounted
				onHeading={onHeading}
			/>,
		);
		await screen.rerender(
			<Harness
				inCoach
				title="Sight-reading"
				subtitle={null}
				mounted
				onHeading={onHeading}
			/>,
		);
		expect(onHeading).toHaveBeenLastCalledWith({
			title: "Sight-reading",
			subtitle: null,
		});
	});

	it("clears the heading on unmount", async () => {
		const onHeading = jest.fn();
		const screen = await render(
			<Harness
				inCoach
				title="Exposition"
				subtitle={null}
				mounted
				onHeading={onHeading}
			/>,
		);
		await screen.rerender(
			<Harness
				inCoach
				title="Exposition"
				subtitle={null}
				mounted={false}
				onHeading={onHeading}
			/>,
		);
		expect(onHeading).toHaveBeenLastCalledWith(null);
	});

	it("is inert outside the coach", async () => {
		const onHeading = jest.fn();
		await render(
			<Harness
				inCoach={false}
				title="Exposition"
				subtitle={null}
				mounted
				onHeading={onHeading}
			/>,
		);
		expect(onHeading).toHaveBeenLastCalledWith(null);
	});
});
