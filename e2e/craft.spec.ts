import { expect, type Page, test } from "@playwright/test";
import {
	collectConsoleErrors,
	expectCleanPage,
	ROUTES,
} from "@/e2e/support/app";
import { touchTarget } from "@/theme/tokens";

/**
 * The cross-cutting checks a person would otherwise re-do by eye on every
 * review. Written once, walks every route, and never grows with features —
 * feature behaviour belongs in that feature's own spec.
 *
 * Everything asserted here is off-limits to the browser review, which exists to
 * judge what a machine cannot. If a finding can be measured, it belongs in this
 * file instead.
 */

async function open(page: Page, path: string, ready: string) {
	await page.goto(path);
	await expect(page.getByText(ready, { exact: false }).first()).toBeVisible({
		timeout: 30_000,
	});
}

test.describe("craft", () => {
	for (const { path, ready } of ROUTES) {
		test(`${path} renders clean`, async ({ page, isMobile }) => {
			const consoleErrors = collectConsoleErrors(page);
			await open(page, path, ready);

			await expectCleanPage(page);
			if (isMobile) {
				const viewport = page.viewportSize();
				await page.setViewportSize({
					width: 390,
					height: viewport?.height ?? 844,
				});
				await page.evaluate(
					() =>
						new Promise((done) =>
							requestAnimationFrame(() => requestAnimationFrame(done)),
						),
				);
				await expectCleanPage(page);
			}
			expect(consoleErrors, `console output on ${path}`).toEqual([]);
		});

		test(`${path} keeps touch reach clear`, async ({ page, isMobile }) => {
			test.skip(!isMobile, "Touch reach applies only to phone controls");
			await open(page, path, ready);
			const failures = await page.evaluate((minimum) => {
				const selector =
					"[role=button],[role=link],[role=checkbox],[role=radio],[role=switch],[role=tab],[role=menuitem],a[href],button";
				const controls = [...document.querySelectorAll<HTMLElement>(selector)]
					.filter((element) => {
						if (
							element.getAttribute("aria-disabled") === "true" ||
							element.matches(":disabled") ||
							element.parentElement?.closest(selector) ||
							element.closest('[data-touch-slop="exact"]') ||
							getComputedStyle(element).display === "inline"
						)
							return false;
						const rect = element.getBoundingClientRect();
						if (!rect.width || !rect.height) return false;
						const topmost = document.elementFromPoint(
							rect.x + rect.width / 2,
							rect.y + rect.height / 2,
						);
						return !!topmost && element.contains(topmost);
					})
					.map((element) => ({
						label: element.getAttribute("aria-label") || element.textContent,
						rect: element.getBoundingClientRect(),
					}));
				const failures: string[] = [];
				for (const control of controls) {
					const rect = control.rect;
					const width = Math.max(rect.width, minimum);
					const height = Math.max(rect.height, minimum);
					const left = rect.x - (width - rect.width) / 2;
					const top = rect.y - (height - rect.height) / 2;
					for (const other of controls) {
						const box = other.rect;
						if (
							rect.left < box.right &&
							rect.right > box.left &&
							rect.top < box.bottom &&
							rect.bottom > box.top
						)
							continue;
						if (
							left < box.right &&
							left + width > box.left &&
							top < box.bottom &&
							top + height > box.top
						)
							failures.push(
								`${control.label} touch reach covers ${other.label}`,
							);
					}
				}
				return failures;
			}, touchTarget.minimum);
			expect(failures, `touch reach on ${path}`).toEqual([]);
		});

		test(`${path} has readable contrast`, async ({ page }) => {
			await open(page, path, ready);
			for (const scheme of ["light", "dark"] as const) {
				await page.emulateMedia({ colorScheme: scheme });
				const failures = await page.evaluate(contrastAudit);
				expect(failures, `${scheme} scheme contrast on ${path}`).toEqual([]);
			}
		});
	}
});

