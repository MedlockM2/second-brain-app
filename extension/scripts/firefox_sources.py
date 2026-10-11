"""Build the Firefox package and its self-contained AMO review sources."""
import argparse
import json
import os
from pathlib import Path
import platform
import subprocess
import zipfile

EXTENSION = Path(__file__).resolve().parents[1]
ROOT = EXTENSION.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--api', required=True, help='Public API origin used by this release')
parser.add_argument('--web', required=True, help='Public web app origin used by this release')
args = parser.parse_args()
# These two origins are intentionally public. Never copy a developer's .env file.
from urllib.parse import urlsplit
for value in (args.api, args.web):
    parsed = urlsplit(value)
    if (parsed.scheme not in ('http', 'https') or not parsed.hostname
            or parsed.username or parsed.password or parsed.path
            or parsed.query or parsed.fragment):
        parser.error('Expected an http(s) origin without credentials, path, query or fragment')

env = {**os.environ, 'VITE_API_BASE_URL': args.api, 'VITE_WEB_APP_ORIGIN': args.web}
subprocess.run(['npm', 'run', 'zip:firefox'], cwd=EXTENSION, env=env, check=True)
version = json.loads((EXTENSION / 'package.json').read_text())['version']
archive = EXTENSION / '.output' / f'deepn-extension-{version}-firefox-sources.zip'
node = subprocess.check_output(['node', '--version'], text=True).strip()
npm = subprocess.check_output(['npm', '--version'], text=True).strip()
readme = f'''# Deepn Firefox {version} — AMO source reconstruction

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
npm run zip:firefox
```

npm ci runs wxt prepare. The included .env.production contains only this release's
public API and web origins. Keep it unchanged; do not add .env.local or override
VITE_* variables. The sources include packages/core/src for the source alias.
No root workspace install is needed. Public icons and catalogues are already
included; regenerating them (Pillow) is not part of the build.

Output: extension/.output/deepn-extension-{version}-firefox.zip.
Compare extracted files against the submitted package (ZIP timestamps may differ).
Build output directory: extension/.output/firefox-mv3.
The source archive excludes node_modules, generated output, .git, local environment
files, credentials, and the unrelated backend/mobile/web apps.

Firefox 140+ uses only the single-use rescue code from the web account page.
No website-to-extension messages, content scripts or remote code are used.
Upload this source archive alongside every corresponding version on AMO.
'''
files = []
# Explicit allow-list: local env files and unrelated files cannot enter the archive.
for name in ('package.json', 'package-lock.json', 'tsconfig.json', 'wxt.config.ts', '.eslintrc.cjs', 'README.md'):
    files.append(EXTENSION / name)
for directory in ('entrypoints', 'lib', 'public', 'scripts'):
    files.extend(p for p in (EXTENSION / directory).rglob('*') if p.is_file() and not p.is_symlink() and '__pycache__' not in p.parts)
files.extend(p for p in (ROOT / 'packages/core/src').rglob('*') if p.is_file() and not p.is_symlink())
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
    for p in sorted(files):
        output.write(p, p.relative_to(ROOT))
    output.writestr('README.md', readme)
    output.writestr('extension/.env.production', f'VITE_API_BASE_URL={args.api}\nVITE_WEB_APP_ORIGIN={args.web}\n')
if archive.stat().st_size > 200_000_000:
    archive.unlink()
    raise SystemExit('AMO sources exceed the 200 MB limit')
print(f'AMO sources: {archive} ({archive.stat().st_size} bytes)')
