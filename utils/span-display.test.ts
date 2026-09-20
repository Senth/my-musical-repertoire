import { seamBarRange, spanBarRange } from "./span-display";

describe("spanBarRange", () => {
	it("spans first start to last end", () => {
		expect(
			spanBarRange([
				{ startBar: 1, endBar: 16 },
				{ startBar: 17, endBar: 32 },
				{ startBar: 33, endBar: 48 },
			]),
		).toEqual({ startBar: 1, endBar: 48 });
	});

	it("ignores order — takes the overall min and max", () => {
		expect(
			spanBarRange([
				{ startBar: 33, endBar: 48 },
				{ startBar: 1, endBar: 16 },
			]),
		).toEqual({ startBar: 1, endBar: 48 });
	});
});

describe("seamBarRange", () => {
	it("1-16 then 17-32 gives 15-18", () => {
		expect(
			seamBarRange({ startBar: 1, endBar: 16 }, { startBar: 17, endBar: 32 }),
		).toEqual({ startBar: 15, endBar: 18 });
	});

	it("1-20 then 20-30 gives 19-21", () => {
		expect(
			seamBarRange({ startBar: 1, endBar: 20 }, { startBar: 20, endBar: 30 }),
		).toEqual({ startBar: 19, endBar: 21 });
	});

	it("1-20 then 19-30 gives 18-21", () => {
		expect(
			seamBarRange({ startBar: 1, endBar: 20 }, { startBar: 19, endBar: 30 }),
		).toEqual({ startBar: 18, endBar: 21 });
	});

	it("19-30 then 28-35 gives 27-31", () => {
		expect(
			seamBarRange({ startBar: 19, endBar: 30 }, { startBar: 28, endBar: 35 }),
		).toEqual({ startBar: 27, endBar: 31 });
	});
});