/**
 * WCAG AA on every visible run of text: 4.5:1, or 3:1 for large text.
 *
 * Runs in the page because it needs computed styles. Backgrounds are resolved
 * by walking up to the first non-transparent ancestor — a text node's own
 * background is almost always `rgba(0,0,0,0)` in this stack, and comparing
 * against that is how a contrast check quietly passes everything.
 */
function contrastAudit(): string[] {
	type Rgb = [number, number, number, number];

	function parse(color: string): Rgb | null {
		const m = color.match(/rgba?\(([^)]+)\)/);
		if (!m) return null;
		const parts = m[1].split(",").map((p) => Number.parseFloat(p.trim()));
		return [parts[0], parts[1], parts[2], parts[3] ?? 1];
	}

	function channel(v: number): number {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	}

	function luminance([r, g, b]: Rgb): number {
		return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
	}

	function over(fg: Rgb, bg: Rgb): Rgb {
		const a = fg[3];
		return [
			fg[0] * a + bg[0] * (1 - a),
			fg[1] * a + bg[1] * (1 - a),
			fg[2] * a + bg[2] * (1 - a),
			1,
		];
	}

	/**
	 * Composites every translucent layer between the text and the first opaque
	 * ancestor. Stopping at the first non-transparent background instead treats
	 * a 12%-alpha chip tint as if it were solid, and a chip whose text is the
	 * same hue as its tint then reports 1.00:1 — a bug in the audit that looks
	 * exactly like a catastrophic bug in the app.
	 */
	function backgroundOf(el: Element): Rgb {
		const layers: Rgb[] = [];
		let node: Element | null = el;
		while (node) {
			const c = parse(getComputedStyle(node).backgroundColor);
			if (c && c[3] > 0) {
				layers.push(c);
				if (c[3] >= 1) break;
			}
			node = node.parentElement;
		}
		let base: Rgb = [255, 255, 255, 1];
		for (const layer of layers.reverse()) base = over(layer, base);
		return base;
	}

	/**
	 * Icon fonts render glyphs from the private use area as text nodes. They
	 * are images, and WCAG judges them against adjacent colour rather than as
	 * text — not something this audit can decide.
	 */
	function isIconGlyph(text: string): boolean {
		return [...text].every((ch) => {
			const cp = ch.codePointAt(0) ?? 0;
			return (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0xffffd);
		});
	}

	const failures: string[] = [];
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const text = n.textContent?.trim() ?? "";
		if (!text || isIconGlyph(text)) continue;
		const el = n.parentElement;
		if (!el) continue;

		// Decorative content carries no information, so WCAG's text contrast
		// does not apply to it — and `aria-hidden` is the only honest way to
		// say "decorative" rather than to silence a finding.
		if (el.closest('[aria-hidden="true"]')) continue;

		// WCAG 1.4.3 exempts inactive user interface components: a disabled
		// control is dimmed by design, and its label carries no requirement.
		if (el.closest('[aria-disabled="true"], [disabled]')) continue;

		const style = getComputedStyle(el);
		if (style.visibility === "hidden" || style.display === "none") continue;
		if (Number.parseFloat(style.opacity) === 0) continue;
		const box = el.getBoundingClientRect();
		if (box.width === 0 || box.height === 0) continue;

		const fg = parse(style.color);
		if (!fg) continue;
		const bg = backgroundOf(el);
		const composited = over(fg, bg);

		const lighter = Math.max(luminance(composited), luminance(bg));
		const darker = Math.min(luminance(composited), luminance(bg));
		const ratio = (lighter + 0.05) / (darker + 0.05);

		const size = Number.parseFloat(style.fontSize);
		const bold = Number.parseInt(style.fontWeight, 10) >= 700;
		const large = size >= 24 || (bold && size >= 18.66);
		const required = large ? 3 : 4.5;

		if (ratio < required) {
			failures.push(
				`"${text.slice(0, 40)}" ${ratio.toFixed(2)}:1, needs ${required}:1`,
			);
		}
	}
	return failures;
}
