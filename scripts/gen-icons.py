#!/usr/bin/env python3
"""Regenerates the app icon SVG and every rasterized icon target.

Run from the repo root: `python3 scripts/gen-icons.py` (needs rsvg-convert).

The clef outlines below were extracted once from the Noto Music font glyphs
U+1D11E (G clef) and U+1D121 (C clef) via `inkscape --export-text-to-path`, so
neither this script nor the generated SVG depends on a font being installed.
"""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / ".tmp/icons"

PURPLE = "#7B1FA2"
WHITE = "#FFFFFF"
INK = "#1F1235"

# --- glyph source data (design units, matching the paths below) --------------
GCLEF_BOX = (130.0, -100.4, 366.6, 1039.2)  # x, y, w, h
CCLEF_BOX = (130.0, 92.8, 404.4, 613.2)

GCLEF_D = (
    "m 288.4,219.4 q -8.4,-31.8 -13.8,-63 -5.4,-31.2 -5.4,-63.6 0,-28.2 3.6,-52.8 4.2,-25.2 11.4,-46.2 7.8,-24 20.4,-45 12.6,-21.6 26.4,-35.4 14.4,-13.8 25.2,-13.8 14.4,0 39.6,51 12.6,25.8 18.6,55.8 6,30 6,64.2 0,42.6 -11.4,85.2 -11.4,42 -33.6,79.2 -21.6,37.2 -52.2,65.4 l 21,100.8 q 9,-1.2 15,-1.8 6,-0.6 9,-0.6 36.6,0 65.4,21 28.8,20.4 45.6,54 17.4,33.6 17.4,73.8 0,46.2 -24,83.4 -23.4,36.6 -70.8,54 3,10.2 17.4,85.2 3.6,18 5.4,28.2 1.8,10.8 2.4,18.6 0.6,7.8 0.6,18 0,30 -15,53.4 -14.4,24 -39.6,37.2 -24.6,13.2 -55.2,13.2 -31.2,0 -55.2,-12 -24,-11.4 -37.8,-32.4 Q 211,874 211,847 q 0,-28.8 15.6,-48 16.2,-19.2 45.6,-19.2 25.2,0 40.8,18 16.2,18.6 16.2,43.8 0,21.6 -15,37.8 -15,16.2 -39,16.2 h -6 q 15.6,23.4 49.2,23.4 41.4,0 64.8,-27 23.4,-27 23.4,-69 0,-10.2 -2.4,-27.6 -2.4,-16.8 -8.4,-40.8 -6,-24 -9.6,-39.6 -3,-15.6 -4.2,-22.2 -20.4,6 -48,6 -51.6,0 -100.8,-30 -48,-30 -75.6,-79.2 Q 130,540.4 130,483.4 q 0,-54 24.6,-101.4 24.6,-47.4 60.6,-87 36.6,-39.6 73.2,-75.6 z m 16.2,-15 q 13.8,-7.2 29.4,-26.4 15.6,-19.8 30,-45 14.4,-25.2 23.4,-50.4 9,-25.8 9,-46.2 0,-21.6 -6.6,-34.2 -6.6,-12.6 -22.8,-12.6 -14.4,0 -28.2,13.2 -13.2,13.2 -24,35.4 -10.2,21.6 -16.2,48.6 -6,27 -6,55.2 0,19.2 3.6,34.8 4.2,15.6 8.4,27.6 z m 34.2,268.2 q -16.2,3.6 -30.6,15.6 -14.4,11.4 -23.4,28.2 -8.4,16.2 -8.4,34.8 0,15 7.8,31.2 7.8,15.6 19.2,25.2 7.8,7.2 15.6,10.8 9,4.2 9,7.8 0,1.8 -6,3.6 -22.8,-5.4 -41.4,-20.4 -18,-15 -28.8,-36 -10.2,-21.6 -10.2,-45.6 0,-25.8 10.2,-49.8 10.8,-24 29.4,-43.2 19.2,-19.2 43.2,-28.8 L 307,315.4 q -69.6,56.4 -102.6,111 -32.4,54 -32.4,107.4 0,39 20.4,72.6 20.4,33.6 55.8,54.6 35.4,20.4 79.8,20.4 12,0 24,-2.4 12.6,-2.4 26.4,-6 z M 397,667 Q 455.8,641.8 455.8,563.8 455.8,538 442.6,517 429.4,495.4 407.2,482.8 385,470.2 357.4,470.2 Z"
)
CCLEF_D = (
    "M 235.6,700 V 100 h 22.2 v 294 q 10.8,-5.4 22.8,-21.6 12,-16.2 22.8,-37.2 10.8,-21.6 18.6,-42.6 7.8,-21.6 9.6,-37.8 6,41.4 24.6,65.4 18.6,23.4 45.6,23.4 27,0 40.2,-22.2 13.8,-22.2 13.8,-86.4 0,-25.8 -1.8,-43.8 -1.2,-18.6 -4.8,-30 -7.8,-26.4 -24.6,-37.2 -16.8,-11.4 -42.6,-11.4 -13.8,0 -21.6,6 -7.8,5.4 -7.8,10.8 0,4.2 4.2,10.2 4.2,6 9,12 10.2,12 10.2,22.2 0,14.4 -10.8,26.4 -10.2,11.4 -30,11.4 -18,0 -30,-12.6 -11.4,-13.2 -11.4,-31.2 0,-22.2 14.4,-39 15,-16.8 38.4,-26.4 24,-9.6 51.6,-9.6 38.4,0 69,18 30.6,18 48.6,49.8 18.6,31.8 18.6,73.2 0,25.8 -6,47.4 -5.4,21.6 -17.4,39 -16.2,22.8 -41.4,36 -25.2,12.6 -53.4,12.6 -13.2,0 -27.6,-3 -13.8,-3.6 -26.4,-10.2 L 334,400 l 28.2,44.4 q 13.8,-5.4 28.2,-8.4 14.4,-3 28.8,-3 33,0 58.8,18.6 26.4,18.6 41.4,49.2 15,30.6 15,67.8 0,37.2 -18,69 -18,31.2 -48.6,49.8 -30.6,18.6 -69.6,18.6 -50.4,0 -77.4,-19.8 -27,-20.4 -27,-55.2 0,-18 11.4,-30.6 12,-13.2 30,-13.2 19.8,0 30,12 10.8,11.4 10.8,25.8 0,11.4 -10.2,22.2 -5.4,6 -9.6,11.4 -3.6,5.4 -3.6,10.2 0,7.2 7.8,12.6 7.8,4.8 21.6,4.8 37.2,0 55.8,-27 19.2,-27.6 19.2,-90.6 0,-55.2 -12.6,-83.4 -12.6,-28.8 -42.6,-28.8 -27.6,0 -45.6,23.4 -18,23.4 -23.4,64.2 -5.4,-29.4 -16.8,-57 -11.4,-27.6 -26.4,-49.2 -15,-21.6 -31.8,-33 V 700 Z M 130,700 V 100 h 70.2 v 600 z"
)

