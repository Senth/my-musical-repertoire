import { buildFromHtml, isStale, reloadDecision } from "./shell-freshness";

const DEPLOYED =
	'<html><head><meta name="build" content="2026-09-16 · abc1234">';
const RUNNING = "2026-09-16 · abc1234";

describe("buildFromHtml", () => {
	it("reads the build meta tag from an exported page", () => {
		expect(buildFromHtml(DEPLOYED)).toBe(RUNNING);
	});

	it("returns null when the tag is missing", () => {
		expect(buildFromHtml("<html><head><title>app</title></head></html>")).toBe(
			null,
		);
	});

	it("returns null for garbage instead of throwing", () => {
		expect(buildFromHtml("")).toBe(null);
		expect(buildFromHtml("<meta name=build content=no-quotes>")).toBe(null);
	});
});

describe("isStale", () => {
	it("the same build is not stale", () => {
		expect(isStale(RUNNING, RUNNING)).toBe(false);
	});

	it("a different build is stale", () => {
		expect(isStale("2026-01-01 · old1234", RUNNING)).toBe(true);
	});

	it("a build that could not be read is never stale", () => {
		expect(isStale(null, RUNNING)).toBe(false);
	});
});

describe("reloadDecision", () => {
	const base = { bootWindowMs: 10_000, alreadyReloaded: false };

	it("a stale shell inside the boot window reloads itself", () => {
		expect(reloadDecision({ ...base, msSinceBoot: 0 })).toBe("reload");
		expect(reloadDecision({ ...base, msSinceBoot: 9_999 })).toBe("reload");
	});

	it("a stale shell after the window asks instead", () => {
		expect(reloadDecision({ ...base, msSinceBoot: 10_000 })).toBe("prompt");
		expect(reloadDecision({ ...base, msSinceBoot: 600_000 })).toBe("prompt");
	});

	it("already having reloaded beats everything, so a flapping connection stops", () => {
		expect(
			reloadDecision({ ...base, msSinceBoot: 0, alreadyReloaded: true }),
		).toBe("ignore");
	});
});
