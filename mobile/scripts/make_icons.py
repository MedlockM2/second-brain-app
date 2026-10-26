"""Render the app's icon, Android adaptive icon and splash from the Deepn logo in web/public/favicon.svg.

Run from anywhere: python3 mobile/scripts/make_icons.py — writes mobile/assets/{icon,adaptive-icon,splash}.png
and web/public/apple-touch-icon.png. Renders through headless Google Chrome, as the mockups' shoot.mjs. Needs Pillow.

- icon.png / apple-touch-icon.png: the planes on a full-bleed amber square, opaque; iOS cuts its own corners.
- adaptive-icon.png: the planes alone on transparency, inside the 66/108 safe circle; the amber comes
  from `android.adaptiveIcon.backgroundColor` in app.config.ts.
- splash.png: the amber disc on transparency, inside the 2/3 circle Android 12+ keeps of the splash
  icon; the page colour is `splash.backgroundColor`.
"""
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FAVICON = ROOT / "web" / "public" / "favicon.svg"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def variant(source: str, background: str, scale: float) -> str:
    disc = re.search(r"<circle[^>]*/>", source).group(0)
    planes = re.search(r"<g.*</g>", source).group(0)
    base = {"square": '<rect width="512" height="512" fill="#ffcb05"/>', "disc": disc, "none": ""}[background]
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">'
        f'<g transform="translate(256 256) scale({scale}) translate(-256 -256)">{base}{planes}</g></svg>'
    )


def render(svg: str, size: int, out: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "logo.html"
        page.write_text(
            "<html><body style='margin:0;background:transparent'>"
            f"<div style='width:{size}px;height:{size}px'>{svg}</div></body></html>"
        )
        subprocess.run(
            [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={tmp}/profile",
             "--default-background-color=00000000", f"--window-size={size},{size}", f"--screenshot={out}", page.as_uri()],
            check=True, capture_output=True,
        )


if __name__ == "__main__":
    source = FAVICON.read_text()
    assets = ROOT / "mobile" / "assets"
    render(variant(source, "square", 1.0), 1024, assets / "icon.png")
    render(variant(source, "none", 0.9), 1024, assets / "adaptive-icon.png")
    render(variant(source, "disc", 0.6), 1024, assets / "splash.png")
    render(variant(source, "square", 1.0), 180, ROOT / "web" / "public" / "apple-touch-icon.png")
    # The App Store refuses an icon with an alpha channel, even a fully opaque one.
    for opaque in (assets / "icon.png", ROOT / "web" / "public" / "apple-touch-icon.png"):
        Image.open(opaque).convert("RGB").save(opaque)
    print("icons ->", assets, "and web/public/apple-touch-icon.png")
