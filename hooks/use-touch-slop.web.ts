import { useEffect } from "react";
import { pickTouchTarget } from "@/utils/touch-slop";

const CANDIDATES =
	"[role=button],[role=link],[role=checkbox],[role=radio],[role=switch],[role=tab],[role=menuitem],a[href],button";
const INTERACTIVE = `${CANDIDATES},input,textarea,select,[role=slider],[role=textbox],[contenteditable]`;

export function useTouchSlop(): void {
	useEffect(() => {
		if (typeof document === "undefined") return;
		let pointerType = "";
		const onPointerDown = (event: PointerEvent) => {
			pointerType = event.pointerType;
		};
		const onClick = (event: MouseEvent) => {
			if (!event.isTrusted) return;
			const touch = pointerType === "touch";
			pointerType = "";
			if (
				!touch ||
				!(event.target instanceof Element) ||
				event.target.closest(INTERACTIVE)
			) {
				return;
			}

			const candidates: HTMLElement[] = [];
			const rects: DOMRect[] = [];
			for (const element of document.querySelectorAll<HTMLElement>(
				CANDIDATES,
			)) {
				if (
					element.getAttribute("aria-disabled") === "true" ||
					element.matches(":disabled") ||
					element.parentElement?.closest(CANDIDATES) ||
					element.closest('[data-touch-slop="exact"]') ||
					getComputedStyle(element).display === "inline"
				) {
					continue;
				}
				const rect = element.getBoundingClientRect();
				if (!rect.width || !rect.height) continue;
				const topmost = document.elementFromPoint(
					rect.x + rect.width / 2,
					rect.y + rect.height / 2,
				);
				if (!topmost || !element.contains(topmost)) continue;
				candidates.push(element);
				rects.push(rect);
			}
			const winner = pickTouchTarget(
				{ x: event.clientX, y: event.clientY },
				rects,
			);
			if (winner !== undefined) candidates[winner].click();
		};

		document.addEventListener("pointerdown", onPointerDown, true);
		document.addEventListener("click", onClick, true);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown, true);
			document.removeEventListener("click", onClick, true);
		};
	}, []);
}