# --- art layout, designed in a 1024x1024 box that the art fills -------------
SIZE = 1024

KB_X0, KB_X1 = 24.0, 1000.0
KB_Y0, KB_Y1 = 660.0, 1016.0
KB_RADIUS = 26.0
WHITE_KEYS = 5
SEPARATOR_W = 20.0
BLACK_KEY_W = 140.0
BLACK_KEY_RATIO = 0.62
# Which white-key boundaries carry a black key (C#, D#, F# over C D E F G).
BLACK_KEY_BOUNDARIES = (1, 2, 4)

GCLEF_H = 610.0
GCLEF_TOP = 20.0
CCLEF_H = 470.0
CLEF_GAP = 90.0


def fit(box: tuple[float, float, float, float], height: float) -> tuple[float, float]:
    """Returns (scale, width) that renders `box` at `height`."""
    scale = height / box[3]
    return scale, box[2] * scale


def place(box, scale: float, x: float, y: float) -> str:
    """Transform putting the glyph's top-left corner at (x, y)."""
    return f"translate({x - box[0] * scale:.2f} {y - box[1] * scale:.2f}) scale({scale:.5f})"


def gap_rects(fill: str) -> list[str]:
    """The key separators and black keys — always the ground showing through."""
    w = KB_X1 - KB_X0
    h = KB_Y1 - KB_Y0
    key_w = w / WHITE_KEYS
    parts = []
    for i in range(1, WHITE_KEYS):
        x = KB_X0 + i * key_w - SEPARATOR_W / 2
        parts.append(
            f'<rect x="{x:.2f}" y="{KB_Y0}" width="{SEPARATOR_W}"'
            f' height="{h}" fill="{fill}"/>'
        )
    for i in BLACK_KEY_BOUNDARIES:
        x = KB_X0 + i * key_w - BLACK_KEY_W / 2
        parts.append(
            f'<rect x="{x:.2f}" y="{KB_Y0}" width="{BLACK_KEY_W}"'
            f' height="{h * BLACK_KEY_RATIO:.2f}" rx="{SEPARATOR_W / 2}" fill="{fill}"/>'
        )
    return parts


def keybed(fill: str, extra: str = "") -> str:
    return (
        f'<rect x="{KB_X0}" y="{KB_Y0}" width="{KB_X1 - KB_X0}"'
        f' height="{KB_Y1 - KB_Y0}" rx="{KB_RADIUS}" fill="{fill}"{extra}/>'
    )


def keyboard() -> list[str]:
    # Black keys and key separators are the purple ground showing through, so
    # the whole icon stays on three flat tones.
    return [keybed(WHITE), *gap_rects(PURPLE)]


