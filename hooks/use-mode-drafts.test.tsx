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
	carryBpm?: string | null;
	onKey: (key: ModeKey) => void;
	onBpm: (bpm: string) => void;
}

function Probe({
	byMode,
	available,
	drills,
	preselect,
	carryBpm,
	onKey,
	onBpm,
}: ProbeProps) {
	const modes = useModeDrafts({
		byMode,
		available,
		drills,
		effectiveTarget: 100,
		preselect,
		carryBpm,
		ready: true,
	});
	onKey(modes.currentKey);
	onBpm(modes.draft.bpm);
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

async function lastKey(
	props: Omit<ProbeProps, "onKey" | "onBpm">,
): Promise<ModeKey> {
	const onKey = jest.fn();
	await render(<Probe {...props} onKey={onKey} onBpm={() => {}} />);
	return onKey.mock.calls[onKey.mock.calls.length - 1][0];
}

describe("useModeDrafts preselect", () => {
	it("opens on the preselected hands + drill", async () => {
		expect(
			await lastKey({
				byMode: BY_MODE,
				available: ["LH", "RH"],
				drills: ["staccato"],
				preselect: "RH.staccato",
			}),
		).toBe("RH.staccato");
	});

	it("opens on the preselected hands with the normal drill", async () => {
		expect(
			await lastKey({
				byMode: BY_MODE,
				available: ["LH", "RH"],
				drills: ["staccato"],
				preselect: "RH",
			}),
		).toBe("RH");
	});

	it("falls back to the heuristic without a preselect", async () => {
		expect(
			await lastKey({
				byMode: BY_MODE,
				available: ["LH", "RH"],
				drills: ["staccato"],
			}),
		).toBe("LH");
	});

	it("ignores a drill the item no longer offers", async () => {
		expect(
			await lastKey({
				byMode: BY_MODE,
				available: ["LH", "RH"],
				drills: [],
				preselect: "RH.staccato",
			}),
		).toBe("LH");
	});

	it("ignores a hands mode the item no longer offers", async () => {
		expect(
			await lastKey({
				byMode: BY_MODE,
				available: ["HT"],
				drills: [],
				preselect: "LH",
			}),
		).toBe("HT");
	});
});

describe("useModeDrafts carryBpm", () => {
	async function seededBpm(
		props: Omit<ProbeProps, "onKey" | "onBpm">,
	): Promise<{ key: ModeKey; bpm: string }> {
		const onKey = jest.fn();
		const onBpm = jest.fn();
		await render(<Probe {...props} onKey={onKey} onBpm={onBpm} />);
		return {
			key: onKey.mock.calls[onKey.mock.calls.length - 1][0],
			bpm: onBpm.mock.calls[onBpm.mock.calls.length - 1][0],
		};
	}

	it("carries a tempo typed before the section loaded into the opened mode", async () => {
		expect(
			await seededBpm({
				byMode: BY_MODE,
				available: ["LH", "RH"],
				drills: [],
				carryBpm: "72",
			}),
		).toEqual({ key: "LH", bpm: "72" });
	});

	it("seeds from the stored tempo when nothing was typed", async () => {
		expect(
			await seededBpm({ byMode: BY_MODE, available: ["LH", "RH"], drills: [] }),
		).toEqual({ key: "LH", bpm: "60" });
	});
});
