import { readFile } from "node:fs/promises";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createInstance } from "i18next";
import {
	collectConsoleErrors,
	expectCleanPage,
	expectSignedIn,
	SEED_IDS,
	t,
} from "@/e2e/support/app";
import en from "@/i18n/locales/en-US.json";
import { formatDaysAgo } from "@/utils/date";

test("seeded history shows sight-reading last read and newest entries first", async ({
	page,
}) => {
	const consoleErrors = collectConsoleErrors(page);
	const seededDate = new Date(await readFile(".tmp/e2e/seed-date.txt", "utf8"));
	const nextDay = new Date(seededDate);
	nextDay.setDate(nextDay.getDate() + 1);
	await page.clock.setFixedTime(nextDay);
	const copy = createInstance();
	await copy.init({
		lng: "en-US",
		resources: { "en-US": { translation: en } },
	});
	await page.goto("/technique");
	const historyLink = page.getByRole("link", {
		name: t("screen.sightReadingHistory.entryTitle"),
		exact: true,
	});
	await expect(historyLink).toBeVisible();
	await expect(
		page.getByText(
			t("screen.sightReadingHistory.lastRead").replace(
				"{{when}}",
				formatDaysAgo(
					seededDate,
					copy.t,
					new Date(await page.evaluate(() => Date.now())),
				),
			),
			{ exact: true },
		),
	).toBeVisible();
	await historyLink.click();
	await expect(page).toHaveURL("/sight-reading/history");
	await expect(
		page.getByRole("heading", {
			name: t("screen.history.title"),
			exact: true,
		}),
	).toBeVisible();
	const newest = page
		.getByText(t("technique.keptGoing.5"), { exact: true })
		.last();
	const middle = page.getByText(t("technique.keptGoing.3"), { exact: true });
	const oldest = page.getByText(t("screen.history.notRated"), { exact: true });
	await expect(newest).toBeVisible();
	await expect(middle).toBeVisible();
	await expect(oldest).toBeVisible();
	const newestBox = await newest.boundingBox();
	const middleBox = await middle.boundingBox();
	const oldestBox = await oldest.boundingBox();
	if (!newestBox || !middleBox || !oldestBox)
		throw new Error("Sight-reading history rows not measurable");
	expect(newestBox.y).toBeLessThan(middleBox.y);
	expect(middleBox.y).toBeLessThan(oldestBox.y);
	const chart = page.getByRole("img", { name: /^72 BPM/ });
	await expect(chart).toBeVisible();
	await expect(chart).toHaveAccessibleName(
		/Sight-reading: 0 shaky · 1 some slips · 1 clean · 2 practices$/,
	);
	await expect(chart.locator("line[stroke-dasharray]")).toHaveCount(0);
	await expect(chart.getByText(/^(LH|RH|HT)$/)).toHaveCount(0);
	const summary = page.getByTestId("progress-summary-sight-reading");
	await expect(summary.getByText("72 BPM", { exact: true })).toBeVisible();
	await expect(page.getByText(/to go|target \d/i)).toHaveCount(0);
	for (const label of [
		t("technique.keptGoing.5"),
		t("screen.progressChart.sightReadingAccuracy.slips"),
		t("screen.progressChart.sightReadingAccuracy.shaky"),
	])
		await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
	await expectCleanPage(page);
	expect(consoleErrors).toEqual([]);
});

