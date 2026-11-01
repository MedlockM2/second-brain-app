"""Write icons-extra.json: the Ionicons this mockup draws that auth_directions/_build/icons.json lacks.
Run from the repository root: python3 mobile-design-mockups/onboarding_apres_connexion/_build/extract_icons.py
"""
import json
import pathlib

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

NAMES = """
bug-outline phone-portrait-outline extension-puzzle-outline cloud-upload-outline globe-outline
chatbubble-outline paper-plane-outline person-outline
""".split()

ROOT = pathlib.Path.cwd()
VENDOR = ROOT / "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons"
OUT = pathlib.Path(__file__).with_name("icons-extra.json")

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
