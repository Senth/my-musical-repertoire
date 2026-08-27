import { expect, type Page, test } from "@playwright/test";
import { t } from "./support/app";

/**
 * The seven `[test]` acceptance claims of `docs/specs/wip/111-suggest-sections.md`
 * §9 — the two `[eye]` claims are for the browser reviewer, not for a script.
 *
 * Runs on its own throwaway account (`overview-suggestions.setup.ts`), never
 * `SEED_USER` — see `OVERVIEW_AUTH_STATE` in `playwright.config.ts` for why.
 * Tests run in file order, serially: later tests build on pieces the earlier
 * ones created (`piece1Url` and friends), the way `fixture.setup.ts` drives
 * the app instead of writing Firestore directly. Serial mode is required —
 * these tests mutate the same account's practice-today state, and a parallel
 * run would race itself.
 */
test.describe.configure({ mode: "serial" });

const COMPOSER = "E2E Composer";
const PIECE1 = "E2E Stabilizing Solo";
const PIECE2 = "E2E Stabilizing Twin";
const PIECE3 = "E2E Learning Hands";

let piece1Url = "";
let piece2Url = "";
let piece3Url = "";
let piece3SectionId = "";

function interp(
	template: string,
	vars: Record<string, string | number>,
): string {
	return Object.entries(vars).reduce(
		(s, [k, v]) => s.replaceAll(`{{${k}}}`, String(v)),
		template,
	);
}

function barRange(start: number, end: number): string {
	return interp(t("screen.pieceSections.barRange"), { start, end });
}

async function fill(page: Page, label: string, value: string) {
	if (!value) return;
	await page.getByRole("textbox", { name: label, exact: true }).fill(value);
}

async function save(page: Page, label: string) {
	await page.getByRole("button", { name: label, exact: true }).click();
}

async function choose(page: Page, label: string, option: string) {
	await page.getByRole("combobox", { name: label, exact: true }).click();
	await page.getByRole("menuitem", { name: option, exact: true }).click();
	// Paper's Menu fades out, and until it has, its full-screen dismiss scrim
	// still takes the pointer: the next click on Save is either intercepted
	// until the test times out, or spent closing the scrim and never reaches
	// the button, leaving the form unsaved and a later assertion to fail.
	await expect(
		page.getByRole("button", { name: "Close menu", exact: true }),
	).toHaveCount(0, { timeout: 10_000 });
}

/** Creates a piece and lands on its detail page, returning that page's URL. */
async function addPiece(
	page: Page,
	opts: { title: string; state: "learning" | "stabilizing" },
): Promise<string> {
	await page.goto("/piece/add");
	await fill(page, t("screen.addPiece.titleLabel"), opts.title);
	await fill(page, t("screen.addPiece.composerLabel"), COMPOSER);
	await choose(
		page,
		t("screen.addPiece.stateLabel"),
		t(`piece.state.${opts.state}`),
	);
	await save(page, t("screen.addPiece.save"));

	await page.goto("/piece");
	await page.getByText(opts.title, { exact: true }).first().click();
	await expect(
		page.getByText(t("screen.pieceDetail.sections"), { exact: true }),
	).toBeVisible({ timeout: 10_000 });
	return page.url();
}

/** Adds a section to a piece already on screen; returns the new section's id. */
async function addSection(
	page: Page,
	pieceUrl: string,
	opts: {
		label: string;
		phase: "learning" | "stabilizing";
		from: number;
		to: number;
	},
): Promise<string> {
	await page.goto(`${pieceUrl}/section/new`);
	await fill(page, t("screen.pieceSections.form.labelLabel"), opts.label);
	await choose(
		page,
		t("screen.pieceSections.form.phaseLabel"),
		t(`section.phase.${opts.phase}`),
	);
	await fill(
		page,
		t("screen.pieceSections.form.startBarLabel"),
		String(opts.from),
	);
	await fill(page, t("screen.pieceSections.form.endBarLabel"), String(opts.to));
	await save(page, t("screen.pieceSections.form.save"));
	await expect(page.getByText(opts.label, { exact: true })).toBeVisible({
		timeout: 10_000,
	});

	// The id lives in the section's own detail-page URL — click through to read it.
	await page.getByText(opts.label, { exact: true }).click();
	const url = page.url();
	await page.goto(pieceUrl);
	return url.split("/").filter(Boolean).pop() ?? "";
}

const DAY_MS = 86_400_000;