test("seeded history reads grouped hands, section filters and technique drills without notes", async ({
	page,
}) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 390, height: 900 });
	const consoleErrors = collectConsoleErrors(page);
	const seededDate = new Date(await readFile(".tmp/e2e/seed-date.txt", "utf8"));
	await page.clock.setFixedTime(seededDate);
	await page.goto(`/piece/${SEED_IDS.invention}`);
	await page
		.getByRole("link", { name: t("screen.history.entryTitle"), exact: true })
		.click();
	await expect(page).toHaveURL(`/piece/${SEED_IDS.invention}/history`);
	await expect(
		page.getByRole("heading", { name: t("screen.history.title"), exact: true }),
	).toBeVisible();
	await expect(
		page.getByText(t("screen.history.runThrough"), { exact: true }).first(),
	).toBeVisible();
	const firstDate = new Date(seededDate);
	firstDate.setDate(firstDate.getDate() - 45);
	const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
		firstDate,
	);
	const runThroughChart = page.getByRole("img", {
		name: /^72 BPM whole piece/,
	});
	await expect(runThroughChart).toHaveCount(1);
	const runThroughLabel = `72 BPM whole piece · target 96 · 60 BPM in ${month}. Run-throughs: 1 shaky · 1 some slips · 1 clean · 3 practices`;
	await expect(runThroughChart).toHaveAccessibleName(runThroughLabel);
	const summary = page.getByTestId("progress-summary-run-through");
	await expect(
		summary.getByText("1 shaky · 1 some slips · 1 clean", { exact: true }),
	).toBeVisible();
	await expect(summary.getByText("3 practices", { exact: true })).toBeVisible();
	await expect(runThroughChart.getByText(/^(LH|RH|HT)$/)).toHaveCount(0);
	const segments = runThroughChart.locator("line[stroke-linecap='round']");
	await expect(segments).toHaveCount(2);
	await expect(segments.nth(0)).toHaveAttribute("stroke-width", "4");
	await expect(segments.nth(1)).toHaveAttribute("stroke-width", "2");
	const allChart = await runThroughChart.innerHTML();
	await page
		.getByRole("button", { name: t("screen.history.runThroughs"), exact: true })
		.click();
	await expect(runThroughChart).toHaveAccessibleName(runThroughLabel);
	expect(await runThroughChart.innerHTML()).toBe(allChart);
	await page
		.getByRole("button", { name: t("screen.history.all"), exact: true })
		.click();
	await expect(
		page.getByText(
			t("screen.history.shaky").replace("{{sections}}", "Middle entries"),
			{ exact: true },
		),
	).toBeVisible();
	const exposition = page
		.getByText("Exposition", { exact: true })
		.filter({ visible: true })
		.nth(1)
		.locator("xpath=../..");
	for (const hands of ["LH", "RH", "HT"]) {
		await expect(
			exposition.getByLabel(t(`screen.practice.modes.handsLong.${hands}`), {
				exact: true,
			}),
		).toBeVisible();
	}
	await expect(exposition.getByText("Bars 1–6", { exact: true })).toBeVisible();
	await expect(
		page.getByText(/\bnotes?\b/i).filter({ visible: true }),
	).toHaveCount(0);
	await expectCleanPage(page);
	await page.getByRole("button", { name: "Exposition", exact: true }).click();
	const lead = `80 BPM Left hand · target 96 · 60 BPM in ${month}`;
	const chart = page.getByRole("img", { name: /^\d+ BPM/ });
	await expect(chart).toHaveAccessibleName(
		`${lead}. Left hand: 1 shaky · 1 some slips · 1 clean · 3 practices. Right hand: 0 shaky · 1 some slips · 2 clean · 3 practices. Hands together: 0 shaky · 0 some slips · 1 clean · 1 practice`,
	);
	const leftSummary = page.getByTestId("progress-summary-LH");
	await expect(
		leftSummary.getByText("1 shaky · 1 some slips · 1 clean", { exact: true }),
	).toBeVisible();
	await expect(
		leftSummary.getByText("3 practices", { exact: true }),
	).toBeVisible();
	await page
		.getByRole("button", {
			name: t("screen.progressChart.ranges.1m"),
			exact: true,
		})
		.click();
	await expect(
		leftSummary.getByText("2 practices", { exact: true }),
	).toBeVisible();
	await expect(
		leftSummary.getByText("0 shaky · 1 some slips · 1 clean", { exact: true }),
	).toBeVisible();
	await expectCleanPage(page);
	const middle = page.getByRole("button", {
		name: "Middle entries",
		exact: true,
	});
	const all = page.getByRole("button", {
		name: t("screen.history.all"),
		exact: true,
	});
	await expect(all).toHaveAttribute("aria-pressed", "false");
	await expect(middle).toHaveAttribute("aria-pressed", "false");
	expect(
		await chipFill(
			page.getByRole("button", { name: "Exposition", exact: true }),
		),
	).not.toBe(await chipFill(middle));
	await middle.click();
	await expect(
		page.getByText(t("screen.progressChart.empty"), { exact: true }),
	).toBeVisible();
	await expect(chart).toHaveCount(0);
	await expect(leftSummary).toHaveCount(0);
	await expect(middle).toHaveAttribute("aria-pressed", "true");
	await expect(all).toHaveAttribute("aria-pressed", "false");
	await expect(
		page.getByText("Bars 7–14", { exact: true }).filter({ visible: true }),
	).toBeVisible();
	await expect(
		page
			.getByText(t("screen.history.runThrough"), { exact: true })
			.filter({ visible: true }),
	).toHaveCount(0);
	await expect(
		page.getByText("Bars 1–6", { exact: true }).filter({ visible: true }),
	).toHaveCount(0);
	await expect(
		page
			.getByLabel(t("screen.practice.modes.handsLong.HT"), { exact: true })
			.filter({ visible: true }),
	).toHaveCount(1);
	await expectCleanPage(page);
	await all.click();
	await expect(all).toHaveAttribute("aria-pressed", "true");
	await expect(middle).toHaveAttribute("aria-pressed", "false");
	await page.goto(`/technique/${SEED_IDS.scale}`);
	await page
		.getByRole("link", { name: t("screen.history.entryTitle"), exact: true })
		.click();
	await expect(page).toHaveURL(`/technique/${SEED_IDS.scale}/history`);
	const staccato = page
		.getByText(t("screen.practice.modes.drill.staccato"), { exact: true })
		.filter({ visible: true });
	await expect(staccato).toBeVisible();
	await expect(staccato).toHaveCSS("text-transform", "uppercase");
	for (const hands of ["LH", "RH"]) {
		await expect(
			page
				.getByLabel(t(`screen.practice.modes.handsLong.${hands}`), {
					exact: true,
				})
				.filter({ visible: true }),
		).toHaveCount(2);
	}
	await expect(
		page.getByText(/\bnotes?\b/i).filter({ visible: true }),
	).toHaveCount(0);
	await expectCleanPage(page);
	expect(consoleErrors).toEqual([]);
});

