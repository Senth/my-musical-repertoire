import { expect, type Page, test } from "@playwright/test";
import { SEED_USER, signIn, t } from "./support/app";

/**
 * Builds `.emulator-seed/` by driving the app, never by writing Firestore
 * directly. Hand-written fixture data drifts from the shapes the app actually
 * produces, and the first thing that notices is a test asserting a field the
 * app stopped writing two months ago.
 *
 * Not part of the suite — run it deliberately against an empty emulator:
 *
 *   scripts/dev-stack.sh down && rm -rf .emulator-seed
 *   scripts/dev-stack.sh up
 *   yarn fixture && yarn emulators:export
 *
 * Everything here is a contract with `e2e/support/app.ts` and with the
 * readiness markers the specs wait on. Changing a title means changing those.
 */

const PIECES = [
	{
		title: "Nocturne in E-flat major",
		composer: "Frédéric Chopin",
		collection: "Nocturnes, Op. 9",
		state: "learning",
		bpm: "132",
		minutes: "5",
		sections: [
			{ label: "A section", phase: "learning", from: "1", to: "16" },
			{ label: "B section", phase: "learning", from: "17", to: "32" },
		],
	},
	{
		title: "Invention No. 1 in C major",
		composer: "Johann Sebastian Bach",
		collection: "Two-Part Inventions",
		state: "stabilizing",
		bpm: "96",
		minutes: "2",
		sections: [
			{ label: "Exposition", phase: "stabilizing", from: "1", to: "6" },
			{ label: "Middle entries", phase: "learning", from: "7", to: "14" },
		],
	},
	{
		title: "Für Elise",
		composer: "Ludwig van Beethoven",
		collection: "",
		state: "maintenance",
		bpm: "120",
		minutes: "4",
		sections: [
			{ label: "Main theme", phase: "maintenance", from: "1", to: "22" },
		],
	},
	{
		// Deliberately sectionless: the add-section nudge and the empty state
		// need a piece that has never been broken up.
		title: "Gymnopédie No. 1",
		composer: "Erik Satie",
		collection: "",
		state: "learning",
		bpm: "60",
		minutes: "4",
		sections: [],
	},
];

const TECHNIQUES = [
	{ title: "C major scale, two octaves", state: "active" },
	{ title: "Hanon No. 1", state: "maintenance" },
];

async function fill(page: Page, label: string, value: string) {
	if (!value) return;
	await page.getByRole("textbox", { name: label, exact: true }).fill(value);
}

async function save(page: Page, label: string) {
	await page.getByRole("button", { name: label, exact: true }).click();
}

async function choose(page: Page, label: string, option: string) {
	await page.getByRole("combobox", { name: label, exact: true }).click();
	// The menu item, not the text inside it: Paper's Menu animates in over a
	// full-bleed overlay, and a click aimed at the label lands on the overlay.
	await page.getByRole("menuitem", { name: option, exact: true }).click();
}

test("build the emulator fixture", async ({ page }) => {
	test.setTimeout(300_000);

	// Register, or sign in when the emulator already carries the account from
	// a half-finished run. Either way the fixture ends up on the same user.
	await page.goto("/");
	await page
		.getByRole("button", {
			name: t("screen.login.switchToRegister"),
			exact: true,
		})
		.click();
	await fill(page, t("screen.login.emailLabel"), SEED_USER.email);
	const secrets = page.locator('input[type="password"]');
	await secrets.nth(0).fill(SEED_USER.password);
	await secrets.nth(1).fill(SEED_USER.password);
	await page
		.getByRole("button", { name: t("screen.login.register"), exact: true })
		.click();

	const overview = page.getByText(t("screen.overview.practiceToday"), {
		exact: true,
	});
	const alreadyRegistered = page.getByText(t("screen.login.error.emailInUse"));
	await expect(overview.or(alreadyRegistered)).toBeVisible({ timeout: 60_000 });
	if (await alreadyRegistered.isVisible()) {
		await signIn(page);
	}
	await expect(overview).toBeVisible({ timeout: 60_000 });

	for (const piece of PIECES) {
		await page.goto("/piece/add");
		await fill(page, t("screen.addPiece.titleLabel"), piece.title);
		await fill(page, t("screen.addPiece.composerLabel"), piece.composer);
		await fill(page, t("screen.addPiece.collectionLabel"), piece.collection);
		await choose(
			page,
			t("screen.addPiece.stateLabel"),
			t(`piece.state.${piece.state}`),
		);
		await fill(page, t("screen.addPiece.targetTempoBpmLabel"), piece.bpm);
		await fill(page, t("screen.addPiece.durationLabel"), piece.minutes);
		await save(page, t("screen.addPiece.save"));

		await page.goto("/piece");
		await page.getByText(piece.title, { exact: true }).first().click();
		await expect(
			page.getByText(t("screen.pieceDetail.sections"), { exact: true }),
		).toBeVisible();
		const pieceUrl = page.url();

		for (const section of piece.sections) {
			await page.goto(`${pieceUrl}/section/new`);
			await fill(
				page,
				t("screen.pieceSections.form.labelLabel"),
				section.label,
			);
			await choose(
				page,
				t("screen.pieceSections.form.phaseLabel"),
				t(`section.phase.${section.phase}`),
			);
			await fill(
				page,
				t("screen.pieceSections.form.startBarLabel"),
				section.from,
			);
			await fill(page, t("screen.pieceSections.form.endBarLabel"), section.to);
			await save(page, t("screen.pieceSections.form.save"));
			await expect(
				page.getByText(section.label, { exact: true }),
			).toBeVisible();
		}
	}

	for (const technique of TECHNIQUES) {
		await page.goto("/technique/add");
		await fill(page, t("screen.addTechnique.titleLabel"), technique.title);
		await choose(
			page,
			t("screen.addTechnique.stateLabel"),
			t(`technique.state.${technique.state}`),
		);
		await save(page, t("screen.addTechnique.save"));
		await page.goto("/technique");
		await expect(
			page.getByText(technique.title, { exact: true }),
		).toBeVisible();
	}
});
