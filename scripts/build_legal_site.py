"""Render the static pages served by the www distribution.

Today one page: docs/compliance/privacy-policy.md -> <out>/privacy, an HTML file
without extension so its URL reads https://<host>/privacy. Its account-deletion
section keeps the `#delete-account` anchor written in the Markdown, which is the
URL given to the Play Console (docs/research/task-357-legal-pages-hosting/README.md,
owner amendment of 2026-10-30).

Run through scripts/publish_legal_site.sh, which supplies the `markdown` package:
    uv run --no-project --with markdown==3.7 python scripts/build_legal_site.py <out>
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import markdown

REPO_ROOT = Path(__file__).resolve().parent.parent
PAGES = {"privacy": REPO_ROOT / "docs" / "compliance" / "privacy-policy.md"}

# Colours: mobile/src/constants/theme.ts (light and dark palettes).
TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} - Deepn</title>
<style>
:root {{ --bg:#fcf9f6; --surface:#ffffff; --text:#2b2d42; --muted:#5c6880; --rule:#ebe7e5; --accent:#b88a00; }}
@media (prefers-color-scheme: dark) {{
  :root {{ --bg:#171511; --surface:#211e19; --text:#f1ebe1; --muted:#aeb6c4; --rule:#37332c; --accent:#f0bf2a; }}
}}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--text); font-size:16px; line-height:1.6;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif; }}
main {{ max-width:760px; margin:0 auto; padding:40px 16px 64px; }}
h1 {{ font-size:32px; line-height:1.2; letter-spacing:-0.5px; margin:0 0 16px; }}
h2 {{ font-size:22px; line-height:1.3; margin:40px 0 12px; }}
h3 {{ font-size:18px; margin:28px 0 8px; }}
a {{ color:var(--accent); }}
ul {{ padding-left:22px; }}
li {{ margin:4px 0; }}
.table {{ overflow-x:auto; }}
table {{ border-collapse:collapse; width:100%; font-size:14px; line-height:1.5; }}
th, td {{ text-align:left; vertical-align:top; padding:8px 10px; border-bottom:1px solid var(--rule); }}
th {{ background:var(--surface); }}
h2:target {{ color:var(--accent); }}
</style>
</head>
<body>
<main>
{body}
</main>
</body>
</html>
"""


def render(source: Path) -> str:
    text = source.read_text(encoding="utf-8")
    # nl2br keeps the header lines (name, dates) on lines of their own; every
    # other paragraph of the policy is a single line.
    body = markdown.markdown(text, extensions=["tables", "nl2br"], output_format="html")
    # The Markdown marks an anchor as `<a id="..."></a>` on the line above a heading,
    # which GitHub renders too; on the page the id moves onto the heading itself.
    body = re.sub(r'<p><a id="([\w-]+)"></a></p>\s*<h2>', r'<h2 id="\1">', body)
    body = body.replace("<table>", '<div class="table"><table>').replace("</table>", "</table></div>")
    title = text.splitlines()[0].lstrip("# ").strip()
    return TEMPLATE.format(title=title, body=body)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: build_legal_site.py <output-dir>")
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for name, source in PAGES.items():
        (out / name).write_text(render(source), encoding="utf-8")
        print(f"{source.relative_to(REPO_ROOT)} -> {out / name}")


if __name__ == "__main__":
    main()
