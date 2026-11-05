"""Generate Deepn's existing public site: home, privacy and extension installation.

No store URL or account file is invented. Publication is a separate owner action.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlsplit

import markdown

REPO_ROOT = Path(__file__).resolve().parent.parent
PRIVACY = REPO_ROOT / "docs" / "compliance" / "privacy-policy.md"
CONFIG_KEYS = {"site_url", "web_app_url", "chrome_store_url", "edge_store_url", "firefox_store_url", "contact_email"}
STORE_HOSTS = {
    "chrome_store_url": "chromewebstore.google.com",
    "edge_store_url": "microsoftedge.microsoft.com",
    "firefox_store_url": "addons.mozilla.org",
}

# Colours: mobile/src/constants/theme.ts (light and dark palettes).
TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} - Deepn</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
{canonical}
<style>
:root {{ --bg:#fcf9f6; --surface:#ffffff; --text:#2b2d42; --muted:#5c6880; --rule:#ebe7e5; --accent:#b88a00; }}
@media (prefers-color-scheme: dark) {{
  :root {{ --bg:#171511; --surface:#211e19; --text:#f1ebe1; --muted:#aeb6c4; --rule:#37332c; --accent:#f0bf2a; }}
}}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--text); font-size:16px; line-height:1.6;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif; }}
nav {{ display:flex; flex-wrap:wrap; gap:20px; margin-bottom:32px; }}
nav a {{ text-decoration:none; font-weight:600; }}
.hero {{ padding:24px 0; }}
.hero h1 {{ font-size:46px; }}
.button {{ display:inline-block; border:1px solid var(--rule); border-radius:12px; padding:10px 16px; }}
.card {{ padding:20px 0; border-top:1px solid var(--rule); }}
footer {{ margin-top:40px; padding-top:20px; border-top:1px solid var(--rule); font-size:14px; }}
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
<nav aria-label="Main navigation"><a href="/">Deepn</a><a href="/extension">Browser extension</a><a href="/privacy">Privacy</a></nav>
{body}
<footer><a href="/privacy">Privacy Policy</a> ·
<a href="{terms_url}">Terms of Use — Apple standard EULA</a><p>Deepn · Second Brain Labs</p></footer>
</main>
</body>
</html>
"""