/**
 * Moves the browser's clock two days ahead of the real one, so a log written
 * before the call reads as practised two days ago and one written after it
 * reads as today. `scorableModes` only ever considers a mode that already has
 * history and was not practised today, so proving claim 5 needs one mode
 * sitting in the past — and the app writes `new Date()` at Save time with no
 * UI for a past date, so the clock is the only lever.
 *
 * Forwards, never backwards. Winding the client back puts the emulator's
 * server timestamps in the future, which makes the Firestore SDK log
 * "Detected an update time that is in the future" and raises Expo's dev error
 * toast — an overlay that then swallows the click on Save.
 */
async function twoDaysPass(page: Page) {
	await page.clock.setFixedTime(Date.now() + 2 * DAY_MS);
}

/** Logs a section practice and returns to the comparison screen. */
async function practiceSection(
	page: Page,
	pieceUrl: string,
	sectionId: string,
	opts: {
		mode?: "LH" | "RH";
		bpm?: string;
		quality?: string;
		effort?: string;
	} = {},
) {
	const modeParam = opts.mode ? `&mode=${opts.mode}` : "";
	await page.goto(
		`${pieceUrl}/practice?sectionId=${sectionId}&from=overview${modeParam}`,
	);

	// The hand chips render only once the section itself has loaded, and until
	// then the BPM box is the piece-level one: a value typed before that is
	// dropped when the screen switches to the section's own draft, and the log
	// is saved with no tempo at all.
	await expect(
		page.getByText(t("screen.practice.modes.hands.RH"), { exact: true }),
	).toBeVisible({ timeout: 10_000 });

	if (opts.bpm) {
		await page.getByPlaceholder(t("common.bpm.placeholder")).fill(opts.bpm);
	}
	await page
		.getByRole("button", { name: opts.quality ?? "OK", exact: true })
		.click();
	await page
		.getByRole("button", { name: opts.effort ?? "Med", exact: true })
		.click();
	await save(page, t("screen.practice.save"));
	await expect(
		page.getByRole("button", {
			name: t("screen.practice.comparison.backToOverview"),
			exact: true,
		}),
	).toBeVisible({ timeout: 10_000 });
}

/** Logs a whole-piece practice — enough to clear it from every category. */
async function practiceWholePiece(page: Page, pieceUrl: string) {
	await page.goto(`${pieceUrl}/practice?from=overview`);
	await save(page, t("screen.practice.save"));
	await expect(
		page.getByRole("button", {
			name: t("screen.practice.comparison.backToOverview"),
			exact: true,
		}),
	).toBeVisible({ timeout: 10_000 });
}

/**
 * The overview card containing `uniqueText` (a bar range, never repeated
 * across this suite) — the lowest element that has both the text and a
 * Practice button, i.e. the card itself rather than one of its ancestors.
 */
function cardContaining(page: Page, uniqueText: string) {
	return page
		.locator("div")
		.filter({ hasText: uniqueText })
		.filter({
			has: page.getByRole("button", {
				name: t("screen.overview.practice"),
				exact: true,
			}),
		})
		.last();
}

test("The all-practised message appears only when no suggestion remains", async ({
	page,
}) => {
	test.setTimeout(60_000);
	// This account is otherwise empty — no seeded fixture to neutralize — so
	// one piece, practised, is already the whole repertoire "done for today".
	const soloTitle = "E2E Practised Solo";
	const soloUrl = await addPiece(page, { title: soloTitle, state: "learning" });
	await practiceWholePiece(page, soloUrl);

	await page.goto("/overview");
	await expect(
		page.getByText(t("screen.overview.emptyState.allPracticedToday"), {
			exact: true,
		}),
	).toBeVisible({ timeout: 10_000 });

	const freshTitle = "E2E Fresh Arrival";
	await addPiece(page, { title: freshTitle, state: "learning" });

	await page.goto("/overview");
	await expect(
		page.getByText(t("screen.overview.emptyState.allPracticedToday"), {
			exact: true,
		}),
	).not.toBeVisible({ timeout: 10_000 });
	await expect(page.getByText(freshTitle, { exact: true }).first()).toBeVisible(
		{ timeout: 10_000 },
	);
});

test("A stabilizing piece is suggested by section and the card names that section's bars", async ({
	page,
}) => {
	test.setTimeout(60_000);
	piece1Url = await addPiece(page, { title: PIECE1, state: "stabilizing" });
	await addSection(page, piece1Url, {
		label: "First pass",
		phase: "stabilizing",
		from: 101,
		to: 108,
	});

	await page.goto("/overview");
	await expect(page.getByText(PIECE1, { exact: true }).first()).toBeVisible({
		timeout: 10_000,
	});
	await expect(
		page.getByText(barRange(101, 108), { exact: false }),
	).toBeVisible({ timeout: 10_000 });
	await expect(
		page.getByText(t("section.phase.stabilizing"), { exact: true }).first(),
	).toBeVisible({ timeout: 10_000 });
});

