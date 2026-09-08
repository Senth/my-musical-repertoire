import type { TFunction } from "i18next";
import { validateBpm, validateDuration } from "./validation";

const t = ((key: string) => key) as unknown as TFunction;

describe("validateBpm", () => {
	it("accepts an empty value as optional", () => {
		expect(validateBpm("", t)).toBeNull();
		expect(validateBpm("   ", t)).toBeNull();
	});

	it("accepts the whole tempo range", () => {
		expect(validateBpm("20", t)).toBeNull();
		expect(validateBpm("120", t)).toBeNull();
		expect(validateBpm("240", t)).toBeNull();
	});

	it("rejects out-of-range and non-numeric input", () => {
		expect(validateBpm("19", t)).toBe("error.bpmInvalid");
		expect(validateBpm("241", t)).toBe("error.bpmInvalid");
		expect(validateBpm("allegro", t)).toBe("error.bpmInvalid");
	});
});

describe("validateDuration", () => {
	it("accepts an empty value as optional", () => {
		expect(validateDuration("", t)).toBeNull();
		expect(validateDuration("   ", t)).toBeNull();
	});

	it("accepts the whole duration range", () => {
		expect(validateDuration("1", t)).toBeNull();
		expect(validateDuration("45", t)).toBeNull();
		expect(validateDuration("600", t)).toBeNull();
	});

	it("rejects out-of-range and non-numeric input", () => {
		expect(validateDuration("0", t)).toBe("error.durationInvalid");
		expect(validateDuration("601", t)).toBe("error.durationInvalid");
		expect(validateDuration("half an hour", t)).toBe("error.durationInvalid");
	});
});
