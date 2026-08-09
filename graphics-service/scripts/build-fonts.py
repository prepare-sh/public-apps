#!/usr/bin/env python3
"""
Rebuilds the vendored TTFs in assets/fonts from the @fontsource/source-sans-3
devDependency.

Why this exists: @resvg/resvg-js rasterizes with loadSystemFonts disabled, so
the only fonts it can see are real font files in assets/fonts. fontsource only
ships .woff/.woff2, and resvg does not reliably shape woff2 — glyphs silently
disappear. So the web fonts are converted to .ttf ahead of time.

Two things this script fixes that a naive convert does not:

  * Coverage. fontsource splits the face into per-script subsets. Converting
    only `latin` drops Polish/Czech/Turkish/Greek/Cyrillic, so the subsets
    listed in SUBSETS are merged back into one file per weight.

  * Family naming. The 500/600 subset files declare family names of
    "Source Sans 3 Medium"/"Source Sans 3 SemiBold", which would make each
    weight its own single-weight family — a `font-weight: 500` lookup against
    "Source Sans 3" would miss and fall back to Regular. The name table is
    rewritten so all four weights share one typographic family (nameID 16)
    and differ only by usWeightClass.

Usage:  npm install && python scripts/build-fonts.py
"""

import os
import tempfile
import warnings

from fontTools.merge import Merger
from fontTools.ttLib import TTFont

warnings.filterwarnings("ignore")

SRC = "node_modules/@fontsource/source-sans-3/files"
OUT = "assets/fonts"
FAMILY = "Source Sans 3"

# Latin plus the scripts a technical article plausibly needs. Adding more
# (vietnamese, greek-ext, cyrillic-ext) is a one-line change at ~15KB/weight.
SUBSETS = ["latin", "latin-ext", "greek", "cyrillic"]

# Must stay in sync with the weights in `fontWeight` in src/utils/tokens.ts.
WEIGHTS = [(400, "Regular"), (500, "Medium"), (600, "SemiBold"), (700, "Bold")]


def build(weight: int, style: str) -> str:
    parts = []
    for subset in SUBSETS:
        face = TTFont(f"{SRC}/source-sans-3-{subset}-{weight}-normal.woff")
        face.flavor = None  # drop woff compression -> plain TTF
        path = os.path.join(tempfile.gettempdir(), f"ss3-{subset}-{weight}.ttf")
        face.save(path)
        parts.append(path)

    merged = Merger().merge(parts)

    # nameID 1/2 are the legacy RIBBI pair and can only express Regular/Bold;
    # 16/17 carry the real family + style, and fontdb (resvg) prefers them.
    legacy_subfamily = "Bold" if weight == 700 else "Regular"
    names = merged["name"]
    for name_id, value in [
        (1, FAMILY if weight in (400, 700) else f"{FAMILY} {style}"),
        (2, legacy_subfamily),
        (4, f"{FAMILY} {style}"),
        (6, f"SourceSans3-{style}"),
        (16, FAMILY),
        (17, style),
    ]:
        names.setName(value, name_id, 3, 1, 0x409)  # Windows / Unicode BMP / en-US
        names.setName(value, name_id, 1, 0, 0)  # Macintosh / Roman / English

    merged["OS/2"].usWeightClass = weight

    dest = f"{OUT}/SourceSans3-{style}.ttf"
    merged.save(dest)
    for path in parts:
        os.remove(path)
    return dest


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for weight, style in WEIGHTS:
        dest = build(weight, style)
        check = TTFont(dest)
        print(
            f"{dest:38} family={check['name'].getDebugName(16)!r} "
            f"weight={check['OS/2'].usWeightClass} "
            f"codepoints={len(check.getBestCmap())} "
            f"size={os.path.getsize(dest) // 1024}KB"
        )


if __name__ == "__main__":
    main()
