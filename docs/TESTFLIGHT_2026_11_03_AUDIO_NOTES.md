# TestFlight 2026-11-03: microphone audio notes (TASK-581)

The App Store Connect collection returned 18 submissions over 192 hours in seven
requests. One identifier was absent from the decision log and pending feedback
branches: `AJfwbx2O6hE2TRAfbz9-uXg`, submitted on build 24 from an iPhone 11 running
iOS 26.6.2. No new crash was reported. The three supplied NotebookLM screenshots
request a new feature, rather than demonstrate a failure of audio-file ingestion.

## Delivered interaction

- A standalone microphone button sits **between camera and +** in the shared
  mobile source actions, on Home and in folders. The + sheet has no recording
  entry. This placement follows the owner's explicit clarification.
- Tapping it presents a full-screen modal and immediately prepares and starts
  recording. The system asks for microphone permission when needed; there is no
  second start action after access is granted.
- The left control is pause (two bars), then resume (a right-pointing triangle).
  Paused time is excluded from the duration. The waveform uses actual audio levels.
- The adjacent checkmark stops the recorder and hands its file to the ordinary
  save/folder workflow. On iOS the intake opens only after the recording modal
  has dismissed, avoiding two presentations on the same controller.
- The top-right cross pauses an active recording and asks whether to discard it.
  Cancelling that question returns to the paused note; confirming discards the
  local file without an upload. A permission failure has no recording to discard.
- Capture pauses on app background or hidden browser tab, without automatic
  resumption. Unexpected recorder interruptions preserve the available recorded
  portion for saving where the platform provides it.

The web has dedicated microphone buttons beside Add in the app bar and in folder
source actions. Its save uses the same file ingestion and filing flow; a failed
upload retains the file in the add dialog for retry.

## Integration

There was already an audio upload, library, transcription and beta-admission
pipeline. Both clients reuse it; there is no new endpoint or transcription
provider. Native capture uses the SDK 55 `expo-audio` module, configured for mono
AAC/M4A at 64 kb/s, with a one-hour duration limit and the existing 50 MiB upload
gate. Unsubmitted native recordings are removed on discard/unmount; a submitted
cache file remains available to the existing import/retry flow and OS cache cleanup.

The browser selects a supported audio encoding through `MediaRecorder`:
WebM/Opus, MP4 or Ogg/Opus. It retains the actual MIME type and matching extension.
The existing canonical upload gate and shared file classifier now accept WebM.
The duration probe's existing unknown-container behavior remains conservative:
WebM can reserve the configured per-item ceiling rather than trusting the client
clock. Actual provider usage settles through the existing budget flow.

Microphone purpose strings and UI copy cover all eleven locales. The image-picker
plugin's previous explicit microphone ban is removed: on Android it would have
blocked the audio module's permission. Background recording and background
playback capabilities are disabled. Privacy/store reference documents describe
saved microphone notes under the existing audio category.

Sources checked for the platform integration:
[Expo SDK 55 audio](https://docs.expo.dev/versions/v55.0.0/sdk/audio/),
[MediaRecorder MIME types](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType),
[Deepgram supported formats](https://developers.deepgram.com/docs/supported-audio-formats).
The existing pipeline/provider choice is unchanged.

## Verification

- Mobile, core and web TypeScript checks and lint pass. The only mobile lint
  warning is the pre-existing `purchaseService.ts` explicit `any`.
- Ruff passes for the audio-format gate; mypy passes across 213 backend files.
- Web production build and final Expo iOS/Android exports pass. Existing warnings
  concern web bundle size, local API configuration and missing local Sentry config.
- Expo config introspection contains the localized microphone purpose, Android
  `RECORD_AUDIO` without a blocked entry, and no iOS audio background mode.
  Autolinking from `mobile/` resolves `ExpoAudio` / `AudioModule` 55.0.18.
- Manual Chrome review used the real recorder component with a synthetic tone
  substituted for microphone input, without an API call or real microphone access.
  Light/dark rendering, automatic start, pause/resume, discard/cancel, permission
  refusal and hidden-tab pause were exercised. Save produced a nonempty WebM/Opus
  File; tracks were ended on save and immediately on confirmed discard. The
  temporary preview was removed. No automated tests were added or run.

Native permission dialogs, actual microphone capture and end-to-end ingestion
remain to be checked on physical iOS/Android devices after distribution. The
native exports validate bundling, not hardware recording or a deployed backend.

## Delivery

Commit and local merge on `main` are authorized by the owner. This session does
not push, deploy or distribute. After pushing, deploy the API WebM format gate
before releasing browser capture; deploy the web build and updated privacy page.
Both mobile platforms require **new binaries**, because `expo-audio` and the
microphone permission change the runtime fingerprint. An OTA alone cannot add it.

From `mobile/`, distribute through the existing internal profiles:

```sh
eas build --platform ios --profile internal --auto-submit --non-interactive
eas build --platform android --profile internal --auto-submit --non-interactive
```

On devices, check the exact interaction above, first-use/refused/revoked
permission, background/foreground and phone-call interruption, then confirm that
a saved note enters its intended folder and becomes readable after processing.
