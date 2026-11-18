import { t } from "@/e2e/support/app";
import { expect, test } from "@/e2e/support/test";

test("Status changes keep technique rows mounted and an empty selection matches nothing", async ({
	page,
}) => {
	await page.goto("/technique");
	await expect(
		page.getByText("C major scale, two octaves", { exact: true }),
	).toBeVisible();
	const observation = await page.evaluateHandle(() => {
		const gaps: string[] = [];
		const observer = new MutationObserver(() => {
			if (!document.body.textContent?.includes("C major scale")) {
				gaps.push("Technique row disappeared");
			}
			if (document.querySelector('[role="progressbar"]')) {
				gaps.push("Loading spinner appeared");
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		return { gaps, observer };
	});
	await page
		.getByRole("button", { name: t("common.filter.open"), exact: true })
		.click();
	const sheet = page.getByTestId("modal-surface");
	const retired = sheet.getByRole("button", {
		name: t("technique.state.retired"),
		exact: true,
	});
	await retired.click();
	await retired.click();
	await page
		.getByRole("button", { name: t("common.done"), exact: true })
		.click();
	await expect(
		page.getByText("C major scale, two octaves", { exact: true }),
	).toBeVisible();
	expect(
		await observation.evaluate(({ gaps, observer }) => {
			observer.disconnect();
			return gaps;
		}),
	).toEqual([]);
	await observation.dispose();

	await page
		.getByRole("button", { name: t("common.filter.open"), exact: true })
		.click();
	for (const state of ["not_started", "active", "maintenance"]) {
		await sheet
			.getByRole("button", { name: t(`technique.state.${state}`), exact: true })
			.click();
	}
	await page
		.getByRole("button", { name: t("common.done"), exact: true })
		.click();
	await expect(
		page.getByText(t("screen.techniques.noMatchFilters"), { exact: true }),
	).toBeVisible();
	await expect(
		page.getByText(t("screen.techniques.noTechniques"), { exact: true }),
	).toHaveCount(0);
	await page
		.getByRole("button", {
			name: t("common.filter.clearAllFilters"),
			exact: true,
		})
		.click();
	await expect(
		page.getByText("C major scale, two octaves", { exact: true }),
	).toBeVisible();
});
