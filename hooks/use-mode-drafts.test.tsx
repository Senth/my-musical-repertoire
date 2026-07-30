import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import type {
	ByMode,
	HandsMode,
	ModeKey,
	PracticeDrill,
} from "@/models/practice";
import { useModeDrafts } from "./use-mode-drafts";

interface ProbeProps {
	byMode: ByMode;
	available: HandsMode[];
	drills: PracticeDrill[];
	preselect?: ModeKey | null;
	onKey: (key: ModeKey) => void;
}

function Probe({ byMode, available, drills, preselect, onKey }: ProbeProps) {
	const modes = useModeDrafts({
		byMode,
		available,
		drills,
		effectiveTarget: 100,
		preselect,
		ready: true,
	});
	onKey(modes.currentKey);
	return <Text>probe</Text>;
}

/** LH is far behind the 115 hands-separate target, so it wins the heuristic. */
const BY_MODE: ByMode = {
	LH: { bpm: 60, quality: 3, effort: 3, lastPracticed: new Date("2026-05-01") },
	RH: {
		bpm: 115,
		quality: 5,
		effort: 1,
		lastPracticed: new Date("2026-05-01"),
	},
	"RH.staccato": {
		bpm: 40,
		quality: 2,
		effort: 5,
		lastPracticed: new Date("2026-05-01"),
	},
};

function lastKey(props: Omit<ProbeProps, "onKey">): ModeKey {
	const onKey = jest.fn();
	render(<Probe {...props} onKey={onKey} />);
	return onKey.mock.calls[onKey.mock.calls.length - 1][0];
}

describe("useModeDrafts preselect", () => {
	it("opens on the preselected hands + drill", () => {
		expect(
			lastKey({
				byMode: BY_MODE,
				available: ["LH", "RH"],
				drills: ["staccato"],
				preselect: "RH.staccato",
			}),
		).toBe("RH.staccato");
	});

	it("opens on the preselected hands with the normal drill", () => {
		expect(
			lastKey({
				byMode: BY_MODE,
				available: ["LH", "RH"],
				drills: ["staccato"],
				preselect: "RH",
			}),
		).toBe("RH");
	});

	it("falls back to the heuristic without a preselect", () => {
		expect(
			lastKey({
				byMode: BY_MODE,
				available: ["LH", "RH"],
				drills: ["staccato"],
			}),
		).toBe("LH");
	});

	it("ignores a drill the item no longer offers", () => {
		expect(
			lastKey({
				byMode: BY_MODE,
				available: ["LH", "RH"],
				drills: [],
				preselect: "RH.staccato",
			}),
		).toBe("LH");
	});

	it("ignores a hands mode the item no longer offers", () => {
		expect(
			lastKey({
				byMode: BY_MODE,
				available: ["HT"],
				drills: [],
				preselect: "LH",
			}),
		).toBe("HT");
	});
});