function chipFill(chip: Locator) {
	return chip.evaluate((element) =>
		[element, ...element.querySelectorAll("*")]
			.map((node) => getComputedStyle(node).backgroundColor)
			.find((colour) => colour !== "rgba(0, 0, 0, 0)"),
	);
}

async function saveSection(page: Page, bpm: string) {
	await page
		.getByRole("button", { name: t("common.tempo.editA11y"), exact: true })
		.click();
	await page.getByPlaceholder(t("common.bpm.placeholder")).fill(bpm);
	await page
		.getByRole("button", {
			name: t("technique.qualityShort.3"),
			exact: true,
		})
		.click();
	await page
		.getByRole("button", {
			name: t("technique.effortShort.3"),
			exact: true,
		})
		.click();
	await page
		.getByRole("button", { name: t("screen.practice.save"), exact: true })
		.click();
	await expect(
		page.getByRole("button", {
			name: t("screen.practice.comparison.backToPieces"),
			exact: true,
		}),
	).toBeVisible();
}

test("saved history shows newest entries first and refreshes after another practice", async ({
	page,
}) => {
	test.setTimeout(90_000);
	const consoleErrors = collectConsoleErrors(page);
	const title = "E2E History Piece";
	const section = "E2E History Section";
	await page.goto("/");
	await expectSignedIn(page);
	await page.getByRole("tab", { name: t("screen.pieces.title") }).click();
	await expect(page).toHaveURL("/piece");
	await page
		.getByRole("button", { name: t("screen.pieces.addPiece"), exact: true })
		.first()
		.click();
	await page
		.getByRole("textbox", {
			name: t("screen.addPiece.titleLabel"),
			exact: true,
		})
		.fill(title);
	await page
		.getByRole("textbox", {
			name: t("screen.addPiece.composerLabel"),
			exact: true,
		})
		.fill("E2E History Composer");
	await page
		.getByRole("button", { name: t("screen.addPiece.save"), exact: true })
		.click();
	await expect(page).toHaveURL("/piece");
	await page.getByText(title, { exact: true }).last().click();
	await expect(
		page.getByText(t("screen.pieceDetail.sections"), { exact: true }),
	).toBeVisible();
	const pieceUrl = page.url();
	await page
		.getByRole("button", {
			name: t("screen.pieceDetail.sectionsEmpty.addButton"),
			exact: true,
		})
		.first()
		.click();
	await page
		.getByRole("textbox", {
			name: t("screen.pieceSections.form.labelLabel"),
			exact: true,
		})
		.fill(section);
	await page
		.getByRole("textbox", {
			name: t("screen.pieceSections.form.startBarLabel"),
			exact: true,
		})
		.fill("1");
	await page
		.getByRole("textbox", {
			name: t("screen.pieceSections.form.endBarLabel"),
			exact: true,
		})
		.fill("8");
	await page
		.getByRole("button", {
			name: t("screen.pieceSections.form.save"),
			exact: true,
		})
		.click();
	await page
		.getByRole("button", {
			name: t("section.a11yPractice").replace("{{label}}", section),
			exact: true,
		})
		.click();
	await saveSection(page, "80");
	await page.getByRole("button", { name: "Back", exact: true }).click();
	await expect(page).toHaveURL(pieceUrl);
	await page
		.getByRole("button", {
			name: t("screen.pieceDetail.practice"),
			exact: true,
		})
		.click();
	await page
		.getByRole("button", { name: t("common.tempo.editA11y"), exact: true })
		.click();
	await page.getByPlaceholder(t("common.bpm.placeholder")).fill("88");
	await page
		.getByRole("button", { name: t("screen.practice.save"), exact: true })
		.click();
	await expect(
		page.getByRole("button", {
			name: t("screen.practice.comparison.backToPieces"),
			exact: true,
		}),
	).toBeVisible();
	await page.getByRole("button", { name: "Back", exact: true }).click();
	await page
		.getByRole("link", { name: t("screen.history.entryTitle"), exact: true })
		.filter({ visible: true })
		.click();
	const runThrough = page
		.getByText(t("screen.history.runThrough"), { exact: true })
		.filter({ visible: true });
	const sectionTitles = page
		.getByText(section, { exact: true })
		.filter({ visible: true });
	await expect(runThrough).toBeVisible();
	await expect(sectionTitles).toHaveCount(2);
	await expect(
		sectionTitles
			.last()
			.locator("xpath=../..")
			.getByText("80", { exact: true }),
	).toBeVisible();
	const runBox = await runThrough.boundingBox();
	const sectionBox = await sectionTitles.last().boundingBox();
	if (!runBox || !sectionBox) throw new Error("History rows not measurable");
	expect(runBox.y).toBeLessThan(sectionBox.y);
	await page
		.getByRole("button", { name: t("screen.history.back"), exact: true })
		.click();
	await page
		.getByRole("button", {
			name: t("section.a11yPractice").replace("{{label}}", section),
			exact: true,
		})
		.click();
	await saveSection(page, "96");
	await page.getByRole("button", { name: "Back", exact: true }).click();
	await page
		.getByRole("link", { name: t("screen.history.entryTitle"), exact: true })
		.filter({ visible: true })
		.click();
	await expect(sectionTitles).toHaveCount(3);
	await expect(
		sectionTitles
			.nth(1)
			.locator("xpath=../..")
			.getByText("96", { exact: true }),
	).toBeVisible();
	await expect(
		sectionTitles
			.last()
			.locator("xpath=../..")
			.getByText("80", { exact: true }),
	).toBeVisible();
	const newestBox = await sectionTitles.nth(1).boundingBox();
	const middleBox = await runThrough.boundingBox();
	const oldestBox = await sectionTitles.last().boundingBox();
	if (!newestBox || !middleBox || !oldestBox)
		throw new Error("Refreshed history rows not measurable");
	expect(newestBox.y).toBeLessThan(middleBox.y);
	expect(middleBox.y).toBeLessThan(oldestBox.y);
	expect(consoleErrors).toEqual([]);
});
