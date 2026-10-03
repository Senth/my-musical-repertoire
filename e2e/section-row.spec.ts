import { expect, type Locator, test } from "@playwright/test";
import { collectConsoleErrors, SEED_IDS, t } from "./support/app";

const INVENTION_SECTIONS = [
	{ name: "Exposition", bars: "Bars 1–6" },
	{ name: "Middle entries", bars: "Bars 7–14" },
];

async function chipAppearance(pill: Locator, label: string) {
	return {
		pill: await pill.evaluate((element) => {
			const style = getComputedStyle(element);
			const { width, height } = element.getBoundingClientRect();
			return {
				width,
				height,
				background: style.backgroundColor,
				border: style.border,
				radius: style.borderRadius,
				padding: style.padding,
				margin: style.margin,
			};
		}),
		text: await pill.getByText(label, { exact: true }).evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				color: style.color,
				fontSize: style.fontSize,
				lineHeight: style.lineHeight,
				margin: style.margin,
				padding: style.padding,
			};
		}),
	};
}

test("section row keeps bars beside name and opens practice or edit", async ({
	page,
}) => {
	const consoleErrors = collectConsoleErrors(page);
	const playButton = page.getByRole("button", {
		name: "Practice section Middle entries",
	});
	for (const [colorScheme, containerColor, iconColor] of [
		["light", "rgb(205, 232, 231)", "rgb(5, 42, 42)"],
		["dark", "rgb(38, 67, 67)", "rgb(202, 228, 228)"],
	] as const) {
		await page.emulateMedia({ colorScheme });
		await page.goto(`/piece/${SEED_IDS.invention}`);
		await expect(playButton.locator("xpath=..")).toHaveCSS(
			"background-color",
			containerColor,
		);
		await expect(playButton.getByRole("img")).toHaveCSS("color", iconColor);
	}
	await expect(page.locator("button button")).toHaveCount(0);
	const row = page.getByRole("button", { name: "Middle entries", exact: true });
	const body = row.locator("xpath=..");
	await expect(row.locator('button, [role="button"]')).toHaveCount(0);
	const name = body.getByText("Middle entries");
	const bars = body.getByText("Bars 7–14");
	await expect(row).toBeVisible();
	await expect(bars).toBeVisible();
	for (const section of INVENTION_SECTIONS) {
		await expect(
			page.getByRole("button", { name: section.name, exact: true }),
		).toBeVisible();
		await expect(page.getByText(section.bars, { exact: true })).toBeVisible();
	}
	const nameBox = await name.boundingBox();
	const barsBox = await bars.boundingBox();
	if (!nameBox || !barsBox) throw new Error("Section row text not measurable");
	expect(Math.abs(nameBox.y - barsBox.y)).toBeLessThan(8);
	expect(nameBox.x + nameBox.width).toBeLessThan(barsBox.x);
	const chip = body.getByRole("button", {
		name: t("section.state.learning"),
		exact: true,
	});
	await chip.scrollIntoViewIfNeeded();
	const chipBox = await chip.boundingBox();
	if (!chipBox) throw new Error("Section state control not measurable");
	expect(chipBox.height).toBe(36);
	expect(chipBox.width).toBeGreaterThanOrEqual(48);
	expect(
		await chip.evaluate((element) => {
			const box = element.getBoundingClientRect();
			const hit = document.elementFromPoint(
				box.x + box.width / 2,
				box.y + box.height - 2,
			);
			return { owned: element.contains(hit), hit: hit?.outerHTML };
		}),
	).toMatchObject({ owned: true });
	await page.touchscreen.tap(
		chipBox.x + chipBox.width / 2,
		chipBox.y + chipBox.height - 2,
	);
	await expect(chip).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByText(t("section.state.maintenance"))).toBeVisible();
	expect(consoleErrors).toEqual([]);
	await expect(
		page.getByText(t("screen.pieceSections.editSection")),
	).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(chip).toBeFocused();
	await expect(chip).toHaveCSS("outline-color", "rgb(123, 218, 217)");
	await expect(chip).toHaveCSS("outline-width", "1px");
	await expect(chip).toHaveAttribute("aria-expanded", "false");
	await chip.press("Enter");
	await expect(page.getByRole("menuitem").first()).toBeFocused();
	await expect(chip).toHaveAttribute("aria-expanded", "true");
	await page.keyboard.press("Escape");
	await expect(chip).toBeFocused();
	await chip.press("Space");
	await expect(page.getByRole("menuitem").first()).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(chip).toBeFocused();
	await page
		.getByRole("button", { name: "Practice section Middle entries" })
		.click();
	await expect(page).toHaveURL(/sectionId=seed-invention-middle/);
	await page.goto(`/piece/${SEED_IDS.invention}`);
	const edit = page.getByRole("button", {
		name: "Middle entries",
		exact: true,
	});
	const editBox = await edit.boundingBox();
	const barBox = await page
		.getByText("Bars 7–14", { exact: true })
		.boundingBox();
	if (!editBox || !barBox) throw new Error("Section row body not measurable");
	await edit.click({
		position: {
			x: barBox.x + barBox.width / 2 - editBox.x,
			y: barBox.y + barBox.height / 2 - editBox.y,
		},
	});
	await expect(
		page.getByText(t("screen.pieceSections.editSection")),
	).toBeVisible();
});

