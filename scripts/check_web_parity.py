#!/usr/bin/env python3
"""Guard: every commit that changes the mobile app says what happens on the web.

The web app (``web/``) was built on 2026-10-11 from the mobile app of that day.
In the four days that followed, some thirty mobile commits -- mostly TestFlight
fixes -- landed without anyone asking whether the web needed the same change,
and the two apps drifted apart (task-525 catches up). The drift was not a
decision; the question simply had no moment where it was asked.

This guard makes that moment the commit. A non-merge commit touching
``mobile/app/`` or ``mobile/src/`` must carry one ``Web:`` trailer line:

    Web: done                       the same commit changes web/ too
    Web: task-525                   a backlog task carries the web side
    Web: n/a (iOS keyboard only)    nothing to do on the web, with the reason

``n/a`` without a reason is refused: the reason is what lets a reader check the
call later. Merge commits are skipped -- the commits they bring in are checked.

Usage:
    python scripts/check_web_parity.py <base>..<head>   # the pushed or PR range
    python scripts/check_web_parity.py                  # HEAD alone

A ``<base>`` of all zeros (a new branch) checks ``<head>`` alone.
"""

from __future__ import annotations

import re
import subprocess
import sys

WATCHED = ("mobile/app/", "mobile/src/")
TRAILER = re.compile(
    r"^Web:\s*(done|task-\d+|n/a\s*[-—:(]?\s*\w.*)\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def commits_in(range_spec: str | None) -> list[str]:
    if range_spec is None:
        return [git("rev-parse", "HEAD").strip()]
    base, _, head = range_spec.partition("..")
    if not base or set(base) == {"0"}:
        return [git("rev-parse", head or "HEAD").strip()]
    return git("rev-list", "--no-merges", range_spec).split()


def touches_mobile(sha: str) -> bool:
    files = git("diff-tree", "--no-commit-id", "--name-only", "-r", sha).splitlines()
    return any(path.startswith(WATCHED) for path in files)


def main() -> int:
    range_spec = sys.argv[1] if len(sys.argv) > 1 else None
    missing = []
    for sha in commits_in(range_spec):
        if len(git("rev-list", "--parents", "-n", "1", sha).split()) > 2:
            continue
        if touches_mobile(sha) and not TRAILER.search(git("log", "-1", "--format=%B", sha)):
            missing.append(git("log", "-1", "--format=%h %s", sha).strip())

    if not missing:
        return 0
    for line in missing:
        print(f"::error::{line} — changes mobile/ without a 'Web:' line")
    print(
        "\nEvery commit touching mobile/app or mobile/src ends with one of:\n"
        "  Web: done | Web: task-NNN | Web: n/a (<reason>)\n"
        "See AGENTS.md, section 'Web parity'."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
