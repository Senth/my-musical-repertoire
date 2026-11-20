import type { TFunction } from "i18next";
import { formatDaysAgo, formatDaysAgoForSentence } from "./date";

const t = ((key: string, params?: Record<string, unknown>) =>
	params ? `${key}:${JSON.stringify(params)}` : key) as unknown as TFunction;
const sentenceT = ((key: string) =>
	({
		"common.today": "Today",
		"common.yesterday": "Yesterday",
		"common.daysAgo": "May 12",
	})[key] ?? key) as unknown as TFunction;

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

	it("lowercases relative days in sentences without changing other labels", () => {
		const now = new Date(2026, 5, 15, 12, 0, 0);
		expect(formatDaysAgo(new Date(2026, 5, 15, 8, 0, 0), sentenceT, now)).toBe(
			"Today",
		);
		expect(
			formatDaysAgoForSentence(new Date(2026, 5, 15, 8, 0, 0), sentenceT, now),
		).toBe("today");
		expect(
			formatDaysAgoForSentence(new Date(2026, 5, 14, 8, 0, 0), sentenceT, now),
		).toBe("yesterday");
		expect(
			formatDaysAgoForSentence(new Date(2026, 5, 12, 8, 0, 0), sentenceT, now),
		).toBe("May 12");
	});
});
