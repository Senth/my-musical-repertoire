import { expect, type Page, test } from "@playwright/test";
import { t } from "./support/app";

/**
 * Drives the save path landed in phase 4 of #198, on the fixture the plan
 * settled on: a `learning` piece with no target tempo and three
 * never-practised `stabilizing` sections carrying bars. No target passes the
 * readiness gate, never-practised means not practised today, and a null
 * `lastSpanPracticedAt` fires the trigger immediately — see `198-PLAN.md`,
 * "The e2e fixture, and why it is shaped this way".
 *
 * The overview's own "Combined sections" card and its route into this screen
 * are phase 5 (#198 plan). This spec reaches the span route directly with
 * `sectionIds`, exactly as phase 3 made reachable, which is enough to prove
 * every phase 4 acceptance bullet without depending on unshipped phase 5 work.
 */
test.describe.configure({ mode: "serial" });

const COMPOSER = "E2E Span Composer";
const PIECE = "E2E Span Piece";
const SECTION_A = "E2E Span A";
const SECTION_B = "E2E Span B";
const SECTION_C = "E2E Span C";

async function fill(page: Page, label: string, value: string) {
	if (!value) return;
	await page.getByRole("textbox", { name: label, exact: true }).fill(value);
}

async function saveUntilGone(page: Page, label: string): Promise<void> {
	const button = page.getByRole("button", { name: label, exact: true });
	for (let attempt = 0; attempt < 5; attempt++) {
		await button.click({ force: true });
		try {
			await expect(button).toHaveCount(0, { timeout: 5_000 });
			return;
		} catch {
			// Still on the form: the press was swallowed, or the write is slow.
		}
	}
	throw new Error(`"${label}" never left the form after 5 presses`);
}

async function choose(page: Page, label: string, option: string) {
	await page.getByRole("combobox", { name: label, exact: true }).click();
	await page.getByRole("menuitem", { name: option, exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Close menu", exact: true }),
	).toHaveCount(0, { timeout: 10_000 });
}

async function addPiece(page: Page, title: string): Promise<string> {
	await page.goto("/piece");
	await page.goto("/piece/add");
	await fill(page, t("screen.addPiece.titleLabel"), title);
	await fill(page, t("screen.addPiece.composerLabel"), COMPOSER);
	await choose(
		page,
		t("screen.addPiece.stateLabel"),
		t("piece.state.learning"),
	);
	await saveUntilGone(page, t("screen.addPiece.save"));
	await page.getByText(title, { exact: true }).first().click();
	await expect(
		page.getByText(t("screen.pieceDetail.sections"), { exact: true }),
	).toBeVisible({ timeout: 10_000 });
	return page.url();
}

/** Adds a `stabilizing` section with bars, and returns its id. */
async function addSection(
	page: Page,
	pieceUrl: string,
	opts: { label: string; from: number; to: number },
): Promise<string> {
	await page.goto(`${pieceUrl}/section/new`);
	await fill(page, t("screen.pieceSections.form.labelLabel"), opts.label);
	await choose(
		page,
		t("screen.pieceSections.form.stateLabel"),
		t("section.state.stabilizing"),
	);
	await fill(
		page,
		t("screen.pieceSections.form.startBarLabel"),
		String(opts.from),
	);
	await fill(page, t("screen.pieceSections.form.endBarLabel"), String(opts.to));
	await saveUntilGone(page, t("screen.pieceSections.form.save"));
	await expect(page.getByText(opts.label, { exact: true }).first()).toBeVisible(
		{
			timeout: 10_000,
		},
	);

	await page.getByText(opts.label, { exact: true }).first().click();
	const url = page.url();
	await page.goto(pieceUrl);
	return url.split("/").filter(Boolean).pop() ?? "";
}

test("joined-sections span: chips, seams, credit, and no offer", async ({
	page,
}) => {
	// One piece, three sections and a full span save in a single test — more
	// round trips than the default 30s budget comfortably covers under load.
	test.setTimeout(60_000);
	const pieceUrl = await addPiece(page, PIECE);
	const idA = await addSection(page, pieceUrl, {
		label: SECTION_A,
		from: 1,
		to: 20,
	});
	const idB = await addSection(page, pieceUrl, {
		label: SECTION_B,
		from: 21,
		to: 30,
	});
	const idC = await addSection(page, pieceUrl, {
		label: SECTION_C,
		from: 31,
		to: 40,
	});

	await page.goto(
		`${pieceUrl}/practice?sectionIds=${idA},${idB},${idC}&from=overview`,
	);

	// The three chips, in play order.
	await expect(page.getByText(SECTION_A, { exact: true }).first()).toBeVisible({
		timeout: 10_000,
	});
	await expect(
		page.getByText(SECTION_B, { exact: true }).first(),
	).toBeVisible();
	await expect(
		page.getByText(SECTION_C, { exact: true }).first(),
	).toBeVisible();

	// Two seams, both ticked on arrival.
	const seamAbName = t("screen.practice.span.seam.a11yToggle")
		.replace("{{first}}", SECTION_A)
		.replace("{{second}}", SECTION_B);
	const seamBcName = t("screen.practice.span.seam.a11yToggle")
		.replace("{{first}}", SECTION_B)
		.replace("{{second}}", SECTION_C);
	// `Checkbox.Android` has no `aria-checked` on web (react-native-paper),
	// so state reads off its rendered icon glyph instead: the two icons are
	// visually and textually distinct code points.
	const seamAb = page.getByRole("checkbox", { name: seamAbName });
	const seamBc = page.getByRole("checkbox", { name: seamBcName });
	const checkedGlyph = await seamAb
		.locator('[role="img"]')
		.first()
		.textContent({ timeout: 10_000 });
	await expect(seamBc.locator('[role="img"]').first()).toHaveText(
		checkedGlyph ?? "",
	);

	// Break the first join.
	await seamAb.click();
	await expect(seamAb.locator('[role="img"]').first()).not.toHaveText(
		checkedGlyph ?? "",
	);

	// Enter tempo, quality and effort for the preselected (LH) hand.
	await page
		.getByRole("button", { name: t("common.tempo.editA11y"), exact: true })
		.click();
	await page.getByPlaceholder(t("common.bpm.placeholder")).fill("70");
	await page.getByRole("button", { name: "OK", exact: true }).click();
	await page.getByRole("button", { name: "Med", exact: true }).click();

	await page.getByRole("button", { name: t("screen.practice.save") }).click();

	// Neither a state offer nor a status line follows a span save — only the
	// ordinary done screen.
	await expect(
		page.getByRole("button", {
			name: t("screen.practice.comparison.backToOverview"),
			exact: true,
		}),
	).toBeVisible({ timeout: 10_000 });

	// Each section's last-practised moved, including the one untouched by the
	// broken seam (C), and the piece itself now reads practised today.
	await page.goto(pieceUrl);
	await expect(
		page.getByText(
			t("screen.pieceDetail.lastPracticed").replace(
				"{{when}}",
				t("common.today"),
			),
			{ exact: false },
		),
	).toBeVisible({ timeout: 10_000 });
	await expect
		.poll(
			async () => page.getByText(t("common.today"), { exact: false }).count(),
			{ timeout: 10_000 },
		)
		.toBeGreaterThanOrEqual(4);
});
