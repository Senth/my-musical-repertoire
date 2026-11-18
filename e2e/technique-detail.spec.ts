import { expect, test } from "@/e2e/support/test";
import { SEED_IDS, t } from "./support/app";

test("the seeded active scale suggests the first queued technique", async ({
	page,
}) => {
	await page.goto(`/technique/${SEED_IDS.scale}`);
	await expect(
		page.getByRole("button", {
			name: t("screen.techniqueDetail.practice"),
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: t("technique.curriculum.start").replace(
				"{{title}}",
				"G major scale, two octaves",
			),
			exact: true,
		}),
	).toBeVisible();
});
