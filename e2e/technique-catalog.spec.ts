import { expect, test } from "@/e2e/support/test";
import { catalogEntries } from "@/utils/technique-catalog";
import { expectSignedIn, t } from "./support/app";

test.use({ storageState: { cookies: [], origins: [] } });

function copy(
	key: string,
	values: Record<string, string | number> = {},
): string {
	return Object.entries(values).reduce(
		(text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
		t(key),
	);
}

const entries = catalogEntries();
const titles = entries.map((entry) => copy(entry.titleKey, entry.titleParams));

test("catalog adds scales, links one near match, and fills the curriculum", async ({
	page,
}) => {
	test.setTimeout(120_000);
	const email = `technique-catalog-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
	const password = "practice123";

	await page.goto("/");
	await page
		.getByRole("button", {
			name: t("screen.login.switchToRegister"),
			exact: true,
		})
		.click();
	await page
		.getByRole("textbox", { name: t("screen.login.emailLabel"), exact: true })
		.fill(email);
	const passwords = page.locator('input[type="password"]');
	await passwords.nth(0).fill(password);
	await passwords.nth(1).fill(password);
	await page
		.getByRole("button", { name: t("screen.login.register"), exact: true })
		.click();
	await expectSignedIn(page);

	await page.goto("/technique");
	await expect(
		page.getByText(t("screen.techniques.noTechniques"), { exact: true }),
	).toBeVisible();
	await page
		.getByRole("button", {
			name: t("screen.techniques.addTechnique"),
			exact: true,
		})
		.first()
		.click();
	await page
		.getByRole("textbox", {
			name: t("screen.addTechnique.titleLabel"),
			exact: true,
		})
		.fill("F maj");
	await page
		.getByRole("combobox", {
			name: t("screen.addTechnique.typeLabel"),
			exact: true,
		})
		.click();
	await page
		.getByRole("menuitem", { name: t("technique.type.scale"), exact: true })
		.click();
	await page
		.getByRole("button", { name: t("screen.addTechnique.save"), exact: true })
		.click();
	await expect(page.getByText("F maj", { exact: true })).toBeVisible();

	await page.getByLabel(t("a11y.fab.addTechnique"), { exact: true }).click();
	await page
		.getByRole("button", {
			name: t("technique.catalog.pageTitle"),
			exact: true,
		})
		.click();
	const search = page.getByLabel(t("technique.catalog.searchPlaceholder"), {
		exact: true,
	});
	await search.fill("C major");
	await expect(page.getByText("C major scale", { exact: true })).toBeVisible();
	await page
		.getByRole("button", {
			name: copy("technique.catalog.add", { title: "C major scale" }),
			exact: true,
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: t("technique.catalog.menu.start"),
		})
		.click();
	await expect(
		page
			.getByText("C major scale", { exact: true })
			.locator("xpath=../..")
			.getByText(t("technique.state.active"), { exact: true })
			.last(),
	).toBeVisible();
	await expect(
		page.getByText(t("technique.catalog.inYourList"), { exact: true }),
	).toBeVisible();

	await search.fill("");
	await page
		.getByRole("button", {
			name: copy("technique.catalog.addAll", { count: titles.length - 1 }),
			exact: true,
		})
		.click();
	await expect(
		page.getByText(
			copy("technique.catalog.confirm.title", {
				currentTitle: "F maj",
				catalogTitle: "F major scale",
			}),
			{ exact: true },
		),
	).toBeVisible();
	await page
		.getByRole("button", {
			name: copy("technique.catalog.confirm.keep", {
				currentTitle: "F maj",
			}),
			exact: true,
		})
		.click();
	await expect(page.getByRole("button", { name: /^Add all \d+$/ })).toHaveCount(
		0,
		{ timeout: 30_000 },
	);

	await page
		.getByRole("button", { name: t("common.back"), exact: true })
		.click();
	await expect(page.getByText("F maj", { exact: true })).toBeVisible();
	const aMajorScale = entries.find((entry) => entry.key === "scale.major.A");
	if (!aMajorScale) throw new Error("A major scale missing from catalog");
	const aMajorTitle = copy(aMajorScale.titleKey, aMajorScale.titleParams);
	await page
		.getByPlaceholder(t("screen.techniques.searchPlaceholder"), { exact: true })
		.fill(aMajorTitle);
	const aMajorRow = page
		.getByText(aMajorTitle, { exact: true })
		.locator("xpath=../..");
	await expect(
		aMajorRow
			.getByText(t("technique.state.not_started"), { exact: true })
			.last(),
	).toBeVisible();

	await page
		.getByPlaceholder(t("screen.techniques.searchPlaceholder"), { exact: true })
		.fill("");
	await page.getByLabel(t("a11y.fab.addTechnique"), { exact: true }).click();
	await page
		.getByRole("button", {
			name: t("technique.catalog.pageTitle"),
			exact: true,
		})
		.click();
	await expect(page.getByRole("button", { name: /^Add all \d+$/ })).toHaveCount(
		0,
	);
});
