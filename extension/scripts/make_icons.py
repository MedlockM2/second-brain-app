"""Draw the extension's toolbar icons: the layers mark on the primary disc, as the web favicon.

Run from extension/: python3 scripts/make_icons.py — writes public/icon/{16,32,48,128}.png.
Drawn at 8x and downsampled, so the strokes stay smooth at 16 px. Needs Pillow.
"""
from pathlib import Path

from PIL import Image, ImageDraw

PRIMARY = (255, 203, 5, 255)
INK = (28, 27, 26, 255)
OUT = Path(__file__).resolve().parent.parent / "public" / "icon"


def draw(size: int) -> Image.Image:
    scale = 8
    s = size * scale
    image = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    pen = ImageDraw.Draw(image)
    pen.ellipse((0, 0, s - 1, s - 1), fill=PRIMARY)
    width = max(scale, round(s * 0.055))

    def layer(y: float, top_only: bool) -> None:
        cx, half_w, half_h = s / 2, s * 0.27, s * 0.135
        left, right, top, bottom = (cx - half_w, y), (cx + half_w, y), (cx, y - half_h), (cx, y + half_h)
        if top_only:
            pen.line([left, top, right, bottom, left], fill=INK, width=width, joint="curve")
        else:
            pen.line([left, bottom, right], fill=INK, width=width, joint="curve")

    layer(s * 0.40, True)
    layer(s * 0.53, False)
    layer(s * 0.66, False)
    return image.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        draw(size).save(OUT / f"{size}.png")
    print("icons ->", OUT)
