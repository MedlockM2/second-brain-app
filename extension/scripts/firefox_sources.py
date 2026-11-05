"""Build the Firefox package and its self-contained AMO review sources."""

import argparse
import json
import os
import platform
import subprocess
import zipfile
from pathlib import Path

from release_config import origin

EXTENSION = Path(__file__).resolve().parents[1]
ROOT = EXTENSION.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--api", required=True, help="Public API origin used by this release")
parser.add_argument("--web", required=True, help="Public web app origin used by this release")
parser.add_argument("--mode", choices=("development", "ci", "distribution"), default="distribution")
args = parser.parse_args()
# Generate only the explicitly chosen public values; never copy a local env file.
purpose = "distribution" if args.mode == "distribution" else "validation"
try:
    api, web = origin(args.api, purpose), origin(args.web, purpose)
except ValueError as error:
    parser.error(str(error))
env = {key: value for key, value in os.environ.items() if not key.startswith("VITE_")}
env.update(VITE_API_BASE_URL=api, VITE_WEB_APP_ORIGIN=web)
subprocess.run(["npm", "exec", "--", "wxt", "zip", "-b", "firefox", "--mv3", "--mode", args.mode], cwd=EXTENSION, env=env, check=True)
version = json.loads((EXTENSION / "package.json").read_text())["version"]
archive = EXTENSION / ".output" / f"deepn-extension-{version}-firefox-sources.zip"
node = subprocess.check_output(["node", "--version"], text=True).strip()
npm = subprocess.check_output(["npm", "--version"], text=True).strip()
readme = f"""# Deepn Firefox {version} — AMO source reconstruction

Build environment: {platform.system()} {platform.release()} ({platform.machine()}),
Node.js {node}, npm {npm}, Python {platform.python_version()}.
Use the same Node.js and npm versions to reproduce this release.
Node.js (including npm): https://nodejs.org/en/download
Python: https://www.python.org/downloads/
All build tools are open source, local tools, pinned by extension/package-lock.json.
Network is needed only to download dependencies from the npm registry.
No account, login, API credential, backend access or proprietary tool is required.

From the extracted archive root:

```sh
cd extension
npm ci
npm exec -- wxt zip -b firefox --mv3 --mode {args.mode}
```

npm ci runs wxt prepare. The included .env contains only this release's
public API and web origins. Keep it unchanged; do not add .env.local or override
VITE_* variables. The sources include packages/core/src for the source alias.
No root workspace install is needed. Public icons and catalogues are already
included; regenerating them (Pillow) is not part of the build.

Output: extension/.output/deepn-extension-{version}-firefox.zip.
Compare extracted files against the submitted package (ZIP timestamps may differ).
Build output directory: extension/.output/firefox-mv3.
The source archive excludes node_modules, generated output, .git, local environment
files, credentials, and the unrelated backend/mobile/web apps.

Delivery purpose: {"distribution" if args.mode == "distribution" else "TECHNICAL VALIDATION ONLY — do not submit"}.

Firefox 140+ uses only the single-use pairing code from the web account page.
No website-to-extension messages, content scripts or remote code are used.
Upload this source archive alongside every corresponding version on AMO.
"""
files = []
# Explicit allow-list: local env files and unrelated files cannot enter the archive.
for name in ("package.json", "package-lock.json", "tsconfig.json", "wxt.config.ts", ".eslintrc.cjs", "README.md"):
    files.append(EXTENSION / name)
for directory in ("entrypoints", "lib", "public", "scripts"):
    files.extend(p for p in (EXTENSION / directory).rglob("*") if p.is_file() and not p.is_symlink() and "__pycache__" not in p.parts)
files.extend(p for p in (ROOT / "packages/core/src").rglob("*") if p.is_file() and not p.is_symlink())
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
    for p in sorted(files):
        output.write(p, p.relative_to(ROOT))
    output.writestr("README.md", readme)
    output.writestr("extension/.env", f"VITE_API_BASE_URL={api}\nVITE_WEB_APP_ORIGIN={web}\n")
if archive.stat().st_size > 200_000_000:
    archive.unlink()
    raise SystemExit("AMO sources exceed the 200 MB limit")
print(f"AMO sources: {archive} ({archive.stat().st_size} bytes)")
