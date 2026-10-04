import type { TFunction } from "i18next";
import { sectionRowFacts } from "./section-row";

const t = ((key: string, params?: Record<string, unknown>) =>
	params ? `${key}:${JSON.stringify(params)}` : key) as unknown as TFunction;

type SectionInput = Parameters<typeof sectionRowFacts>[0];

const makeSection = (overrides: Partial<SectionInput> = {}): SectionInput => ({
	startBar: null,
	endBar: null,
	targetBpmOverride: null,
	byMode: { HT: { bpm: 72 } },
	lastPracticed: null,
	...overrides,
});

describe("sectionRowFacts", () => {
	it("formats a bar range with an end", () => {
		expect(
			sectionRowFacts(makeSection({ startBar: 7, endBar: 14 }), 96, t).bars,
		).toBe('screen.pieceSections.barRange:{"start":7,"end":14}');
	});

	it("formats a bar range with only a start", () => {
		expect(sectionRowFacts(makeSection({ startBar: 7 }), 96, t).bars).toBe(
			'screen.pieceSections.barFrom:{"start":7}',
		);
	});

	it("omits bars when there is no start", () => {
		expect(sectionRowFacts(makeSection(), 96, t).bars).toBeNull();
	});

	it("formats current and target tempo", () => {
		expect(sectionRowFacts(makeSection(), 96, t).tempo).toBe(
			'section.tempoOfTarget:{"current":72,"target":96}',
		);
	});

	it("formats current tempo without a target or progress", () => {
		expect(sectionRowFacts(makeSection(), null, t)).toMatchObject({
			tempo: 'screen.pieceSections.bpm:{"bpm":72}',
			progress: null,
		});
	});

	it("omits tempo and progress when current BPM is missing", () => {
		expect(sectionRowFacts(makeSection({ byMode: {} }), 96, t)).toMatchObject({
			tempo: null,
			progress: null,
		});
	});

	it("uses the section target override instead of the piece target", () => {
		expect(
			sectionRowFacts(makeSection({ targetBpmOverride: 80 }), 96, t).tempo,
		).toBe('section.tempoOfTarget:{"current":72,"target":80}');
	});

	it("omits last practiced when section was never practiced", () => {
		expect(sectionRowFacts(makeSection(), 96, t).lastPracticed).toBeNull();
	});

	it("formats today, yesterday, and days ago against the supplied date", () => {
		const now = new Date(2026, 5, 15, 18);
		const facts = (daysAgo: number) =>
			sectionRowFacts(
				makeSection({
					lastPracticed: new Date(2026, 5, 15 - daysAgo, 8),
				}),
				96,
				t,
				now,
			).lastPracticed;

		expect(facts(0)).toBe("common.today");
		expect(facts(1)).toBe("common.yesterday");
		expect(facts(3)).toBe('common.daysAgo:{"count":3}');
	});

	it.each([
		[0.69, "error"],
		[0.7, "warning"],
		[0.89, "warning"],
		[0.9, "success"],
	] as const)("uses %s as %s progress", (ratio, tone) => {
		expect(
			sectionRowFacts(
				makeSection({ byMode: { HT: { bpm: ratio * 100 } } }),
				100,
				t,
			).progress?.tone,
		).toBe(tone);
	});

	it("caps progress fill at one", () => {
		expect(
			sectionRowFacts(makeSection({ byMode: { HT: { bpm: 150 } } }), 100, t)
				.progress?.ratio,
		).toBe(1);
	});

	it("square-root scales progress fill", () => {
		expect(
			sectionRowFacts(makeSection({ byMode: { HT: { bpm: 25 } } }), 100, t)
				.progress?.ratio,
		).toBe(0.5);
	});
});
