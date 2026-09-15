import { act, renderHook } from "@testing-library/react-native";
import type { HandsMode } from "@/models/practice";
import { useModeDrafts } from "./use-mode-drafts";

jest.useFakeTimers();

const base = {
	byMode: null,
	available: ["LH", "RH"] as HandsMode[],
	drills: [],
	effectiveTarget: null,
	ready: true,
};

async function renderClock(clockRunning = true) {
	return await renderHook(
		(running: boolean) => useModeDrafts({ ...base, clockRunning: running }),
		{ initialProps: clockRunning },
	);
}

/** Pushes the fake clock forward so the per-second ticks fire. */
async function advance(ms: number) {
	await act(() => {
		jest.advanceTimersByTime(ms);
	});
}

describe("useModeDrafts clock", () => {
	it("marks a mode touched after 90 s in one pass", async () => {
		const { result } = await renderClock();
		await advance(89_000);
		expect(result.current.dirty.size).toBe(0);
		await advance(1_000);
		expect(result.current.dirty.has("LH")).toBe(true);
	});

	it("marks a mode touched across two visits, and not the other one", async () => {
		const { result } = await renderClock();
		await advance(50_000);
		await act(() => result.current.selectMode("RH"));
		await advance(50_000);
		expect(result.current.dirty.size).toBe(0);
		await act(() => result.current.selectMode("LH"));
		await advance(40_000);
		expect(result.current.dirty.has("LH")).toBe(true);
		expect(result.current.dirty.has("RH")).toBe(false);
	});

	it("never marks a mode that stays under 90 s", async () => {
		const { result } = await renderClock();
		await advance(89_000);
		await act(() => result.current.selectMode("RH"));
		await advance(89_000);
		expect(result.current.dirty.size).toBe(0);
	});

	it("does not count time while the clock is paused", async () => {
		const { result, rerender } = await renderClock(false);
		await advance(100_000);
		expect(result.current.dirty.size).toBe(0);
		await act(() => rerender(true));
		await advance(89_000);
		expect(result.current.dirty.size).toBe(0);
		await advance(1_000);
		expect(result.current.dirty.has("LH")).toBe(true);
	});

	it("leaves an already-rated mode alone", async () => {
		const { result } = await renderClock();
		await act(() => result.current.setQuality(4));
		await act(() => result.current.setEffort(3));
		expect(result.current.dirty.has("LH")).toBe(true);
		await advance(120_000);
		expect(result.current.dirty.size).toBe(1);
		expect(result.current.blockingKey).toBeNull();
		expect(result.current.entries).toHaveLength(1);
	});
});
