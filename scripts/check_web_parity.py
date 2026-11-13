#!/usr/bin/env python3
"""Guard: every commit that changes the mobile app keeps the web app in step.

The web app (``web/``) was built on 2026-10-11 from the mobile app of that day.
In the four days that followed, some thirty mobile commits -- mostly TestFlight
fixes -- landed without anyone asking whether the web needed the same change,
and the two apps drifted apart (task-525 catches up). The drift was not a
decision; the question simply had no moment where it was asked.

This guard makes that moment the commit, and judges it on what the commit does,
not on what its message says. A non-merge commit touching ``mobile/app/`` or
``mobile/src/`` passes when:

- it changes ``web/`` too -- parity is in the diff, no line is needed; or
- it carries a ``Web:`` line that holds up:

    Web: task-525                   a backlog task carries the web side; the
                                    task must exist in backlog/
    Web: n/a (iOS keyboard only)    nothing to do on the web, with the reason

It fails when the mobile change has no web change and no such line, when
``Web: done`` is claimed by a commit that does not touch ``web/``, when the task
named does not exist, or when ``n/a`` comes without a reason -- the reason is
what lets a reader check the call later. Merge commits are skipped -- the
commits they bring in are checked.

What no script can tell is whether a web change is the *same* change; that
stays the reviewer's call.

Usage:
    python scripts/check_web_parity.py <base>..<head>   # the pushed or PR range
    python scripts/check_web_parity.py                  # HEAD alone

A ``<base>`` of all zeros (a new branch) checks ``<head>`` alone.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

WATCHED = ("mobile/app/", "mobile/src/")
WEB = "web/"
TRAILER = re.compile(r"^Web:\s*(.*?)\s*$", re.IGNORECASE | re.MULTILINE)
TASK = re.compile(r"^task-(\d+)$", re.IGNORECASE)
NOT_APPLICABLE = re.compile(r"^n/a\s*[-—:(]?\s*\w", re.IGNORECASE)
BACKLOG = Path(__file__).resolve().parent.parent / "backlog"


def git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def commits_in(range_spec: Optional[str]) -> list[str]:
    if range_spec is None:
        return [git("rev-parse", "HEAD").strip()]
    base, _, head = range_spec.partition("..")
    if not base or set(base) == {"0"}:
        return [git("rev-parse", head or "HEAD").strip()]
    return git("rev-list", "--no-merges", range_spec).split()


def task_exists(number: str) -> bool:
    return any(BACKLOG.rglob(f"task-{number} - *.md"))


def verdict(sha: str) -> Optional[str]:
    """Why this commit breaks parity, or ``None`` when it keeps it."""
    files = git("diff-tree", "--no-commit-id", "--name-only", "-r", sha).splitlines()
    if not any(path.startswith(WATCHED) for path in files):
        return None
    if any(path.startswith(WEB) for path in files):
        return None
    lines = TRAILER.findall(git("log", "-1", "--format=%B", sha))
    if not lines:
        return "changes mobile/ but not web/, and says nothing about the web"
    value = lines[-1]
    if value.lower() == "done":
        return "says 'Web: done' but does not change web/"
    task = TASK.match(value)
    if task:
        if task_exists(task.group(1)):
            return None
        return f"names task-{task.group(1)} for the web side, but no such task is in backlog/"
    if NOT_APPLICABLE.match(value):
        return None
    if value.lower().startswith("n/a"):
        return "says 'Web: n/a' without a reason"
    return f"has an unreadable line 'Web: {value}'"


def main() -> int:
    range_spec = sys.argv[1] if len(sys.argv) > 1 else None
    failures = []
    for sha in commits_in(range_spec):
        if len(git("rev-list", "--parents", "-n", "1", sha).split()) > 2:
            continue
        reason = verdict(sha)
        if reason:
            failures.append(f"{git('log', '-1', '--format=%h %s', sha).strip()} — {reason}")

    if not failures:
        return 0
    for line in failures:
        print(f"::error::{line}")
    print(
        "\nA commit touching mobile/app or mobile/src either changes web/ too, or ends with:\n"
        "  Web: task-NNN (an existing backlog task) | Web: n/a (<reason>)\n"
        "See AGENTS.md, section 'Web parity'."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
