"""Build and inspect explicit Chromium/Firefox delivery packages, without publishing."""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

from release_config import origin

EXTENSION = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--purpose", choices=("local", "validation", "distribution"), required=True)
parser.add_argument("--target", choices=("chromium", "firefox", "all"), required=True)
parser.add_argument("--api", required=True)
parser.add_argument("--web", required=True)
args = parser.parse_args()
try:
    api, web = origin(args.api, args.purpose), origin(args.web, args.purpose)
except ValueError as error:
    parser.error(str(error))
mode = {"local": "local", "validation": "ci", "distribution": "distribution"}[args.purpose]
env = {key: value for key, value in os.environ.items() if not key.startswith("VITE_")}
env.update(VITE_API_BASE_URL=api, VITE_WEB_APP_ORIGIN=web)
version = json.loads((EXTENSION / "package.json").read_text())["version"]
config_id = hashlib.sha256(json.dumps([args.purpose, api, web]).encode()).hexdigest()[:12]
destination = EXTENSION / ".output" / "delivery" / args.purpose / config_id
destination.mkdir(parents=True, exist_ok=True)
(destination / "delivery.json").unlink(missing_ok=True)
packages = []


def pattern(value: str) -> str:
    parsed = urlsplit(value)
    host = f"[{parsed.hostname}]" if ":" in (parsed.hostname or "") else parsed.hostname
    return f"{parsed.scheme}://{host}/*"


def inspect_package(package: Path, firefox: bool) -> None:
    with zipfile.ZipFile(package) as archive:
        names = archive.namelist()
        if any(".env" in Path(name).parts or Path(name).name.startswith(".env") for name in names):
            raise ValueError("Environment file in packaged extension")
        manifest = json.loads(archive.read("manifest.json"))
        if manifest.get("manifest_version") != 3 or sorted(manifest.get("permissions", [])) != [
            "activeTab",
            "contextMenus",
            "storage",
        ]:
            raise ValueError("Unexpected extension permissions/version")
        if (
            manifest.get("host_permissions") != [pattern(api)]
            or manifest.get("content_scripts")
            or manifest.get("web_accessible_resources")
        ):
            raise ValueError("Unexpected host/content access")
        if firefox:
            if "externally_connectable" in manifest or "service_worker" in manifest.get("background", {}):
                raise ValueError("Firefox package contains Chromium-only pairing/background")
            if not manifest.get("browser_specific_settings", {}).get("gecko", {}).get("id"):
                raise ValueError("Firefox identity missing")
        elif manifest.get("externally_connectable", {}).get("matches") != [pattern(web)]:
            raise ValueError("Web pairing origin mismatch")
        scripts = "\n".join(archive.read(name).decode() for name in names if name.endswith(".js"))
        if api not in scripts or web not in scripts:
            raise ValueError("Chosen origins are missing from the compiled bundle")


def keep(package: Path) -> None:
    target = destination / package.name
    shutil.copy2(package, target)
    packages.append({"file": target.name, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})


if args.target in ("chromium", "all"):
    subprocess.run(["npm", "exec", "--", "wxt", "zip", "--mode", mode], cwd=EXTENSION, env=env, check=True)
    package = EXTENSION / ".output" / f"deepn-extension-{version}-chrome.zip"
    inspect_package(package, False)
    keep(package)
if args.target in ("firefox", "all"):
    subprocess.run(
        [sys.executable, "scripts/firefox_sources.py", "--api", api, "--web", web, "--mode", mode], cwd=EXTENSION, env=env, check=True
    )
    package = EXTENSION / ".output" / f"deepn-extension-{version}-firefox.zip"
    inspect_package(package, True)
    keep(package)
    source = EXTENSION / ".output" / f"deepn-extension-{version}-firefox-sources.zip"
    with zipfile.ZipFile(source) as archive:
        names = archive.namelist()
        generated = "extension/.env"
        expected = f"VITE_API_BASE_URL={api}\nVITE_WEB_APP_ORIGIN={web}\n"
        if archive.read(generated).decode() != expected:
            raise ValueError("Source reconstruction origins mismatch")
        for name in names:
            parts = Path(name).parts
            if (
                ".." in parts
                or Path(name).is_absolute()
                or any(part in ("node_modules", ".git", ".output", ".wxt") for part in parts)
                or (Path(name).name.startswith(".env") and name != generated)
                or Path(name).suffix in (".pem", ".key", ".p8", ".p12")
            ):
                raise ValueError("Unexpected private/generated file in Firefox sources")
    keep(source)
receipt = {
    "purpose": args.purpose,
    "distributable": args.purpose == "distribution",
    "api": api,
    "web": web,
    "mode": mode,
    "version": version,
    "packages": packages,
}
(destination / "delivery.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(f"{'Distribution' if receipt['distributable'] else 'NOT FOR STORE SUBMISSION'}: {destination}")
