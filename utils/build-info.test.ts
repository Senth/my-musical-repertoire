const ORIGINAL = process.env.EXPO_PUBLIC_BUILD;

afterEach(() => {
	if (ORIGINAL === undefined) {
		delete process.env.EXPO_PUBLIC_BUILD;
	} else {
		process.env.EXPO_PUBLIC_BUILD = ORIGINAL;
	}
	jest.resetModules();
});

describe("buildId", () => {
	it("is a non-empty string", () => {
		process.env.EXPO_PUBLIC_BUILD = "2026-09-16 · abc1234";
		jest.resetModules();
		const { buildId } = require("./build-info") as { buildId: string };
		expect(typeof buildId).toBe("string");
		expect(buildId.length).toBeGreaterThan(0);
	});

	it("reads the deploy stamp when the variable is set", () => {
		process.env.EXPO_PUBLIC_BUILD = "2026-09-16 · abc1234";
		jest.resetModules();
		const { buildId } = require("./build-info") as { buildId: string };
		expect(buildId).toBe("2026-09-16 · abc1234");
	});

	it("reads dev when the variable is unset", () => {
		delete process.env.EXPO_PUBLIC_BUILD;
		jest.resetModules();
		const { buildId } = require("./build-info") as { buildId: string };
		expect(buildId).toBe("dev");
	});
});
