import { expect, test } from "@playwright/test";
import { SEED_IDS, t } from "@/e2e/support/app";

test("touch miss increases tempo but mouse miss does not", async ({
	page,
	isMobile,
}) => {
	test.skip(!isMobile, "Touch reach applies only to phone controls");
	await page.goto(`/piece/${SEED_IDS.nocturne}/practice`);
	const increase = page.getByRole("button", {
		name: t("common.bpm.increaseOne"),
		exact: true,
	});
	const readout = page.getByRole("button", {
		name: t("common.tempo.editA11y"),
		exact: true,
	});
	await expect(increase).toBeEnabled();
	await increase.scrollIntoViewIfNeeded();
	const point = await increase.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		const point = { x: rect.right + 4, y: rect.y + rect.height / 2 };
		const hit = document.elementFromPoint(point.x, point.y);
		if (
			!hit ||
			hit.closest(
				"[role=button],[role=link],[role=checkbox],[role=radio],[role=switch],[role=tab],[role=menuitem],a[href],button,input,textarea,select,[role=slider],[role=textbox],[contenteditable]",
			)
		) {
			throw new Error("Tempo miss point hits another control");
		}
		return point;
	});
	const before = (await readout.textContent()) ?? "";
	await page.mouse.click(point.x, point.y);
	await expect(readout).toHaveText(before);
	await page.touchscreen.tap(point.x, point.y);
	await expect(readout).toHaveText(
		before.replace(/\d+/, (value) => String(Number(value) + 1)),
	);
});

test("touch miss in privacy prose adds no inline link activation", async ({
	page,
	isMobile,
}) => {
	test.skip(!isMobile, "Touch reach applies only to phone controls");
	await page.goto("/privacy");
	await expect(
		page.getByText(t("screen.privacy.title"), { exact: true }),
	).toBeVisible();
	const paragraph = t("screen.privacy.sections.1.paragraphs.1");
	const email = paragraph
		.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]
		.replace(/\.$/, "");
	expect(email).toBeTruthy();
	const link = page.getByRole("link", { name: email, exact: true }).first();
	await link.scrollIntoViewIfNeeded();
	const point = await link.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		const point = { x: rect.left - 12, y: rect.y + rect.height / 2 };
		const hit = document.elementFromPoint(point.x, point.y);
		if (!hit || hit.closest("[role=link],a[href]"))
			throw new Error("Privacy prose point hits a link");
		element.setAttribute("data-test-clicks", "0");
		element.addEventListener("click", () => {
			element.setAttribute(
				"data-test-clicks",
				String(Number(element.getAttribute("data-test-clicks")) + 1),
			);
		});
		return point;
	});
	await page.touchscreen.tap(point.x, point.y);
	await expect(link).toHaveAttribute("data-test-clicks", "0");
	await expect(page).toHaveURL(/\/privacy$/);
});
