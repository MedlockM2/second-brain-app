"""Write icons.json: the Ionicons these mockups draw, from the font the mobile app ships.
Run from the repository root: python3 mobile-design-mockups/auth_directions/_build/extract_icons.py
"""
import json
import pathlib

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

NAMES = """
layers-outline text-outline newspaper-outline receipt-outline color-wand-outline clipboard-outline documents-outline language-outline document-attach-outline mail-outline mail-open-outline lock-closed-outline eye-outline eye-off-outline checkmark
checkmark-circle ellipse-outline alert-circle-outline chevron-back chevron-forward arrow-forward
information-circle-outline close key-outline finger-print refresh-outline logo-apple logo-google
person-circle-outline shield-checkmark-outline sparkles-outline play-circle-outline headset-outline
document-text-outline book-outline time-outline link-outline create-outline scan-outline open-outline
chatbubbles-outline share-outline folder-outline desktop-outline image-outline trash-outline arrow-up
ellipsis-horizontal copy-outline school-outline play camera-outline search-outline add reader-outline
share-social-outline images-outline mic-outline heart-outline download-outline
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
