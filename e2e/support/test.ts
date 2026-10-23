import { test as base, type Page } from "@playwright/test";

export { expect } from "@playwright/test";

async function clientRendered(page: Page): Promise<void> {
	await page.waitForFunction(() => {
		const first = document.getElementById("root")?.firstElementChild;
		return (
			!!first &&
			Object.keys(first).some((key) => key.startsWith("__reactFiber$"))
		);
	});
}

/**
 * Playwright's `test`, with a `page` whose full loads wait for React's first
 * commit. The dev server answers every URL with static HTML and Expo renders
 * over it with createRoot instead of hydrating, so anything a spec finds,
 * types into or clicks before that commit is thrown away with the old DOM.
 */
export const test = base.extend({
	page: async ({ page }, use) => {
		const goto = page.goto.bind(page);
		const reload = page.reload.bind(page);
		page.goto = async (...args) => {
			const response = await goto(...args);
			await clientRendered(page);
			return response;
		};
		page.reload = async (...args) => {
			const response = await reload(...args);
			await clientRendered(page);
			return response;
		};
		await use(page);
	},
});
