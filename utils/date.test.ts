import type { TFunction } from "i18next";
import { formatDaysAgo } from "./date";

const t = ((key: string, params?: Record<string, unknown>) =>
	params ? `${key}:${JSON.stringify(params)}` : key) as unknown as TFunction;

describe("formatDaysAgo", () => {
	afterEach(() => jest.useRealTimers());

	it("says never for a missing date", () => {
		expect(formatDaysAgo(null, t)).toBe("common.neverPracticed");
		expect(formatDaysAgo(undefined, t)).toBe("common.neverPracticed");
	});

	it("says today within the same calendar day", () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date(2026, 5, 15, 18, 0, 0));
		expect(formatDaysAgo(new Date(2026, 5, 15, 8, 0, 0), t)).toBe(
			"common.today",
		);
	});

	it("says yesterday one day back", () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date(2026, 5, 15, 0, 30, 0));
		expect(formatDaysAgo(new Date(2026, 5, 14, 10, 0, 0), t)).toBe(
			"common.yesterday",
		);
	});

	it("counts days beyond yesterday", () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
		expect(formatDaysAgo(new Date(2026, 5, 12, 12, 0, 0), t)).toBe(
			'common.daysAgo:{"count":3}',
		);
	});
});