def clefs() -> list[str]:
    g_scale, g_w = fit(GCLEF_BOX, GCLEF_H)
    c_scale, c_w = fit(CCLEF_BOX, CCLEF_H)
    total = g_w + CLEF_GAP + c_w
    x = (SIZE - total) / 2
    g_mid = GCLEF_TOP + GCLEF_H / 2
    c_top = g_mid - CCLEF_H / 2
    return [
        f'<path d="{GCLEF_D}" fill="{INK}"'
        f' transform="{place(GCLEF_BOX, g_scale, x, GCLEF_TOP)}"/>',
        f'<path d="{CCLEF_D}" fill="{INK}"'
        f' transform="{place(CCLEF_BOX, c_scale, x + g_w + CLEF_GAP, c_top)}"/>',
    ]


ART = "\n    ".join(clefs() + keyboard())

# Android themed icons tint a single-colour silhouette, so the key gaps have to
# be punched out of the keybed rather than painted over it.
MONO_ART = "\n    ".join(
    [
        '<mask id="keygaps">',
        keybed("#FFFFFF"),
        *gap_rects("#000000"),
        "</mask>",
        *[c.replace(f'fill="{INK}"', 'fill="#000000"') for c in clefs()],
        keybed("#000000", ' mask="url(#keygaps)"'),
    ]
)


def svg(*, ground: str, art_scale: float, art: str = ART) -> str:
    """`ground` is the backdrop markup; `art_scale` shrinks the art to fit a safe zone."""
    offset = SIZE * (1 - art_scale) / 2
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}">
  {ground}
  <g transform="translate({offset:.2f} {offset:.2f}) scale({art_scale})">
    {art}
  </g>
</svg>
"""


ROUNDED_GROUND = (
    f'<rect x="0" y="0" width="{SIZE}" height="{SIZE}" rx="224" fill="{PURPLE}"/>'
)
SQUARE_GROUND = f'<rect x="0" y="0" width="{SIZE}" height="{SIZE}" fill="{PURPLE}"/>'

# App icon: rounded ground, art inset so it clears the corner radius. Used
# wherever the icon is shown unmasked — favicon, splash, manifest `any`.
ICON_SVG = svg(ground=ROUNDED_GROUND, art_scale=0.80)
# Native icon: iOS and Android apply their own mask and iOS rejects an alpha
# channel, so the purple bleeds to every edge here.
NATIVE_SVG = svg(ground=SQUARE_GROUND, art_scale=0.80)
# Maskable: purple bleeds to every edge, art inside the 80% safe zone.
MASKABLE_SVG = svg(ground=SQUARE_GROUND, art_scale=0.68)
# Android adaptive foreground: no ground, art inside the 66% safe zone. The
# adaptive background is the flat purple from app.json, so the keys stay white.
FOREGROUND_SVG = svg(ground="", art_scale=0.58)
MONOCHROME_SVG = svg(ground="", art_scale=0.58, art=MONO_ART)


def render(svg_path: Path, out: Path, size: int, *, opaque: bool = False) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), str(svg_path), "-o", str(out)],
        check=True,
    )
    if opaque:
        subprocess.run(
            ["magick", str(out), "-background", PURPLE, "-alpha", "remove",
             "-alpha", "off", str(out)],
            check=True,
        )
    print(f"  {out.relative_to(ROOT)}  {size}x{size}")


def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    icon_svg = ROOT / "assets/images/icon.svg"
    icon_svg.write_text(ICON_SVG)
    maskable_svg = BUILD / "maskable.svg"
    maskable_svg.write_text(MASKABLE_SVG)
    foreground_svg = BUILD / "foreground.svg"
    foreground_svg.write_text(FOREGROUND_SVG)
    monochrome_svg = BUILD / "monochrome.svg"
    monochrome_svg.write_text(MONOCHROME_SVG)
    native_svg = BUILD / "native.svg"
    native_svg.write_text(NATIVE_SVG)
    print(f"wrote {icon_svg.relative_to(ROOT)}")

    render(native_svg, ROOT / "assets/images/icon.png", 1024, opaque=True)
    render(icon_svg, ROOT / "assets/images/favicon.png", 48)
    render(icon_svg, ROOT / "assets/images/splash-icon.png", 512)
    render(icon_svg, ROOT / "public/icons/icon-192.png", 192)
    render(icon_svg, ROOT / "public/icons/icon-512.png", 512)
    render(maskable_svg, ROOT / "public/icons/maskable-192.png", 192)
    render(maskable_svg, ROOT / "public/icons/maskable-512.png", 512)
    render(foreground_svg, ROOT / "assets/images/android-icon-foreground.png", 512)
    render(monochrome_svg, ROOT / "assets/images/android-icon-monochrome.png", 432)

    # Preview sheet for the legibility sanity check.
    render(icon_svg, BUILD / "preview-48.png", 48)
    render(icon_svg, BUILD / "preview-256.png", 256)


if __name__ == "__main__":
    main()
