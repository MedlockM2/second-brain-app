"""Write icons.json: the Ionicons these mockups draw, from the font the mobile app ships.
Run from the repository root: python3 mobile-design-mockups/flashcards_ux/_build/extract_icons.py
"""
import json
import pathlib

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

NAMES = """
arrow-back ellipsis-horizontal copy-outline eye-outline eye-off-outline chevron-back chevron-forward
refresh-outline checkmark checkmark-circle close shuffle-outline sync-outline list-outline albums-outline
arrow-forward repeat-outline layers-outline hand-left-outline checkmark-done-outline
""".split()

ROOT = pathlib.Path.cwd()
VENDOR = ROOT / "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons"
OUT = pathlib.Path(__file__).with_name("icons.json")

glyphmap = json.loads((VENDOR / "glyphmaps/Ionicons.json").read_text())
font = TTFont(str(VENDOR / "Fonts/Ionicons.ttf"))
cmap = font.getBestCmap()
glyphs = font.getGlyphSet()
ascent = font["OS/2"].sTypoAscender
paths = {}
for name in NAMES:
    pen = SVGPathPen(glyphs)
    glyphs[cmap[glyphmap[name]]].draw(TransformPen(pen, (1, 0, 0, -1, 0, ascent)))
    paths[name] = pen.getCommands()
OUT.write_text(json.dumps({"viewBox": f"0 0 {font['head'].unitsPerEm} {font['head'].unitsPerEm}", "paths": paths}))
print(len(paths), "icons ->", OUT)
