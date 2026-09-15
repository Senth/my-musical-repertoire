import { expect, type Page, test } from "@playwright/test";
import { t } from "./support/app";

/**
 * #182. Rearranging presets by the drag handle reorders the list, and the
 * order survives a reload — the write goes through Firestore, not just the
 * local list state.
 *
 * Pointer-driven, so it runs on the desktop project only: the gesture needs
 * many small mouse moves to win the activation race against the list's scroll
 * handler, which is exactly what the fix gives the pan gesture
 * (`activationDistance`) and what a coarse synthetic drag does not reproduce.
 *
 * The test swaps the first two presets and swaps them back, so a retry starts
 * from the same list it saw the first time.
 */

/** Reads the preset card order off the rendered list. */
async function presetNames(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		// Preset names are user data, so the order is read off the cards
		// themselves. A card's inner row is the div whose two children are the
		// name and the minutes line.
		const minutes = /\d+ min$/;
		return [...document.querySelectorAll("div")]
			.filter(
				(d) =>
					d.children.length === 2 &&
					d.children[1].textContent !== null &&
					minutes.test(d.children[1].textContent),
			)
			.map((d) => d.children[0].textContent ?? "");
	});
}

/** The drag needs continuous movement; one coarse jump never activates. */
async function dragFirstPresetDown(page: Page): Promise<void> {
	const handles = page.getByRole("button", {
		name: t("a11y.drag.reorder"),
	});
	const first = await handles.nth(0).boundingBox();
	const second = await handles.nth(1).boundingBox();
	if (!first || !second) throw new Error("drag handle has no bounding box");
	const x = first.x + first.width / 2;
	const y = first.y + first.height / 2;
	// Drop just past the next card's centre: exactly one slot.
	const dropY = y + (second.y - first.y) + 4;
	await page.mouse.move(x, y);
	await page.mouse.down();
	// Holding is what the reported gesture does ("holding the move button"),
	// and it is load-bearing: the hold lets the list commit its
	// scrollEnabled=false state before the first move, so the pan gesture
	// cannot lose the activation race against the scroll handler.
	await page.waitForTimeout(150);
	await page.mouse.move(x, y + 24, { steps: 5 });
	await page.mouse.move(x, dropY, { steps: 20 });
	await page.mouse.up();
}

test.describe("preset reordering", () => {
	test("dragging a preset's handle moves it down the list", async ({
		page,
	}) => {
		await page.goto("/session/manage-presets");
		const ready = page.getByText(t("screen.session.manage.title"), {
			exact: true,
		});
		await expect(ready).toBeVisible({ timeout: 30_000 });

		const handles = page.getByRole("button", {
			name: t("a11y.drag.reorder"),
		});
		await expect(handles).toHaveCount(4);
		// Cells measure themselves after mount; dragging before that settles
		// activates the gesture against an unmeasured list and no-ops.
		await page.waitForTimeout(500);

		const before = await presetNames(page);
		expect(before.length).toBe(4);

		// The card first springs to its slot, then the write goes through
		// Firestore and the list re-renders — poll, never read once.
		const swapped = [before[1], before[0], before[2], before[3]];
		await dragFirstPresetDown(page);
		await expect
			.poll(() => presetNames(page), { timeout: 10_000 })
			.toEqual(swapped);

		// The order is written through Firestore: it survives a full reload.
		await page.reload();
		await expect(ready).toBeVisible({ timeout: 30_000 });
		await expect
			.poll(() => presetNames(page), { timeout: 10_000 })
			.toEqual(swapped);

		// Put the list back the way the fixture had it.
		await dragFirstPresetDown(page);
		await expect
			.poll(() => presetNames(page), { timeout: 10_000 })
			.toEqual(before);
	});
});