for (const [width, colorScheme] of [
	[412, "light"],
	[1280, "dark"],
] as const) {
	test(`section indicator and native-column chip edges respond independently at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ colorScheme });
		const consoleErrors = collectConsoleErrors(page);
		const label = t("section.state.learning");
		await page.goto(`/piece/${SEED_IDS.gymnopedie}`);
		const informationalPill = page
			.getByTestId("chip-container")
			.filter({ hasText: label })
			.first();
		await expect(informationalPill).toBeVisible();
		const informationalAppearance = await chipAppearance(
			informationalPill,
			label,
		);
		expect(informationalAppearance.pill.height).toBe(20);
		expect(informationalAppearance.text.margin).toBe("2px 12px");
		await page.goto(`/piece/${SEED_IDS.invention}/practice`);
		await page.getByRole("button", { name: "Some" }).first().click();
		const flag = page.getByRole("checkbox", {
			name: "Flag section Middle entries as problematic",
		});
		const body = flag.locator("xpath=..");
		const indicator = body.getByRole("checkbox", {
			name: "",
			exact: true,
			disabled: true,
		});
		await indicator.scrollIntoViewIfNeeded();
		const indicatorBox = await indicator.boundingBox();
		if (!indicatorBox) throw new Error("Section flag indicator not measurable");
		const tap = async (x: number, y: number) => {
			if (width === 412) await page.touchscreen.tap(x, y);
			else await page.mouse.click(x, y);
		};
		await expect(flag).not.toBeChecked();
		await tap(
			indicatorBox.x + indicatorBox.width / 2,
			indicatorBox.y + indicatorBox.height / 2,
		);
		await expect(flag).toBeChecked();
		await tap(
			indicatorBox.x + indicatorBox.width / 2,
			indicatorBox.y + indicatorBox.height / 2,
		);
		await expect(flag).not.toBeChecked();
		const chip = body.getByRole("button", {
			name: t("section.state.learning"),
			exact: true,
		});
		await body.getByTestId("chip-container").evaluate((container) => {
			container.style.flexDirection = "column";
		});
		await chip.scrollIntoViewIfNeeded();
		const pill = body.getByTestId("chip-container");
		expect(await chipAppearance(pill, label)).toEqual(informationalAppearance);
		await expect(chip.locator('button, [role="button"]')).toHaveCount(0);
		const chipBox = await chip.boundingBox();
		const pillBox = await pill.boundingBox();
		if (!chipBox || !pillBox)
			throw new Error("Section state control not measurable");
		expect(chipBox.height).toBe(36);
		expect(chipBox.width).toBeGreaterThanOrEqual(48);
		expect(chipBox.width).toBe(pillBox.width + 24);
		expect(chipBox.x).toBe(pillBox.x - 16);
		expect(chipBox.y).toBe(pillBox.y - 4);
		const bottom = chipBox.y + chipBox.height - 2;
		expect(bottom).toBeGreaterThan(pillBox.y + pillBox.height);
		for (const [x, y] of [
			[chipBox.x + chipBox.width / 2, bottom],
			[chipBox.x + 1, bottom],
			[chipBox.x + chipBox.width - 1, chipBox.y + 1],
			[pillBox.x + 1, pillBox.y + 1],
		]) {
			expect(
				await chip.evaluate(
					(button, point) =>
						button.contains(document.elementFromPoint(point.x, point.y)),
					{ x, y },
				),
			).toBe(true);
			await tap(x, y);
			await expect(
				page.getByText(t("section.state.maintenance")),
			).toBeVisible();
			await expect(flag).not.toBeChecked();
			await expect(
				page.getByText(t("screen.pieceSections.editSection")),
			).toHaveCount(0);
			await expect(page).toHaveURL(`/piece/${SEED_IDS.invention}/practice`);
			await page.keyboard.press("Escape");
		}
		const nameBox = await body
			.getByText("Middle entries", { exact: true })
			.boundingBox();
		const barsBox = await body
			.getByText("Bars 7–14", { exact: true })
			.boundingBox();
		if (!nameBox || !barsBox)
			throw new Error("Section row text not measurable");
		for (const box of [nameBox, barsBox]) {
			await tap(box.x + box.width / 2, box.y + box.height - 1);
			await expect(flag).toBeChecked();
			await expect(chip).toHaveAttribute("aria-expanded", "false");
			await tap(
				indicatorBox.x + indicatorBox.width / 2,
				indicatorBox.y + indicatorBox.height / 2,
			);
			await expect(flag).not.toBeChecked();
		}
		expect(consoleErrors).toEqual([]);
	});
}

for (const width of [412, 1280]) {
	test(`invisible section targets leave compact detail geometry unchanged at ${width}px`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto(`/piece/${SEED_IDS.invention}`);
		const edit = page.getByRole("button", {
			name: "Middle entries",
			exact: true,
		});
		const body = edit.locator("xpath=..");
		const pill = body.getByTestId("chip-container");
		const chip = body.getByRole("button", {
			name: t("section.state.learning"),
			exact: true,
		});
		await chip.scrollIntoViewIfNeeded();
		const metrics = async () => ({
			row: await edit.boundingBox(),
			name: await body
				.getByText("Middle entries", { exact: true })
				.boundingBox(),
			bars: await body.getByText("Bars 7–14", { exact: true }).boundingBox(),
			pill: await pill.boundingBox(),
			play: await page
				.getByRole("button", { name: "Practice section Middle entries" })
				.boundingBox(),
			previous: await page
				.getByRole("button", { name: "Exposition", exact: true })
				.boundingBox(),
		});
		const interactive = await metrics();
		const hitBox = await chip.boundingBox();
		await testInfo.attach("compact-section-geometry", {
			body: JSON.stringify({ interactive, hitBox }, null, 2),
			contentType: "application/json",
		});
		await page.screenshot({
			path: testInfo.outputPath(`detail-${width}.png`),
			fullPage: true,
		});
		await chip.evaluate((button) => {
			const pill = button.parentElement?.querySelector(
				'[data-testid="chip-container"]',
			);
			if (pill && button.contains(pill)) button.replaceWith(pill);
			else button.remove();
		});
		expect(await metrics()).toEqual(interactive);
		const { row, pill: pillBox, name, previous } = interactive;
		if (!row || !pillBox || !name || !previous)
			throw new Error("Section row geometry not measurable");
		expect(row.height).toBe(72);
		expect(pillBox.height).toBe(20);
		expect(pillBox.y - name.y - name.height).toBe(4);
		expect(row.y - previous.y).toBe(72);
		expect(pillBox.x).toBe(name.x);
		if (width === 412) {
			expect(name.x).toBe(16);
			expect(name.y).toBe(492);
			expect(pillBox.y).toBe(520);
		}
	});
}

test("section hit expansion stops before notes without changing their compact line gap", async ({
	page,
}) => {
	await page.goto(`/piece/${SEED_IDS.nocturne}`);
	const edit = page.getByRole("button", { name: "B section", exact: true });
	const body = edit.locator("xpath=..");
	const chip = body.getByRole("button", {
		name: t("section.state.learning"),
		exact: true,
	});
	const pill = body.getByTestId("chip-container");
	const notes = body.getByText("Keep the left hand quiet.", { exact: true });
	await chip.scrollIntoViewIfNeeded();
	const hitBox = await chip.boundingBox();
	const pillBox = await pill.boundingBox();
	const notesBox = await notes.boundingBox();
	if (!hitBox || !pillBox || !notesBox)
		throw new Error("Section notes not measurable");
	expect(hitBox.height).toBe(28);
	expect(notesBox.y - pillBox.y - pillBox.height).toBe(4);
	expect(hitBox.y + hitBox.height).toBe(notesBox.y);
	await page.touchscreen.tap(
		hitBox.x + hitBox.width - 1,
		hitBox.y + hitBox.height - 1,
	);
	await expect(chip).toHaveAttribute("aria-expanded", "true");
	await page.keyboard.press("Escape");
	await page.touchscreen.tap(notesBox.x + 1, notesBox.y + 1);
	await expect(
		page.getByText(t("screen.pieceSections.editSection")),
	).toBeVisible();
});

for (const colorScheme of ["light", "dark"] as const) {
	for (const fixture of [
		{
			piece: SEED_IDS.invention,
			section: "Middle entries",
			sectionId: "seed-invention-middle",
			notes: null,
		},
		{
			piece: SEED_IDS.nocturne,
			section: "B section",
			sectionId: "seed-nocturne-b",
			notes: "Keep the left hand quiet.",
		},
	]) {
		test(`normal practice rejects adjusted touchscreen taps outside ${fixture.section} chip in ${colorScheme}`, async ({
			page,
		}) => {
			await page.setViewportSize({ width: 412, height: 900 });
			await page.emulateMedia({ colorScheme });
			const consoleErrors = collectConsoleErrors(page);
			const path = `/piece/${fixture.piece}/practice`;
			await page.goto(path);
			const play = page.getByRole("button", {
				name: `Practice section ${fixture.section}`,
				exact: true,
			});
			const row = play.locator("xpath=../..");
			const chip = row.getByRole("button", {
				name: t("section.state.learning"),
				exact: true,
			});
			await chip.scrollIntoViewIfNeeded();
			await expect(
				page.getByRole("checkbox", { name: /Flag section/ }),
			).toHaveCount(0);
			const hitBox = await chip.boundingBox();
			const nameBox = await row
				.getByText(fixture.section, { exact: true })
				.boundingBox();
			if (!hitBox || !nameBox)
				throw new Error("Section state control not measurable");
			expect(hitBox.height).toBe(fixture.notes ? 28 : 36);
			const outside = [1, 5].map((inset) => ({
				x: nameBox.x + nameBox.width / 2,
				y: nameBox.y + nameBox.height - inset,
			}));
			if (fixture.notes) {
				const notesBox = await row
					.getByText(fixture.notes, { exact: true })
					.boundingBox();
				if (!notesBox) throw new Error("Section notes not measurable");
				expect(hitBox.y + hitBox.height).toBe(notesBox.y);
				outside.unshift(
					...[1, 5].map((inset) => ({
						x: notesBox.x + 30,
						y: notesBox.y + inset,
					})),
				);
			}
			for (const point of outside) {
				expect(
					await chip.evaluate(
						(element, point) =>
							element.contains(document.elementFromPoint(point.x, point.y)),
						point,
					),
				).toBe(false);
				await page.mouse.click(point.x, point.y);
				await expect(chip).toHaveAttribute("aria-expanded", "false");
				await page.touchscreen.tap(point.x, point.y);
				await expect(chip).toHaveAttribute("aria-expanded", "false");
				await expect(page.getByRole("menuitem")).toHaveCount(0);
				await expect(page).toHaveURL(path);
			}
			await chip.evaluate((element) => (element as HTMLElement).click());
			await expect(chip).toHaveAttribute("aria-expanded", "true");
			const firstItem = page.getByRole("menuitem").first();
			await expect(firstItem).toBeFocused();
			await page
				.getByRole("menuitem", {
					name: t("section.state.learning"),
					exact: true,
				})
				.click();
			await expect(chip).toHaveAttribute("aria-expanded", "false");
			await expect(chip).toBeFocused();
			await chip.press("Enter");
			await expect(chip).toHaveAttribute("aria-expanded", "true");
			await expect(firstItem).toBeFocused();
			await page.keyboard.press("Escape");
			await expect(chip).toBeFocused();
			await chip.press("Space");
			await expect(chip).toHaveAttribute("aria-expanded", "true");
			await expect(firstItem).toBeFocused();
			await page.keyboard.press("Escape");
			await expect(chip).toBeFocused();
			for (const [x, y] of [
				[hitBox.x + 1, hitBox.y + 1],
				[hitBox.x + hitBox.width - 1, hitBox.y + 1],
				[hitBox.x + 1, hitBox.y + hitBox.height - 1],
				[hitBox.x + hitBox.width - 1, hitBox.y + hitBox.height - 1],
				[hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height - 1],
			]) {
				await page.touchscreen.tap(x, y);
				await expect(chip).toHaveAttribute("aria-expanded", "true");
				await expect(firstItem).toBeFocused();
				await page.keyboard.press("Escape");
				await expect(chip).toBeFocused();
			}
			await expect(
				page.getByText(t("screen.pieceSections.editSection")),
			).toHaveCount(0);
			await play.tap();
			await expect(page).toHaveURL(
				`${path}?sectionId=${fixture.sectionId}&from=overview`,
			);
			await expect(page.getByRole("menuitem")).toHaveCount(0);
			expect(consoleErrors).toEqual([]);
		});
	}
}

test("whole-piece practice flags only when asked and keeps run-through checkboxes", async ({
	page,
}) => {
	const consoleErrors = collectConsoleErrors(page);
	await page.goto(`/piece/${SEED_IDS.invention}/practice`);
	for (const section of INVENTION_SECTIONS) {
		const playLabel = t("section.a11yPractice").replace(
			"{{label}}",
			section.name,
		);
		const playButton = page.getByRole("button", {
			name: playLabel,
			exact: true,
		});
		await expect(playButton).toBeVisible();
		const row = playButton.locator("xpath=../..");
		await expect(row.getByText(section.name, { exact: true })).toBeVisible();
		await expect(row.getByText(section.bars, { exact: true })).toBeVisible();
		await expect(row).not.toContainText(/\/ 96 BPM/);
	}
	await expect(
		page.getByRole("checkbox", { name: /Flag section/ }),
	).toHaveCount(0);
	await page.getByRole("button", { name: "Some" }).first().click();
	const flag = page.getByRole("checkbox", {
		name: "Flag section Middle entries as problematic",
	});
	await expect(flag).not.toBeChecked();
	await flag
		.locator("xpath=../..")
		.getByRole("button", { name: t("section.state.learning"), exact: true })
		.click();
	await expect(page.getByText(t("section.state.maintenance"))).toBeVisible();
	await expect(flag).not.toBeChecked();
	expect(consoleErrors).toEqual([]);
	await page.keyboard.press("Escape");
	await flag.click();
	await expect(flag).toBeChecked();
	const flagBox = await flag.boundingBox();
	const barsBox = await flag
		.locator("xpath=..")
		.getByText("Bars 7–14")
		.boundingBox();
	if (!flagBox || !barsBox) throw new Error("Section flag body not measurable");
	await flag.click({
		position: {
			x: barsBox.x + barsBox.width / 2 - flagBox.x,
			y: barsBox.y + barsBox.height / 2 - flagBox.y,
		},
	});
	await expect(flag).not.toBeChecked();
	await expect(
		page.getByRole("button", { name: "Practice section Middle entries" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: t("screen.pieceSections.addSection") }),
	).toBeVisible();
	await page.goto(`/piece/${SEED_IDS.furElise}/practice`);
	await expect(
		page.getByRole("checkbox", {
			name: "Flag section Main theme as problematic",
		}),
	).toBeVisible();
	await expect(
		page.getByText(t("screen.practice.sectionsPanel.headerRunThrough")),
	).toBeVisible();
});

test("section state menu survives rapid Escape and immediate reopen", async ({
	page,
}) => {
	await page.setViewportSize({ width: 412, height: 900 });
	const consoleErrors = collectConsoleErrors(page);
	for (const path of [
		`/piece/${SEED_IDS.invention}`,
		`/piece/${SEED_IDS.invention}/practice`,
	]) {
		await page.goto(path);
		if (path.endsWith("/practice"))
			await page.getByRole("button", { name: "Some" }).first().click();
		const chip = page
			.getByRole("button", { name: t("section.state.learning"), exact: true })
			.last();
		await chip.scrollIntoViewIfNeeded();
		const box = await chip.boundingBox();
		if (!box) throw new Error("Section state control not measurable");
		const firstItem = page.getByRole("menuitem").first();
		const backdrop = page.getByRole("button", { name: "Close menu" });
		const menuOpacity = () =>
			firstItem.evaluate((element) => {
				let opacity = 1;
				for (
					let node: Element | null = element;
					node;
					node = node.parentElement
				)
					opacity *= Number(getComputedStyle(node).opacity);
				return opacity;
			});
		const expectOpen = async () => {
			await expect(chip).toHaveAttribute("aria-expanded", "true");
			await expect.poll(menuOpacity).toBe(1);
			await expect(firstItem).toBeFocused();
		};
		const expectClosed = async () => {
			await expect(chip).toHaveAttribute("aria-expanded", "false");
			await expect(firstItem).toHaveCount(0);
			await expect(backdrop).toHaveCount(0);
			await expect(chip).toBeFocused();
		};
		for (const activation of ["touch", "Enter", "Space"] as const) {
			const open = async () => {
				if (activation === "touch")
					await page.touchscreen.tap(
						box.x + box.width / 2,
						box.y + box.height - 2,
					);
				else await page.keyboard.press(activation);
			};
			await chip.focus();
			await open();
			await expect.poll(menuOpacity, { intervals: [16] }).toBeGreaterThan(0);
			await page.keyboard.press("Escape");
			await open();
			await expectOpen();
			for (let cycle = 0; cycle < 3; cycle++) {
				await page.keyboard.press("Escape");
				await open();
				await expectOpen();
			}
			await page.keyboard.press("Escape");
			await expectClosed();
		}
		await page.keyboard.press("Enter");
		await expectOpen();
		await page.keyboard.press("Tab");
		await expect(page.getByRole("menuitem").nth(1)).toBeFocused();
		await page.keyboard.press("Enter");
		await expectClosed();
		await page.keyboard.press("Space");
		await expectOpen();
		await backdrop.click({ position: { x: 1, y: 1 } });
		await expectClosed();
		if (path.endsWith("/practice"))
			await expect(
				page.getByRole("checkbox", {
					name: "Flag section Middle entries as problematic",
				}),
			).not.toBeChecked();
		else {
			await page
				.getByRole("button", { name: "Middle entries", exact: true })
				.click();
			await expect(
				page.getByText(t("screen.pieceSections.editSection")),
			).toBeVisible();
		}
	}
	expect(consoleErrors).toEqual([]);
});