test("Two sections of one piece both appear in Practice Today when no other piece is waiting", async ({
	page,
}) => {
	test.setTimeout(60_000);
	await addSection(page, piece1Url, {
		label: "Second pass",
		phase: "stabilizing",
		from: 140,
		to: 148,
	});

	await page.goto("/overview");
	await expect(page.getByText(PIECE1, { exact: true })).toHaveCount(2, {
		timeout: 10_000,
	});
	await expect(
		page.getByText(barRange(101, 108), { exact: false }),
	).toBeVisible({ timeout: 10_000 });
	await expect(
		page.getByText(barRange(140, 148), { exact: false }),
	).toBeVisible({ timeout: 10_000 });
});

test("A second section of an already-suggested piece yields its slot to an unrepresented piece", async ({
	page,
}) => {
	test.setTimeout(60_000);
	piece2Url = await addPiece(page, { title: PIECE2, state: "stabilizing" });
	await addSection(page, piece2Url, {
		label: "Opening",
		phase: "stabilizing",
		from: 111,
		to: 118,
	});

	await page.goto("/overview");
	await expect(page.getByText(PIECE1, { exact: true })).toHaveCount(1, {
		timeout: 10_000,
	});
	await expect(
		page.getByText(barRange(101, 108), { exact: false }),
	).toBeVisible({ timeout: 10_000 });
	await expect(
		page.getByText(barRange(140, 148), { exact: false }),
	).not.toBeVisible({ timeout: 10_000 });
	await expect(page.getByText(PIECE2, { exact: true }).first()).toBeVisible({
		timeout: 10_000,
	});
	await expect(
		page.getByText(barRange(111, 118), { exact: false }),
	).toBeVisible({ timeout: 10_000 });
});

test("A learning section inside a stabilizing piece is chipped Learning on the overview", async ({
	page,
}) => {
	test.setTimeout(60_000);
	await addSection(page, piece1Url, {
		label: "New passage",
		phase: "learning",
		from: 170,
		to: 174,
	});

	await page.goto("/overview");
	await expect(
		page.getByText(barRange(170, 174), { exact: false }),
	).toBeVisible({ timeout: 10_000 });
	// Scoped to the card: `section.phase.learning` and `piece.state.learning` are
	// both "Learning", so a page-wide match is satisfied by another card's state chip.
	await expect(
		cardContaining(page, barRange(170, 174)).getByText(
			t("section.phase.learning"),
			{ exact: true },
		),
	).toBeVisible({ timeout: 10_000 });
});

test("A section practised left hand today is suggested again the same day for right hand", async ({
	page,
}) => {
	test.setTimeout(90_000);
	piece3Url = await addPiece(page, { title: PIECE3, state: "learning" });
	piece3SectionId = await addSection(page, piece3Url, {
		label: "Coda",
		phase: "learning",
		from: 121,
		to: 128,
	});

	// The right hand was drilled two days ago, the left hand this morning.
	await practiceSection(page, piece3Url, piece3SectionId, {
		mode: "RH",
		bpm: "65",
		quality: "Clean",
		effort: "Easy",
	});
	await twoDaysPass(page);
	await practiceSection(page, piece3Url, piece3SectionId, {
		mode: "LH",
		bpm: "72",
		quality: "Good",
		effort: "Med",
	});

	await page.goto("/overview");
	await expect(
		page.getByText(barRange(121, 128), { exact: false }),
	).toBeVisible({ timeout: 10_000 });
	await expect(
		cardContaining(page, barRange(121, 128)).getByText(
			t("screen.practice.modes.handsLong.RH"),
			{ exact: false },
		),
	).toBeVisible({ timeout: 10_000 });
});

test("The Practice button on a section card opens that section with its scored hand selected", async ({
	page,
}) => {
	test.setTimeout(45_000);
	// A fresh page starts on the real clock, which would put the previous
	// test's right-hand log back in "today" and drop the card off the list.
	await twoDaysPass(page);
	await page.goto("/overview");
	await cardContaining(page, barRange(121, 128))
		.getByRole("button", { name: t("screen.overview.practice"), exact: true })
		.click();

	await expect(page).toHaveURL(/mode=RH/);
	// The BPM prefill arrives with the section's practice history, so it is
	// late rather than absent — every other wait in this file allows 10s.
	await expect(page.getByPlaceholder(t("common.bpm.placeholder"))).toHaveValue(
		"65",
		{ timeout: 10_000 },
	);
});
