import type { BlockExecutionState, PlannedBlock } from "@/models/session";
import { coachSegments } from "./coach-progress";

const block = (allocatedMinutes: number): PlannedBlock => ({
	kind: "repertoire-learning",
	allocatedMinutes,
});

const state = (
	status: BlockExecutionState["status"],
	elapsedSeconds = 0,
	extendMinutes = 0,
): BlockExecutionState => ({ index: 0, status, elapsedSeconds, extendMinutes });

describe("coachSegments", () => {
	it("grows the teal fill inside the allocation while on time", () => {
		const segments = coachSegments([block(5)], [state("in-progress")], 150);
		expect(segments).toEqual([
			{ id: "block-0", state: "on-time", minutes: 5, fill: 0.5, over: 0 },
		]);
	});

	it("stays full teal and starts the amber bar when over-running", () => {
		const segments = coachSegments([block(5)], [state("in-progress")], 420);
		expect(segments).toEqual([
			{ id: "block-0", state: "over-run", minutes: 5, fill: 1, over: 0.4 },
		]);
	});

	it("measures the over-run against the same allocation, capped at the segment", () => {
		const segments = coachSegments([block(5)], [state("in-progress")], 900);
		expect(segments[0]).toMatchObject({ fill: 1, over: 1 });
	});

	it("keeps the whole segment grey when the block was skipped", () => {
		const segments = coachSegments([block(5)], [state("skipped", 0)], 0);
		expect(segments).toEqual([
			{ id: "block-0", state: "skipped", minutes: 5, fill: 0, over: 0 },
		]);
	});

	it("keeps a grey tail when a block finished more than 30s early", () => {
		const segments = coachSegments([block(5)], [state("completed", 240)], 0);
		expect(segments).toEqual([
			{
				id: "block-0",
				state: "finished-early",
				minutes: 5,
				fill: 0.8,
				over: 0,
			},
		]);
	});

	it("reads as on time when the tail is 30s or less", () => {
		const segments = coachSegments([block(5)], [state("completed", 285)], 0);
		expect(segments).toEqual([
			{ id: "block-0", state: "on-time", minutes: 5, fill: 0.95, over: 0 },
		]);
	});

	it("counts the +2 min extension in the segment's real length", () => {
		const segments = coachSegments(
			[block(5)],
			[state("in-progress", 0, 2)],
			360,
		);
		expect(segments).toEqual([
			{ id: "block-0", state: "on-time", minutes: 7, fill: 360 / 420, over: 0 },
		]);
	});

	it("leaves future blocks pending and grey", () => {
		const segments = coachSegments(
			[block(5), block(10)],
			[state("in-progress"), state("pending")],
			60,
		);
		expect(segments[1]).toEqual({
			id: "block-1",
			state: "pending",
			minutes: 10,
			fill: 0,
			over: 0,
		});
	});

	it("weights the segments by their real length", () => {
		const segments = coachSegments(
			[block(5), block(10)],
			[state("completed", 300), state("pending")],
			0,
		);
		expect(segments.map((s) => s.minutes)).toEqual([5, 10]);
	});
});
