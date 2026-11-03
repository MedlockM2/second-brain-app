---
id: TASK-581
title: Record microphone audio notes and save them as library media
status: Done
assignee:
  - '@codex'
created_date: '2026-11-03 14:35'
updated_date: '2026-11-03 14:55'
labels:
  - mobile
  - web
  - testflight
dependencies: []
type: feature
ordinal: 185000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TestFlight feedback AJfwbx2O6hE2TRAfbz9-uXg, 2026-11-03, build 24: recording a spoken note should save it into the ordinary library. Three NotebookLM screenshots show a live waveform, elapsed time, pause/resume, a save checkmark and discard confirmation. Adapt that interaction to Deepn and its existing save/folder workflow on iOS, Android and web. Owner explicitly requested implementation, commit and merge on main. Native delivery requires new binaries; device verification after distribution is an owner follow-up, not a completion gate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Mobile microphone entry, recorder controls, discard handling and ordinary library intake are wired without a new media endpoint.
- [x] #2 Web microphone recording feeds the existing file import and folder workflow; microphone resources are released when recording ends or the surface closes.
- [x] #3 Recording has bounded duration and file size, permission/error states and interruption handling; interface strings use the shared catalogues.
- [x] #4 Mobile, core and web typecheck/lint pass; native exports and web build succeed, and delivery requirements are documented.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the existing audio-file/library/transcription/budget pipeline; add SDK-matched expo-audio for native capture and the browser MediaRecorder adapter, without choosing a new provider or storage architecture.
2. Place a standalone mobile microphone button between camera and + in shared SourceActions. Present the modal and start capture on show, pause/resume with the left two-bars/triangle control, finish/import with the checkmark, and confirm discard through the upper-right cross. Add equivalent independent web entry points.
3. Bound capture to one hour and the existing 50 MiB upload gate; handle permissions, interruption, background pause and cleanup. Use metering for the waveform and reuse the ordinary save/folder/retry workflows. Accept browser WebM in the canonical upload gate.
4. Translate copy and microphone purposes in eleven locales; document privacy facts and native rebuild requirements.
5. Verify types/lints, backend static checks, web build, native exports, config/autolinking and manual browser capture with synthetic audio; commit and merge locally into main without touching the owner's concurrent feature checkout.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner clarification during implementation: the mobile microphone must be its own button between camera and +, at the same level, on Home and folder source actions; no entry in the + sheet.

Owner confirmed the exact interaction: independent camera / microphone / + row; modal auto-starts on show; left pause icon becomes a resume triangle; checkmark finishes and saves; upper-right cross asks for discard confirmation. Code wiring and browser interaction were reviewed against this sequence.

Mobile/core/web types and lints pass (only pre-existing purchaseService any warning). Ruff and mypy pass, 213 backend files. Web build and final iOS/Android exports pass. Expo introspection grants RECORD_AUDIO without a blocked entry and adds no iOS audio background mode; mobile autolinking resolves ExpoAudio 55.0.18. Manual Chrome synthetic-tone capture covered auto-start, pause/resume, hidden-tab pause, save, discard/cancel and permission refusal, with nonempty WebM File and ended tracks. No automated tests added or run. Physical-device capture/permission dialogs and deployed ingestion remain owner verification after new binaries/API/web distribution.

The main checkout now contains unrelated ongoing work on feat/resume-artifacts-conversations. Integration will use a separate main worktree to preserve that checkout and all its uncommitted changes. Full delivery/verification notes: docs/TESTFLIGHT_2026_11_03_AUDIO_NOTES.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added microphone notes on mobile and web through ordinary audio imports. The mobile mic is a standalone button between camera and +; its modal starts automatically, toggles pause/resume, finishes via checkmark and confirms discard via the cross. Added real metering, bounds, interruption/permission handling, eleven-language copy and native purpose strings; browser WebM uses the existing upload contract. Verified all workspace types/lints, Ruff/mypy, web build, native exports, Expo config/autolinking and manual Chrome synthetic-audio interaction. New iOS/Android binaries and API/web deployment are required; hardware and deployed ingestion verification remain after distribution. No push, deployment or automated tests.
<!-- SECTION:FINAL_SUMMARY:END -->