def config_values(path: Path | None, site_url: str | None) -> dict[str, str]:
    supplied = json.loads(path.read_text()) if path else {}
    if not isinstance(supplied, dict) or set(supplied) - CONFIG_KEYS:
        raise ValueError("Public site configuration contains unknown keys")
    config = {key: supplied.get(key, "") for key in CONFIG_KEYS}
    if any(not isinstance(value, str) for value in config.values()):
        raise ValueError("Public site configuration values must be strings")
    if site_url:
        if config["site_url"] and config["site_url"].rstrip("/") != site_url.rstrip("/"):
            raise ValueError("Configured site_url disagrees with the selected Terraform distribution")
        config["site_url"] = site_url
    for key, value in config.items():
        if not value:
            continue
        if key == "contact_email":
            if not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", value):
                raise ValueError("contact_email must be a public contact mailbox")
            continue
        parsed = urlsplit(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
            raise ValueError(f"{key} must be a public HTTPS URL without credentials or fragment")
        if key in STORE_HOSTS and parsed.hostname != STORE_HOSTS[key]:
            raise ValueError(f"{key} must point to its official extension store")
        if key in ("site_url", "web_app_url") and (parsed.path not in ("", "/") or parsed.query):
            raise ValueError(f"{key} must be an origin without path or query")
    return config


def page(title: str, body: str, route: str, config: dict[str, str]) -> str:
    legal = (REPO_ROOT / "packages/core/src/constants/legal.ts").read_text()
    match = re.search(r'^export const TERMS_URL = ("[^"\n]+");$', legal, re.MULTILINE)
    if not match:
        raise ValueError("Shared beta Terms URL is missing")
    canonical = ""
    if config["site_url"]:
        canonical = '<link rel="canonical" href="' + html.escape(config["site_url"].rstrip("/") + route, quote=True) + '">'
    return TEMPLATE.format(
        title=html.escape(title), body=body, canonical=canonical, terms_url=html.escape(json.loads(match.group(1)), quote=True)
    )


def render_privacy(config: dict[str, str]) -> str:
    text = PRIVACY.read_text(encoding="utf-8")
    if config["contact_email"]:
        contact = re.search(r"Contact for any privacy question or request: \*\*([^*]+)\*\*", text)
        if not contact:
            raise ValueError("The approved privacy contact could not be located")
        text = text.replace(contact.group(1), config["contact_email"])
    body = markdown.markdown(text, extensions=["tables", "nl2br"], output_format="html")
    body = re.sub(r'<p><a id="([\w-]+)"></a></p>\s*<h2>', r'<h2 id="\1">', body)
    body = body.replace("<table>", '<div class="table"><table>').replace("</table>", "</table></div>")
    return page("Privacy Policy", body, "/privacy", config)


def home(config: dict[str, str]) -> str:
    app = (
        ('<p><a class="button" href="' + html.escape(config["web_app_url"], quote=True) + '">Open Deepn on the web</a></p>')
        if config["web_app_url"]
        else ""
    )
    return page(
        "Keep your sources. Deepen your ideas.",
        """
<section class="hero"><h1>Keep your sources.<br>Deepen your ideas.</h1>
<p>Deepn brings the articles, videos, podcasts, documents and notes you choose to save into one library.</p></section>
<section><h2>Build a library you can return to</h2><p>Organise your sources in folders, search their text and revisit
what matters in your Digest.</p><h2>Make room for understanding</h2><p>Read transcripts, create summaries,
notes and flashcards, or ask questions about your saved sources.</p></section>
"""
        + app
        + '<p><a href="/extension">Save from your browser</a></p>'
        + '<p>Learn how your content is processed in our <a href="/privacy">Privacy Policy</a>.</p>',
        "/",
        config,
    )


def extension_page(config: dict[str, str]) -> str:
    sections = []
    for browser, key, pairing in [
        (
            "Chrome",
            "chrome_store_url",
            "Open My account › Browser extension in Deepn, then choose Link this extension. A code is also available.",
        ),
        (
            "Edge",
            "edge_store_url",
            "Open My account › Browser extension in Deepn, then choose Link this extension. A code is also available.",
        ),
        (
            "Firefox",
            "firefox_store_url",
            "Open My account › Browser extension in Deepn and choose Show a code. "
            "Enter that code and your account email in the extension popup.",
        ),
    ]:
        link = config[key]
        install = (
            (
                '<p><a class="button" href="'
                + html.escape(link, quote=True)
                + '">Install from the official '
                + browser
                + " store</a></p>"
            )
            if link
            else "<p>An installation link for this browser has not been published here yet.</p>"
        )
        sections.append('<section class="card"><h2>' + browser + "</h2>" + install + "<p>" + pairing + "</p></section>")
    return page(
        "Browser extension",
        """<h1>Save from your browser</h1>
<p>Save the current page’s address, or select text and choose Save the selection to Deepn from the context menu.
Choose a folder in the popup to keep your sources organised.</p>
<p>The extension sends only the address or the text you explicitly select with its source address.
It does not read a page’s full content or your browsing history. It does not unlock private or paywalled pages.</p>
"""
        + "".join(sections)
        + "<p>Install only the official store package linked here when available. "
        + "A developer’s unpacked build is a separate beta setup, not a public store release.</p>",
        "/extension",
        config,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--config", type=Path, help="Local JSON containing only the documented public values")
    parser.add_argument("--site-url", help="Public base URL of the selected Terraform www distribution")
    args = parser.parse_args()
    config = config_values(args.config, args.site_url)
    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    documents = {"privacy": render_privacy(config), "extension": extension_page(config), "index.html": home(config)}
    for name, content in documents.items():
        (out / name).write_text(content, encoding="utf-8")
    shutil.copyfile(REPO_ROOT / "web/public/favicon.svg", out / "favicon.svg")
    manifest = {
        "files": {
            "privacy": "text/html; charset=utf-8",
            "extension": "text/html; charset=utf-8",
            "favicon.svg": "image/svg+xml",
            "index.html": "text/html; charset=utf-8",
        }
    }
    (out / "site-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Generated home, privacy and extension pages in {out}; no Terms page or account file generated.")


if __name__ == "__main__":
    main()
