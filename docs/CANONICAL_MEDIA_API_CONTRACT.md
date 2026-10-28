# Canonical Media API Contract (Frozen)

Frozen on February 24, 2026 for task-19.

This document is the contract baseline for:
- backend implementation tasks (`task-10`, `task-20`, `task-21`, `task-22`, `task-33`)
- mobile/web client implementation tasks (`task-39`, `task-7`)

Pre-production policy for this roadmap:
- canonical API paths are unversioned
- no runtime fallback to legacy podcast-specific contracts in target state

## Scope

This freeze defines:
- canonical request/response contracts for ingestion, status, artifact creation, and artifact reads
- domain types and statuses for `MediaItem`, `MediaArtifact`, and processing lifecycle usage
- stable error payload and error code catalog for client handling

## Source of truth in code

Backend contract models:
- `media_summarizer/api/models/media_contracts.py`

Frontend contract types:
- `front/src/types/media.ts`

## Runtime implementation status

`task-10` implements the canonical ingestion entrypoint:
- `POST /api/media/ingest-url` in `media_summarizer/api/endpoints/media.py`
- authenticated with the same bearer auth context used by existing API endpoints
- wired to the hexagonal ingestion core (`build_default_ingest_url_use_case`)

Operational behavior now implemented in runtime:
- deterministic URL normalization via canonical media identity derivation
- every successful save gets a fresh opaque `media_item_id`, even when the same user
  saves an equivalent URL several times
- processing and transcription are globally deduplicated by canonical `media_key`;
  equivalent links share the content job without sharing a library row
- response returns both `media_item_id` and `processing_job.job_id` for client tracking
- invalid/unsupported URL errors are explicit and stable (`INVALID_URL`, `UNSUPPORTED_URL`)

`task-22` implements the canonical media status read entrypoint:
- `GET /api/media/{media_item_id}` in `media_summarizer/api/endpoints/media.py`
- authenticated with ownership checks against the current user

Operational behavior now implemented in runtime:
- status response is built from current `ProcessingJob` state with canonical lifecycle mapping
- terminal state details are surfaced through `processing_job.completed_at` and `error_code`; there is
  no `error_message` — see "Ingestion failure contract" below
- stable not-found and unauthorized errors are returned as `MEDIA_NOT_FOUND` (404) and `NOT_AUTHORIZED` (403)
- the media status response carries **no** artifact projection (task-270): artifacts are a per-scope, append-only history, so "the artifact of this type" no longer exists as a concept
- transcript metadata (`language`, `segments_count`, `duration_seconds`) is surfaced when the runtime has persisted it from transcription or article extraction
- `transcript.duration_seconds` is the length of the media itself and nothing else: the audio length Deepgram processed (`transcription_metadata.audio_duration_seconds`), else the length the platform reported before transcription (`extraction_metadata.audio_duration_seconds`, yt-dlp on TikTok), else the copy on the library row (which outlives the job, and carries the podcast index's length on the search path). It is `null` everywhere else — articles, posts, documents, photos, and transcripts that came from captions, whose media length was never measured — and the app then shows no duration. No processing time is ever stored under a `duration_seconds` key in job metadata; how long a step took lives on `ProcessingJob.*_duration`

`task-270` makes artifact generation **scope-addressed** and its storage **append-only**:
- one set of routes under `/api/artifacts` serves a single media (`scope="media"`) and a folder (`scope="folder"`); the per-media routes are gone, with no alias
- a folder-scoped artifact covers the folder **and all its descendants**, exactly like `GET /api/media?folder_id=` — or only the sources the request chose among them (`parameters.source_ids`, §3, task-532)
- every generation writes a **new immutable entry** carrying a snapshot of the sources it read; nothing is overwritten, nothing is invalidated, and adding or removing a media from a folder changes no existing entry
- an existing entry is reused **permanently** (task-322): the `artifact_id` is a hash of (user, scope, scope_id, type, parameters, sorted source ids) with no time component, so a request whose source set already produced an artifact returns that artifact, whatever the delay, without a second generation and without debiting quota. A media therefore gets one artifact per type and per `parameters` — the output language (the reading language, or the one the request pinned, task-533) plus the generation options set away from their defaults (§3, task-531); a folder regenerates only when its contents, or the sources chosen among them, changed. The generator version is recorded on the entry but excluded from the key, so bumping a prompt does not reopen a right to regenerate
- **a media-scoped generation is paid for once per content, not once per account** (task-394). Under each account's entry sits a *shared generation* keyed on the content alone — the same hash minus the user — so the second account to ask for the same type in the same language over the same content is served by the generation the first one paid for, with no provider call. It applies to every media-scope type, `review_blurb` included, and to folder scope not at all. Two things it deliberately does not change: **the listing** (an account still sees only the entries it asked for; a shared generation is indexed under a scope key no account can produce and is not addressable through the API), and **the quota** (an account is debited whether or not a generation ran, because it gains an artifact either way — the avoided provider call is the operator's saving). Artifacts over a **user-uploaded file** are excluded, since the content identity of an upload is itself account-scoped
- ownership is checked by comparing the entry's `user_id`, not by resolving a media item — a folder artifact has none
- a media-scoped request still accepts a user-owned `media_item_id`, but storage and
  history use `(user_id, media_key)` internally, so the same user's saves of one
  content item share their artifact history
- ceilings are 25 sources and 120 000 estimated tokens; beyond them the API refuses and never truncates

`task-23` purges legacy ingestion/completion compatibility from active canonical paths:
- canonical runtime idempotence/watchers use `media_key` only (no legacy episode-guid fallback reads/writes)
- worker completion events and fan-out finalization rely on `media_key`/`canonical_job_id` identity only
- legacy episode-guid table/env references are removed from canonical runtime config and migration docs

## Canonical endpoints

### Beta capacity (TASK-550)

`GET /api/entitlements/status` is the authenticated source for both clients.
It returns `user_id`, `subscription_tier`, `subscription_status`, `is_active`,
`is_free_trial`, `is_beta_access`, `auto_renew_status`, and `budget`:

```json
{
  "state": "available",
  "consumed_percent": 25.5,
  "reserved_percent": 10,
  "available_percent": 64.5,
  "open_operations": 2,
  "open_reservations": 3,
  "warning_threshold_percent": 80,
  "resets_at": "2026-11-01T00:00:00+00:00"
}
```

This is a projection of `beta_budget`, never a conversion of minutes. Consumed
means settled usage only, excluding open reservations; it can exceed 100 after
a provider overrun. Available subtracts both settled usage and reservations and
is floored at zero. A release returns its reservation, without erasing operator
spend or increasing consumed usage. No prices, currency amounts or purchase
suggestions travel to the apps. All minute gauge fields and their aliases are
removed. `state` is `available`, `exhausted`, `unavailable` or `closed`; numeric
fields are null for the last two, never a fictitious zero/full allowance. The
reset is the first instant of the next UTC calendar month, without carry-over;
on a closed formula this date does not promise renewed access.
Warnings use the backend's `warning_threshold_percent`, applied to settled usage.

Counts describe all still-open operations/attempts, including previous-month
work whose holds stay in its original month. The counter is strongly consistent;
counts use the sparse open-attempt index and are eventually consistent. They are
not a transactionally frozen snapshot and never authorize an operation.

`POST /api/entitlements/forecast` is authenticated and read-only. Its request has
`operation` (`audio_import`, `document_import`, `generation`, `chat_turn`), and
the known metadata: positive `duration_seconds`; positive `document_units` with
`document_unit: page|sheet`; or positive `input_tokens` for the **complete** LLM
request including instructions, schema and history. `include_translation`
defaults to true for imports; false is appropriate only when no translation is
needed. Unknown quantities reserve the configured ceiling in the estimate.
Models, prices, output ceilings, conversion and component rounding come from
the same builders as actual admission; callers cannot supply a price or model.
Imports include the automatic preview and translation. Sheet text uses the
document text ceiling. This estimate covers the named path, not an arbitrary
URL's unknown collector/fallback chain or a prediction of actual billed tokens.
For paths whose metadata/route is not yet known, clients must display no forecast.

The response has `state: estimated|refused|unavailable`, nullable
`reservation_percent`, `available_percent`, `fits_available`, nullable `refusal`,
`params` and `resets_at`. A known estimate can have `fits_available: false` and
`refusal: budget_exhausted`. Unknown pricing/counter state is `unavailable`, with
null figures, never zero. Per-item excess is `refused/item_too_large`. This is
an advisory reservation bound, not final consumption or an admission guarantee:
no provider call or hold is created. Only the later conditional ledger write
admits work; final provider metrics settle it and release unused capacity.

All synchronous budget refusals carry `X-Quota-Error-Code` and a structured
`detail` with `error_code`: `budget_exhausted` (403, optional `period_end`),
`item_too_large` (413, `quantity`, `measured`, `limit`), `budget_unavailable` (503),
or `not_entitled` (403). They are shared typed client errors, not reasons to buy
a subscription. Asynchronous jobs carry the corresponding uppercase failure
codes. Reading, organising and consulting available results remain accessible.

1. `POST /api/media/ingest-url`
2. `GET /api/media/{media_item_id}`
3. `POST /api/artifacts`
4. `GET /api/artifacts?scope=&scope_id=`
5. `GET /api/artifacts/{artifact_id}`
6. `GET /api/artifacts/{artifact_id}/content`
7. `DELETE /api/media/{media_item_id}`
8. `PATCH /api/media/{media_id}`
9. `POST /api/chat/conversations`, `GET /api/chat/conversations?scope=&scope_id=`, `GET /api/chat/conversations/{conversation_id}`, `DELETE /api/chat/conversations/{conversation_id}`, `POST /api/chat/conversations/{conversation_id}/turns`, `POST /api/chat/conversations/{conversation_id}/turns/{turn_id}/stop` (see "Chat conversations")

Authentication:
- all endpoints require authenticated user context (Cognito access token, verified by the shared dependency; see `AUTHENTICATION_SETUP.md`)

## Request and response contracts

### 1) POST /api/media/ingest-url

Request (`IngestUrlRequest`):
```json
{
  "url": "https://open.spotify.com/episode/6rqhFgbbKwnb9MLmUQDhG6",
  "source_app": "android.share_sheet",
  "locale": "fr-FR",
  "transcript_language": "fr",
  "idempotency_key": "mobile-share-4b7e8d",
  "folder_id": "folder_01JQ8X8J5S3H3CXX8V70M9M3K7"
}
```

`transcript_language` and `folder_id` are optional. When `folder_id` is omitted or `null`,
the backend assigns the user's default Uncategorized folder. A provided folder id
must belong to the authenticated user.

`transcript_language` is a **per-submission override**. When omitted, the backend defaults to the
authenticated user's `reading_language` preference (set during onboarding, editable in Settings via
`PATCH /api/auth/me`). Clients should therefore send it only when the user explicitly wants a
different language for this one item (e.g. keeping an English video's original transcript while
their reading language is French). The value is normalized to a bare lowercase ISO 639-1 code
(`"fr-FR"` → `"fr"`) and travels to the ingestion worker, which asks the transcript provider for
that language. If the video has no captions in that language, the provider returns its default
track. The reader and search then use the reading language captured on the
new library entry, independently of the account preference at any later date.
The caption-track override does not override that saved reading language.

**The reading language belongs to each save (task-545, owner decision 2026-10-26).**
Every ingestion entrypoint, uploads and duplicate saves included, captures the
account's current `reading_language` in its new `user_media` row. It is immutable,
independent of the source `language` and excluded from the global `media_key`:
the same content remains shared while two saves may read in different languages.
Changing the account preference affects subsequent saves only. It translates no
existing media, preview or artifact, including when these are reopened. An unset
saved language means source text; reads never fall back to the current profile.

`GET /api/media/{id}/raw-content` resolves the saved language. The source text is
available through `variant=original`; while a translation is pending or failed,
the existing response metadata describes that state alongside the source text.
Translations are still cached once per `(source transcript, target language)`.
No per-media language-changing action is introduced.

`GET /api/search/transcripts` searches the title, creator and full text indexed
for each save. The text is the ready translation into that save's fixed language,
or the source text when already in that language (or no target was captured).
Foreign source text is never indexed while its translation is pending or failed;
an unknown source language is likewise not indexed under a declared target.
The initial index message waits with delayed checks bounded to one hour, and a
successful translation also wakes all matching saves, including a recovery after
an earlier failure. A profile change dispatches no index work. Re-saving the same
link creates a new library id and captures the new preference without deleting the
previous save. No historical index rebuild or data migration accompanies this rule.

Response (`IngestUrlResponse`):
```json
{
  "media_item": {
    "media_item_id": "med_01JQ8X8J5S3H3CXX8V70M9M3K7",
    "media_key": "mkey_v1_4f3b7f1c...",
    "original_url": "https://open.spotify.com/episode/6rqhFgbbKwnb9MLmUQDhG6",
    "normalized_url": "https://open.spotify.com/episode/6rqhFgbbKwnb9MLmUQDhG6",
    "media_type": "podcast_episode",
    "source_platform": "spotify",
    "status": "processing",
    "transcript": {
      "status": "pending"
    },
    "created_at": "2026-02-24T20:20:00Z",
    "updated_at": "2026-02-24T20:20:00Z"
  },
  "processing_job": {
    "job_id": "job_01JQ8X8J5T9Q5V7Q4TW4N1HY03",
    "status": "pending",
    "progress": {
      "percentage": 0,
      "stage": "pending"
    },
    "created_at": "2026-02-24T20:20:00Z",
    "updated_at": "2026-02-24T20:20:00Z"
  },
  "deduplicated": false
}
```

### 2) GET /api/media/{media_item_id}

Response (`MediaStatusResponse`):
```json
{
  "media_item": {
    "media_item_id": "med_01JQ8X8J5S3H3CXX8V70M9M3K7",
    "media_key": "mkey_v1_4f3b7f1c...",
    "title": "LE MEILLEUR DE BOUVARD - La blague de Carlos",
    "original_url": "https://open.spotify.com/episode/6rqhFgbbKwnb9MLmUQDhG6",
    "normalized_url": "https://open.spotify.com/episode/6rqhFgbbKwnb9MLmUQDhG6",
    "media_type": "podcast_episode",
    "source_platform": "spotify",
    "status": "ready_for_artifacts",
    "transcript": {
      "status": "ready",
      "source": "deepgram",
      "language": "fr",
      "segments_count": 583,
      "duration_seconds": 3540.1
    },
    "review_blurb": {
      "hook": "Bouvard fait raconter à Carlos la blague qu'il rate à chaque fois.",
      "points": [
        "Carlos s'emmêle dans la chute et la salle part avant lui",
        "Bouvard relance trois fois sans jamais donner la réponse"
      ]
    },
    "review_blurb_status": "ready",
    "created_at": "2026-02-24T20:20:00Z",
    "updated_at": "2026-02-24T20:37:10Z"
  },
  "processing_job": {
    "job_id": "job_01JQ8X8J5T9Q5V7Q4TW4N1HY03",
    "status": "ready_for_artifacts",
    "progress": {
      "percentage": 100,
      "stage": "ready_for_artifacts"
    },
    "created_at": "2026-02-24T20:20:00Z",
    "updated_at": "2026-02-24T20:35:30Z",
    "started_at": "2026-02-24T20:20:04Z",
    "completed_at": "2026-02-24T20:35:30Z"
  }
}
```

**Readiness is the availability of the content, not the ingestion worker's last write
(task-498).** A worker may persist its completed job before the completion-event consumer
publishes the transcript in the global content ledger. Until that publication, the detail
response stays `processing_job.status: extracting`, `media_item.status: processing` and
`transcript.status: extracting`, with no `completed_at`. Once the ledger resolves the text,
the response may announce completion. No transcript location is read from the job as a
fallback. If neither a transcript nor a surviving job exists for an otherwise finished
item, it is reported as failed rather than left waiting indefinitely.

The preview is independent: text can be ready while `review_blurb_status` remains `pending`.
A ready preview always travels with its prose in the same response. If the library copy is
missing, the detail read resolves the stored ready artifact, serves its body and repairs the
copy best-effort; a failed copy does not hide readable prose. This handles generation
finishing during the detail read as well as projection writes that failed. A missing or
unreadable ready body is reported as failed, never as a ready empty card.

`transcript.language` takes the first real normalized code from the content ledger, detected
job language, declared job/extraction language and library metadata. Placeholder tags such as
`unknown` and `und` are skipped; when none names a language, the field is null.

`media_item.origin_url` is the page a note saved from the browser extension was selected on, and
null for anything else (see "Shared text and the page it came from" below).

`media_item.title` is the `title` attribute of the durable `user_media` row, i.e. the exact value
`GET /api/media` returns for the same item — the detail header and the list vignette read one field,
not two. It is nullable: nothing the source exposed survived the derivation rules
(`media_summarizer/core/media_ingestion/title_derivation.py`). Never a URL path segment, which used
to surface raw provider ids such as a Spotify episode id as a title.

**`title_label_key` names an untitled media (task-400).** It is set on exactly the rows whose `title`
is null, and it is the *key* of a label — `photo`, `article`, `podcast_episode`, `instagram_video`,
`x_post`, `voice_note`, `saved_item`… — not a label. The client renders `<label> — <created_at>` from
its own catalogues, in the reader's language and with a locale-formatted date; the backend builds no
such string, because storing one freezes English and a C-locale date into the row (an fr-FR tester
saw `Article — 10 Sep 2026`). `title` always wins when both are present, so a worker that later
learns the real title needs no cleanup write. A client that does not know a key falls back to its own
"Untitled". The same pair travels on every contract that carries a media title: `GET /api/media`
(list), `GET /api/media/{id}` (detail), `GET /api/search/transcripts` (hits) and
`GET /api/engagements/recent` (media tiles, where `created_at` is the media's save date, not the
engagement's).

#### Ingestion failure contract

A job that failed carries a **code**, and only a code:

```json
{
  "processing_job": {
    "job_id": "job_01JQ8X8J5T9Q5V7Q4TW4N1HY03",
    "status": "failed",
    "progress": { "percentage": 0, "stage": "failed" },
    "created_at": "2026-02-24T20:20:00Z",
    "updated_at": "2026-02-24T20:21:12Z",
    "started_at": "2026-02-24T20:20:04Z",
    "completed_at": null,
    "error_code": "NO_TRANSCRIBABLE_MEDIA"
  }
}
```

There is **no `error_message`** on this response, and there never will be: the
sentence the reader sees is built on the device from `error_code`, in the reader's
language, by `mobile/src/lib/getFriendlyErrorMessage.ts`. That is RFC 9457's split
between `type` (stable, part of the contract) and `title`/`detail` (negotiated,
never depended upon), and AIP-193's rule that a `message` is developer-facing
English. Sending English prose here is what put "Unable to extract transcribable
media from this Instagram URL." on an `fr-FR` screen (task-359).

The vocabulary is `MediaFailureCode` in
`media_summarizer/core/models/failure_codes.py` — the source of truth, whose
docstring states the rules for adding a member. As of task-384:

| Group | Codes |
|---|---|
| The source cannot yield what we need | `MEDIA_UNAVAILABLE`, `GEO_RESTRICTED`, `AGE_RESTRICTED`, `LIVE_CONTENT_UNSUPPORTED`, `NO_TRANSCRIBABLE_MEDIA`, `NO_TRANSCRIPT_AVAILABLE`, `POST_TEXT_EMPTY`, `NOT_AN_ARTICLE_PAGE`, `ARTICLE_TEXT_NOT_FOUND`, `DOCUMENT_PARSE_FAILED` |
| The extraction chain is at fault | `PROVIDER_UNAVAILABLE`, `PROVIDER_RESULT_INVALID`, `PROVIDER_RATE_LIMITED`, `PROVIDER_TIMED_OUT` |
| Our configuration or budget | `PROVIDER_AUTH_FAILED`, `PROVIDER_CREDITS_DEPLETED`, `PROVIDER_CONFIG_ERROR` |
| The user's budget (task-549, `docs/BETA_BUDGET_CONTROL.md` §7) | `BUDGET_EXHAUSTED`, `ITEM_TOO_LARGE`, `BUDGET_UNAVAILABLE` |
| Ours, and only ours | `INVALID_JOB_MESSAGE`, `SUBMISSION_FAILED`, `UNEXPECTED_ERROR` |

`error_code` is typed as the enum, so a value outside it cannot be serialized; a
row whose stored code is unknown to the current build is served as `null`, and the
app degrades to its generic failure line rather than showing anything raw.

Everything *variable* about a failure — an HTTP status, a provider name, an Apify
run id, a duration, a content type — lives in `ProcessingJob.error_metadata`
alongside a stable lower-snake `reason` token. That attribute is **diagnostic and
not part of this contract**: it is served only by the operational
`GET /jobs/{job_id}` router and is absent from every library response. The
provider's own wording is never persisted; it reaches CloudWatch through
`exc_info` on the worker's terminal log event.

### 3) POST /api/artifacts

Request:
```json
{
  "scope": "folder",
  "scope_id": "c4ef2e55-8449-4a71-be46-bcf1a6eeca3e",
  "artifact_type": "quiz",
  "parameters": {
    "count": "fewer",
    "difficulty": "hard",
    "focus": "the pop-up and how to time it",
    "source_ids": [
      "0b7d4c1e-2f3a-4e5b-9c6d-7e8f9a0b1c2d",
      "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d"
    ]
  }
}
```

`parameters` is optional and carries the **generation options** of the
"Personnaliser" screen (task-531). Each applies to some types only:

| Key | Values | Types | Default |
|---|---|---|---|
| `length` | `short`, `medium`, `long` | `summary_short` | `short` |
| `count` | `fewer`, `standard`, `more` | `quiz`, `flashcards` | `standard` |
| `difficulty` | `easy`, `medium`, `hard` | `quiz`, `flashcards` | `medium` |
| `focus` | free text, at most 300 characters once trimmed and its whitespace runs (newlines included) collapsed to one space | `summary_short`, `notes`, `quiz`, `flashcards` | none |
| `source_ids` | non-empty list of distinct `media_item_id`s of the folder or its subfolders | `summary_short`, `notes`, `quiz`, `flashcards` — **`scope=folder` only** | every source of the folder |
| `language` | a reading language: `fr`, `en`, `es`, `de`, `it`, `pt`, `nl`, `ja`, `zh`, `ar`, `hi`, or any tag that normalizes to one (`EN-US` is `en`) | `summary_short`, `notes`, `quiz`, `flashcards`, on a media as on a folder | the save's captured language (media); the current account preference (folder) |

- **Defaults are not stored.** An option at its default value, a `focus` that is
  empty once cleaned, and a JSON `null` are dropped before the `artifact_id` is
  computed. A request spelling out every default is therefore *the same request*
  as one with no `parameters`: same `artifact_id`, same shared generation
  (task-394), and every artifact generated before the options existed still
  answers it. Any other option set is a different artifact, generated and debited
  like any first request.
- **What each option does.** `length` keeps the summary's schema (`title`,
  `key_points`, `takeaway`) and changes its depth: `short` is the digest format,
  `medium` adds one sentence of explanation to each point, `long` covers the whole
  material with every source in proportion, at the depth of the former detailed
  summary. `count` moves the number of questions or cards against what the material
  carries: `standard` lets the material decide, `fewer` keeps the essentials (about
  half), `more` reaches the secondary points (about double) — never by inventing.
  `difficulty`: `easy` is direct recall of stated facts, `medium` the usual level,
  `hard` asks to apply, compare or explain, with plausible quiz distractors. `focus`
  is the topic the reader wants favoured: it is passed to the model as the reader's
  quoted words, never as an instruction, and when the sources do not treat the
  topic the artifact says so instead of inventing (in the first key point of a
  summary, the `context` of notes, the `title` of a quiz or a deck).
- **`source_ids` chooses the sources of a folder** (task-532), as the
  "Personnaliser" screen's source picker does, every source ticked by default.
  The ids are the `media_item_id`s the folder listing returns. The resolution is
  limited to them *before* any transcript is read, and everything that follows
  applies to that part of the folder alone: a chosen source still being
  transcribed is waited on, a chosen source with no usable text is listed as
  excluded, the ceilings (`scope_too_large`, `scope_empty`) count the chosen
  sources, provider calls reserve and settle the common beta budget, and the
  entry's `source_count` and `sources` describe the subset. `source_ids` itself is
  **not stored in `parameters` and not hashed a second time**: the chosen sources
  enter the `artifact_id` as its source ids, like any source set. So a list naming
  every source of the folder *is* the request without the option — same
  `artifact_id`, same entry — and two requests choosing the same sources are one
  artifact. Refused with the `422` below: on `scope=media` (`not_applicable`, a
  media has one source), as an empty list, a non-string id or a repeated id
  (`invalid_value`), and when an id is not a media of this folder or its
  subfolders in the caller's library (`not_in_scope`) — checked once the folder is
  listed and before any transcript is read, so nothing is written or debited.
- **`language` chooses the language the artifact is written in** (task-533).
  By default it is the language captured on the save for media scope (task-545),
  or the account's current reading language for folder scope.
  - **equal to that default**, it is the request without the option: same
    `artifact_id` and same shared generation;
  - **another language** becomes the output language and is part of the
    `artifact_id`. The entry is stored with `"language_pinned": true` next to
    `"language"` in `parameters`, and both are hashed. The marker is set by the
    service only: a client sending `language_pinned` gets `unknown_parameter`;
  - across accounts (task-394), an explicit pinned language only serves requests
    pinning the same language over the same content, since the marker is in the
    shared key.

  Every existing entry stays in its output language, whether pinned or default.
  Account preference changes never translate entries when listed or opened.

  A value that is not a string or does not normalize to a reading language is
  `invalid_value`.
- Anything else — an unknown key, a value outside its list, an option on a type it
  does not apply to (`count` on `notes`, `length` on `quiz`) — is the typed `422`
  `invalid_artifact_parameters` below. It is checked before anything is read: no
  entry is written and nothing is debited.

`202` when a generation was queued, `200` when the response is an entry that
already existed. Response is the shape of `GET /api/artifacts/{artifact_id}` plus
`generation_outcome`, which names the four cases the caller must be able to tell
apart:

| `generation_outcome` | Status | Meaning | Quota |
|---|---|---|---|
| `created` | `202` | First request for this source set: entry written and queued | debited |
| `retried` | `202` | The entry for this key had `failed`, so it is reclaimed and queued again | debited (idempotent on `artifact_id`, so a retry of the same id charges nothing extra) |
| `reused` | `200` | A generation already covers this source set; nothing is queued | **untouched** if the caller already held this entry; **debited** if it was another account's generation that answered (task-394) |
| `collapsed` | `200` | A concurrent identical request won the conditional write; this one hands back the winner | untouched (the winner is the one charged, under the same `artifact_id`) |

`reused` and `collapsed` are deliberately distinct: the first says "this content
was already generated, possibly days ago and possibly for somebody else", the
second says "this was the same tap". Both are logged under their own event
(`artifact.reused`, `artifact.shared_generation_reused`, `artifact.collapsed`).

The status code says whether a **generation** was started, never whether the quota
moved. Those became two different questions with cross-account reuse: an account
being handed an artifact another account paid the provider for gains that artifact,
so it is charged for it, and the `200` only means no model was called. What is never
charged twice is an entry the caller already holds.

**A source still being prepared is not a refusal** (task-360). A request whose
transcription has not finished is *accepted*: the entry is written `queued`
exactly like any other, `created` is returned with the same `202`, the quota is
debited once there and then, and nothing is put on the generation queue yet. The
end of the ingestion (`media_completed_worker`) is the join point that enqueues
it, with no second call from the client. So the entry appears in
`GET /api/artifacts?scope=…` as `queued` from the moment of the tap, survives
leaving the screen, and turns into `generating` then `ready` by itself. The
deferred request and the generation that follows it are **one entry and one
debit**: the `artifact_id` hashes the sources still in preparation in alongside the
readable ones, so the id does not move when they land.

Transcription is the **only** preparation a generation ever waits on. A media in
a language the user does not read is generated immediately: the corpus is each
source's original transcript and the output language travels in the prompt, via
`parameters["language"]` (the scope's default language, or the language the
request pinned, part of the `artifact_id` hash). Nothing on this endpoint
translates a transcript, so a foreign media asked for the second it lands starts
straight away (task-398). The reader's full-text translation
(`GET /api/media/{id}/raw-content`) is a separate, non-blocking path and is
unaffected.

A wait is bounded. `awaiting_expires_at` is stamped on the entry
(`ARTIFACT_AWAITING_TIMEOUT_SECONDS`, one hour by default) and an expired wait
becomes `failed` with `sources_preparation_timeout` — no entry stays `queued`
forever. A preparation that will not complete ends the wait early with
`sources_preparation_failed`: an ingestion that failed or produced no readable
transcript. `sources_changed` is the residual case where the scope's
sources moved while the entry waited, so the generation would no longer be the one
that was asked for. An entry over chosen sources (`source_ids`) resumes over those
same sources, not the whole folder; one of them leaving the folder meanwhile is
`sources_changed` too.

Typed refusals:

| Situation | Status | `error_code` | Retryable |
|---|---|---|---|
| `parameters` holds a key or a value the type cannot take, or a `source_ids` the folder cannot satisfy | `422` | `invalid_artifact_parameters` | no |
| No source at all in the scope, or every source definitively unusable | `422` | `scope_empty` | no |
| More than 25 sources, or more than 120 000 estimated tokens | `422` | `scope_too_large` | no |
| Budget cannot cover a paid operation | `403` | `budget_exhausted` | after reservations release or the next UTC month |
| Artifact type disabled | `400` | — | no |
| Generation disabled globally | `503` | — | no |

`invalid_artifact_parameters` names the offending key in `parameter` and why in
`reason`, so a client tells a bug of its own from a contract it misread:

```json
{
  "detail": {
    "error_code": "invalid_artifact_parameters",
    "message": "'count' does not apply to notes.",
    "parameter": "count",
    "reason": "not_applicable"
  }
}
```

| `reason` | Meaning |
|---|---|
| `unknown_parameter` | The key is not a generation option |
| `not_applicable` | The option exists but not for this `artifact_type` — or, for `source_ids`, not for `scope=media` |
| `invalid_value` | A value outside the option's list, a `focus` that is not a string, a `focus` longer than 300 characters once cleaned, a `source_ids` that is not a non-empty list of distinct string ids, or a `language` that is not a string or not a reading language |
| `not_in_scope` | An id of `source_ids` is not a media of this folder or its subfolders in the caller's library |

An unknown `artifact_type` keeps its `400`, whatever its `parameters`.

`scope_too_large` carries the four numbers the client displays, so it computes
nothing: `source_count`, `max_sources`, `estimated_tokens`, `max_tokens`.

There is no `409` on this endpoint any more: the two situations that produced one
are both gone. A source still being prepared is waited on rather than refused
(task-360), and a source in a foreign language is read as it is (task-398), so no
generation can be blocked by the state of a translation.

Every paid generation, media and folder alike, reserves the common beta budget
before its provider call and settles on the actual usage (TASK-549). Reused
stored artifacts invoke no provider. A budget refusal uses the typed contract
above; clients render its code and parameters through their shared catalogues.

### 4) GET /api/artifacts?scope=&scope_id=

A scope's whole history, **newest first, all types mixed**, several entries of the
same type included. This is also the progress endpoint: in-flight entries appear
with `queued` or `generating`, so a client polls once per scope and never once per
artifact type.

```json
{
  "scope": "folder",
  "scope_id": "c4ef2e55-8449-4a71-be46-bcf1a6eeca3e",
  "artifacts": [
    {
      "artifact_id": "art_9f3c...",
      "artifact_type": "notes",
      "status": "ready",
      "title": "Les limites du scaling",
      "source_count": 7,
      "created_at": "2026-08-17T09:12:44Z",
      "completed_at": "2026-08-17T09:13:31Z",
      "error_code": null
    },
    {
      "artifact_id": "art_1b70...",
      "artifact_type": "quiz",
      "status": "generating",
      "title": null,
      "source_count": 7,
      "created_at": "2026-08-17T09:12:44Z",
      "completed_at": null,
      "error_code": null
    }
  ],
  "next_cursor": null
}
```

These are exactly the attributes the `scope-index` GSI projects: a page costs one
DynamoDB query, with no read of the base table and no S3 access. `title` is
emitted by the model, which is what tells two entries of the same type apart.
`sources` is **not** in this response — it is only returned when one entry is
opened.

**Listing never translates existing artifacts (task-545).** Changing the
account's reading language affects subsequent media saves and future folder
requests; reopening an existing media neither translates nor regenerates its
artifacts. Its default generation language remains the one captured on the save.
An explicit artifact-language option remains available in the API (§3).

The per-content artifact history remains shared by the same account's saves of
that content, including entries in different languages. Each entry is immutable.
`review_blurb` is projected separately onto each save: only a preview whose output
language matches that save's captured reading language can fill its library card.
This applies to completion fan-out and to repairing a missing card at read time.

### 5) GET /api/artifacts/{artifact_id}

The same fields plus the scope and the immutable source snapshot:

```json
{
  "artifact_id": "art_9f3c...",
  "artifact_type": "notes",
  "status": "ready",
  "title": "Les limites du scaling",
  "source_count": 7,
  "created_at": "2026-08-17T09:12:44Z",
  "completed_at": "2026-08-17T09:13:31Z",
  "error_code": null,
  "scope": "folder",
  "scope_id": "c4ef2e55-8449-4a71-be46-bcf1a6eeca3e",
  "sources": [
    {
      "media_item_id": "med_01JQ8X8J...",
      "title": "Scaling laws revisited",
      "language": "fr",
      "excluded": false,
      "excluded_reason": null
    }
  ],
  "s3_key": "notes/art_9f3c....json",
  "request_parameters": {
    "count": "fewer",
    "focus": "the pop-up and how to time it",
    "source_ids": ["0b7d4c1e-2f3a-4e5b-9c6d-7e8f9a0b1c2d"]
  }
}
```

`request_parameters` is the `parameters` of a `POST /api/artifacts` (§3) that asks
for **this entry** again (task-535): its options (`length`, `count`, `difficulty`,
`focus`), its `language` only when the request pinned one, and the sources a folder
request chose as `source_ids`. An entry at the defaults answers `{}`. It is what a
client sends to rerun a `failed` entry without asking its user anything again: the
entry's id is the hash of what its request carried, so a rerun at the defaults would
land on another entry. The reading language an entry was written in is deliberately
not echoed — sent back, it would pin it (§3). The field costs no extra read, since
it comes off the entry this route already reads; the listing (§4) does not carry
it, so a client rerunning a failed row of the list reads the entry first.

A source with `excluded: true` was in the scope but carried no usable transcript:
it is recorded rather than dropped, so the entry stays honest about what it could
not read. The snapshot describes the scope **at generation time** — it is expected
to diverge from the folder's current contents, and that divergence is the
history rather than a defect.

### 6) GET /api/artifacts/{artifact_id}/content

The stored JSON payload, inlined, in the language the entry was written in. This
route never arms a translation, for a pinned entry (§3) or any other. Neither
listing nor content reads translate entries after a preference change (§4).

`409` while the entry is not `ready`, as a typed refusal whose `error_code` — never
the message text — says whether the entry is still coming (task-328):

```json
{
  "detail": {
    "error_code": "artifact_not_ready",
    "message": "Artifact is still being generated (status: generating). Try again once generation completes.",
    "status": "generating"
  }
}
```

```json
{
  "detail": {
    "error_code": "artifact_failed",
    "message": "Artifact generation failed and will not resume on its own. Request a new generation for this scope and type.",
    "status": "failed",
    "artifact_error_code": "LLM_ERROR",
    "scope": "media",
    "scope_id": "med_01JQ8X8J5S3H3CXX8V70M9M3K7",
    "artifact_type": "notes",
    "request_parameters": { "focus": "the pop-up and how to time it" }
  }
}
```

`artifact_not_ready` resolves on its own, so a client may come back to it.
`artifact_failed` is **terminal**: no worker will pick the entry up again, and a
client that keeps polling it polls forever. The refusal therefore carries the
`scope`, `scope_id`, `artifact_type` and `request_parameters` (§5) a new generation
needs, so a failure state can offer `POST /api/artifacts` without a second
round-trip — that request, sent with those `parameters`, reruns the entry under its
own id (`generation_outcome: "retried"`) and debits nothing extra.

```json
{
  "artifact_id": "art_01JQ8ZNOTES...",
  "artifact_type": "notes",
  "scope": "media",
  "scope_id": "med_01JQ8X8J5S3H3CXX8V70M9M3K7",
  "status": "ready",
  "language": "fr",
  "content": {
    "artifact_id": "art_01JQ8ZNOTES...",
    "artifact_type": "notes",
    "scope": "media",
    "scope_id": "med_01JQ8X8J5S3H3CXX8V70M9M3K7",
    "generated_at": "2026-02-24T20:37:10Z",
    "source_count": 1,
    "sources": [
      {
        "media_item_id": "med_01JQ8X8J5S3H3CXX8V70M9M3K7",
        "title": "LE MEILLEUR DE BOUVARD",
        "language": "fr",
        "transcript_s3_key": "job_01JQ8X8J5T9Q5V7Q4TW4N1HY03.txt"
      }
    ],
    "generator_version": "notes:gpt-6-luna:prompt-v5",
    "llm_usage": {
      "model": "gpt-6-luna",
      "prompt_tokens": 4622,
      "cached_tokens": 0,
      "cache_write_tokens": 0,
      "completion_tokens": 1200,
      "cost_eur": 0.000913
    },
    "content": {
      "title": "...",
      "context": "2-3 sentences, or empty",
      "objectives": ["..."],
      "concepts": [
        {
          "term": "...",
          "explanation": "...",
          "importance": "core"
        }
      ],
      "key_points": ["..."],
      "notable_quotes": [
        {
          "text": "Verbatim passage",
          "source_ref": "[S1]"
        }
      ],
      "action_items": ["..."],
      "glossary": [
        {
          "term": "...",
          "definition": "..."
        }
      ]
    }
  }
}
```

The content response's top-level `language` is the immutable output language
from the entry's stored generation parameters (nullable when no target was set).
It is independent of the source languages in the S3 envelope and of the current
profile or interface language. Mobile and web use it for the artifact template's
section headings, question/answer labels and counts, with the reference English
catalogue when no supported target is available. Navigation and error messages
keep the interface language. No regeneration or S3 rewrite is needed.

Every content schema carries a `title` (3-80 characters) emitted by the model.
`notes.notable_quotes` is a list of `{text, source_ref}` where `source_ref` is
**required** — a quote is verbatim, so its origin is checkable. The list itself is
optional and empty when no passage is worth quoting. `notes.context` is 2-3
sentences setting the stage, or empty. Flashcards and quiz questions carry an
**optional** `source_ref`, null when the entry draws on several sources. `source_ref` is the corpus tag (`"[S2]"`), which
the client resolves through the index in `sources`; the model is never asked to
write a media id.

Canonical `notes` content shape for client rendering:
```json
{
  "artifact_id": "art_...",
  "media_item_id": "med_...",
  "artifact_type": "notes",
  "generated_at": "ISO-8601",
  "source": {
    "transcript_s3_key": "...",
    "generator_version": "notes:...:prompt-v5"
  },
  "content": {
    "context": "...",
    "objectives": [
      "..."
    ],
    "concepts": [
      {
        "term": "...",
        "explanation": "...",
        "importance": "core"
      }
    ],
    "key_points": [
      "..."
    ],
    "notable_quotes": [
      {
        "text": "...",
        "source_ref": "[S1]"
      }
    ],
    "action_items": [
      "..."
    ],
    "glossary": [
      {
        "term": "...",
        "definition": "..."
      }
    ]
  }
}
```

Malformed `notes` model output is handled with strict validation:
- strip optional markdown fences
- parse JSON
- validate required sections and item shapes
- mark artifact `failed` with `VALIDATION_ERROR` if validation fails
- never persist a degraded fallback payload as `ready`

### 7) DELETE /api/media/{media_item_id}

No request body.

Response (`DeleteMediaResponse`):
```json
{
  "status": "success",
  "media_item_id": "mi_9f2c1d0b7a4e5f6081c2d3e4f5a6b7c8",
  "deleted_at": "2026-08-13T09:41:02+00:00",
  "purge_at": 1758620462,
  "grace_days": 30
}
```

Semantics (task-243, §6.2 of the task-218 benchmark):
- the item leaves every read surface immediately: library reads skip soft-deleted rows and the search records are deleted synchronously
- `purge_at` is epoch seconds; after it, the row and its search records are destroyed
  irreversibly by the lifecycle worker; content-scoped artifacts and processing
  objects survive while another retained save row still references the same `media_key`
- inside the grace window a deletion is recoverable by support (clear `deleted_at`/`purge_at`)
- idempotent: deleting an already-deleted item returns `200` with the original `purge_at`, never `404`, and never pushes the purge date out
- re-ingesting the same URL creates a separate visible save with a new `media_item_id`;
  it does not revive or mutate the soft-deleted row
- `media_item_id` in the response is the same durable library id supplied in the path
- unknown or foreign id returns `404 MEDIA_NOT_FOUND`
- this is the only endpoint in the system allowed to schedule a library row for purge; retention rules are in `docs/DATA_RETENTION.md`

### 8) PATCH /api/media/{media_id}

Partial update of one library item: where it is filed, what it is called, or both.

Request (`PatchMediaRequest`):
```json
{
  "folder_id": "fld_01JQ8X8J5S3H3CXX8V70M9M3K7",
  "title": "Commonplace book"
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `folder_id` | string or null | no | Destination folder, `null` meaning Uncategorized. Routed to `folder_service.assign_folder_to_media`. |
| `title` | string | no | New user-facing title. Trimmed, with runs of whitespace collapsed, then **1 to 120 characters** (`MAX_TITLE_LENGTH` in `media_summarizer/core/media_ingestion/title_derivation.py` — the same ceiling ingestion derives titles under). Routed to `user_media.update_attributes`. |

Response (`PatchMediaResponse`):
```json
{
  "status": "success",
  "media_id": "mi_9f2c1d0b7a4e5f6081c2d3e4f5a6b7c8",
  "folder_id": "fld_01JQ8X8J5S3H3CXX8V70M9M3K7",
  "previous_folder_id": null,
  "title": "Commonplace book"
}
```

Semantics (task-264 for the folder half, task-346 for the title half):
- **which fields the body carries** drives the dispatch, not their value: an explicit `"folder_id": null` (move to Uncategorized) stays distinguishable from a body that says nothing about the folder
- the response reports only what the patch touched — `folder_id`/`previous_folder_id` are absent on a title-only patch, `title` is absent on a folder-only one
- a body carrying neither field is refused with `400 BAD_REQUEST` ("Nothing to update"), never answered with a success that changed no row
- a title that is blank, whitespace-only, or longer than the bound is refused with `422 VALIDATION_ERROR`; the value is normalized before storage, so what the response carries is what the library holds
- ownership is the `(user_id, media_item_id)` key itself, as for the folder move; an unknown or foreign id returns `404 MEDIA_NOT_FOUND`
- a rename also refreshes the `title` denormalized onto that media's search chunks (selected by the `media_item_id` filter), so results stop matching and displaying the old name. That refresh is best-effort: a search-index failure is logged as `user_media.rename_search_failed` and does not fail the request — the library row is the source of truth
- a rename touches the user-facing title only: `media_key`, `saved_at`, dedup identity and artifacts are untouched
- the path parameter is spelled `media_id` on this route; it carries the same durable library id as `{media_item_id}` elsewhere

## Chat conversations

Router `media_summarizer/api/endpoints/chat.py`, mounted under `/api/chat` (never `/api/v1/`), service `media_summarizer/core/services/chat_service.py`, storage `docs/CHAT_DATA_MODEL.md` (task-461). Owner decision: `docs/research/task-430-chatbot-architecture/README.md`, Owner Validation, points 1, 5 and 7. Sending a turn and stopping it are task-462; the SSE stream has its own door (task-464, "Chat stream" below).

Every route requires the app JWT (`get_current_user`). Every read and write is keyed on the caller's account, so a conversation of another account answers `404 conversation_not_found`, exactly like one that does not exist. Refusals carry a stable `error_code` and their figures in `detail`, **never a sentence**: the app words them in the reader's language.

### POST /api/chat/conversations

Opens a conversation over one media or one folder and freezes its sources.

Request:
```json
{ "scope": "folder", "scope_id": "fld_01JQ8X8J5S3H3CXX8V70M9M3K7" }
```

Response `201` — the detail shape below, with `messages: []` and `active_generation: null`.

Semantics:
- the scope is resolved like an artifact's: `resolve_scope_sources` then `enforce_scope_ceilings`. A folder covers the folder **and its descendants**, as the Sources tab does; the corpus ceilings are the artifacts' (`MAX_FOLDER_SOURCES`, `MAX_FOLDER_CORPUS_TOKENS`)
- the **source snapshot** is frozen here and never rewritten: readable sources first, in resolution order, then the excluded ones. Each source carries its citable `ref` (`[S1]`…), the tag the corpus gives it; `source_snapshot_version` fingerprints the ordered `(media_item_id, transcript_s3_key)` set. If the folder changes later, the conversation keeps its snapshot; a new conversation reads the new state

| Status | `detail.error_code` | Figures | When |
| --- | --- | --- | --- |
| 400 | `invalid_scope` | — | `scope` is neither `media` nor `folder` |
| 404 | `scope_not_found` | `scope` | the media or folder is not in this account |
| 409 | `scope_preparing` | `pending_count` | a source is still being transcribed: a frozen snapshot could never include it, so the app asks to come back later |
| 422 | `scope_empty` | — | no source with a usable transcript |
| 422 | `scope_too_large` | `source_count`, `max_sources`, `estimated_tokens`, `max_tokens` | over a corpus ceiling (same figures as the artifact refusal) |

### GET /api/chat/conversations?scope=&scope_id=&limit=&cursor=

One page of the history of a media or folder, **latest activity first**. `limit` 1–50, default 20. `cursor` is the opaque `next_cursor` of the previous page; a malformed cursor or one from another scope is `400 invalid_cursor`. Unknown or foreign scope: `404 scope_not_found`.

Response `200`:
```json
{
  "scope": "media",
  "scope_id": "mi_9f2c1d0b7a4e5f6081c2d3e4f5a6b7c8",
  "conversations": [
    {
      "conversation_id": "cv_5b0c…",
      "scope": "media",
      "scope_id": "mi_9f2c1d0b7a4e5f6081c2d3e4f5a6b7c8",
      "title": "What does the author mean by a commonplace book?",
      "turn_count": 3,
      "last_turn_status": "completed",
      "generating": false,
      "created_at": "2026-10-11T09:12:03.120000+00:00",
      "last_activity_at": "2026-10-11T09:20:41.502000+00:00"
    }
  ],
  "next_cursor": null
}
```

`title` is the first question cut to 120 characters, `null` until a first turn. `last_turn_status` is one of `accepted`, `generating`, `completed`, `failed`, `interrupted`, or `null`. `generating` is `true` while a turn is in flight.

### GET /api/chat/conversations/{conversation_id}

The conversation, its messages in order, and the generation to resume. What the app reads when it comes back to the foreground before resuming the stream or showing the final answer.

Response `200` — the summary fields above, plus:
```json
{
  "source_snapshot_version": "src_v1_3f1a…",
  "sources": [
    { "ref": "[S1]", "media_item_id": "mi_…", "title": "…", "language": "en", "excluded": false, "excluded_reason": null }
  ],
  "messages": [
    { "turn_id": "tn_…", "turn_index": 1, "role": "user", "text": "…", "created_at": "…" },
    { "turn_id": "tn_…", "turn_index": 1, "role": "assistant", "text": "…", "created_at": "…",
      "status": "interrupted", "interruption_cause": "cancelled", "error_code": null,
      "attempt_id": "at_…", "completed_at": "…" }
  ],
  "active_generation": { "turn_id": "tn_…", "turn_index": 2, "attempt_id": "at_…", "last_seq": 14 }
}
```

- `messages`: each turn's question then its answer, turns in order. Only assistant messages carry `status`, `interruption_cause` (`cancelled`, `output_limit`, `provider_error`, with `interrupted` only), `error_code`, `attempt_id`, `completed_at`. An assistant message with no `text` is a turn still running or one that failed before any text. `error_code` names why a turn failed or was cut, among them `dispatch_failed` (the turn could not be sent to its worker) and `generation_lost` (its generation was lost, see **Lost turns** below); every failed turn is offered for a retry, which is a new question with a new `client_request_id`
- **Lost turns.** A turn is never relaunched automatically. Its generation is lost when it waited in the queue more than 300 s without starting, or when its worker's lease ran out more than 15 s ago (`core/models/chat.is_attempt_lost`). This read seals such a turn before answering: `failed` / `generation_lost`, its budget released, when no text was shown; `interrupted` / `provider_error` with `error_code: generation_lost` and the partial text otherwise
- `active_generation`: the generation in flight — `(turn_id, attempt_id)` is the generation identity the stream is resumed with, `last_seq` the highest fragment sequence persisted for that attempt (`null` before the first). `null` when no turn is running
- unknown or foreign id: `404 conversation_not_found`

### POST /api/chat/conversations/{conversation_id}/turns

Accepts a question as a new turn. The answer is generated asynchronously: this call admits the turn on the beta budget, writes it, then sends it to the chat queue; nothing is generated by it. If the send fails, the turn comes back **already failed** — `status: "failed"`, read back with `error_code: "dispatch_failed"` — with its budget handed back, in a normal `202`; the app then offers a retry, which is a new question with a new `client_request_id`. Before its checks, the call seals a lost turn (see **Lost turns** above) that holds this conversation or the account, so a lost turn never blocks the next question.

Request:
```json
{ "question": "What does the author mean by a commonplace book?", "client_request_id": "0b9a6c1e-6b7f-4d0f-9a43-5b2f1f6a2c11" }
```

`client_request_id` (8–64 characters) is generated by the app **once per question** and sent again on a retry.

The mobile composer has no character counter or client-side length limit: typing
and pasting preserve the full draft. Size and total-context refusals are shown at
send time without clearing that draft. The 64 000-character server guard limits
the question text to at most 256 000 UTF-8 bytes, leaving metadata room under
DynamoDB's 400 KiB item limit; it does not replace the total-context check below.

Response `202` (or `200` on a replay, see idempotency):
```json
{
  "conversation_id": "cv_5b0c…",
  "turn_id": "tn_8e1f…",
  "turn_index": 3,
  "attempt_id": "at_41c2…",
  "status": "accepted",
  "replayed": false
}
```

Checks, in this order, before anything is written:

| Status | `detail.error_code` | Figures | Rule (constants in `core/services/chat_prompt.py`) |
| --- | --- | --- | --- |
| 422 | `question_too_long` | `length`, `max_chars` | `MAX_QUESTION_CHARS` = 64 000 characters, after trimming; server-only guard against oversized questions, independent of the total context budget |
| 404 | `conversation_not_found` | — | unknown or foreign conversation |
| 409 | `conversation_full` | `turn_count`, `max_turns` | `MAX_TURNS_PER_CONVERSATION` = 20; the app offers a new conversation on the same scope |
| 409 | `turn_in_flight` | — | one turn in flight **per account**, all conversations together |
| 422 | `context_budget_exceeded` | `estimated_tokens`, `max_tokens` | the turn's estimated input — corpus, instructions, full history, question; never the output ceiling — must stay under `CONTEXT_BUDGET_TOKENS` = 272 000 / 1.10 = 247 272, so that even a 10 % under-estimate stays under Luna's 272 000-token price step. Nothing is truncated or summarized: the app offers a new conversation |
| 403 / 413 / 503 | `budget_exhausted`, `not_entitled` / `item_too_large` / `budget_unavailable` | `period_end`; `quantity`, `measured`, `limit` for `item_too_large` | the beta budget (task-549): the turn's first call is admitted in one conditional write before the turn is written; same body and `X-Quota-Error-Code` header as every other budget refusal. Never an amount. Their client wording is TASK-550/551's |
| 409 | `turn_count_changed` | — | another turn was accepted on this conversation in between: re-read it |

**Price.** A turn costs what its provider calls cost, valued by the beta budget (task-549): the first call is admitted with the turn, bounded by the snapshot's estimated input turned back into bytes and the output ceiling; each retry before any text is a try of its own, bounded by the request it sends. The output ceiling is `LLM_MAX_COMPLETION_TOKENS` of `llm_config` (32 000, shared with the artifacts), not a chat parameter.

**Write.** The admission (operation `chat:<turn_id>`) comes first; then one DynamoDB transaction writes the turn (conversation update), the question, the empty answer, the turn's attempt and the account's in-flight marker (`docs/CHAT_DATA_MODEL.md`). A refusal leaves **no turn**; a failed transaction releases the admission. The API then sends `{user_id, conversation_id, turn_id, turn_index, attempt_id}` to the chat queue; a replayed request sends nothing.

**Settlement.** A turn that showed text — `completed`, `interrupted`, or failed after part of its answer — is charged its provider usage (estimated when the stream lost its usage chunk). A turn that ends with nothing shown is not charged: its attempt is released (rule 5 of the task-547 decision), which replaces the minute refund of 2026-10-10. Whatever seals a turn without its worker — a failed send, the seal of a lost turn — releases every attempt it holds (`chat_service.release_turn_budget`).

**Idempotency.** The turn id is derived from `(account, conversation, client_request_id)`. A request repeated with the same `client_request_id` after its first copy was accepted answers `200` with the same turn and `replayed: true` — no second turn, no second admission.

### POST /api/chat/conversations/{conversation_id}/turns/{turn_id}/stop

Asks the live generation to stop. Request: `{ "attempt_id": "at_41c2…" }` — the attempt the app is showing (`active_generation.attempt_id`).

`202` (no body): the stop request is **recorded** on the attempt; the worker observes it, stops reading the provider's stream and seals the partial answer `interrupted` with cause `cancelled`, which the stream and the conversation then show. Closing the stream on the phone does not stop a generation; only this route does.

| Status | `detail.error_code` | When |
| --- | --- | --- |
| 404 | `conversation_not_found` | unknown or foreign conversation |
| 409 | `generation_stale` | `(turn_id, attempt_id)` is no longer the live generation — the turn ended. A stop never lands on another generation |

### DELETE /api/chat/conversations/{conversation_id}

Deletes the conversation and every item under it — messages, attempts, fragments — and releases the account's in-flight marker if one of its turns held it. `204` on success; unknown or foreign id: `404 conversation_not_found`. Conversations have no TTL: they live until deleted here or by account erasure (`docs/DATA_RETENTION.md`).

### Chat stream — GET {chat_stream_url}/chat/conversations/{conversation_id}/stream

**Not on the main API.** A separate door: a regional REST API Gateway in `STREAM` mode in front of a dedicated Lambda (`media_summarizer/api/chat_stream_app.py`, Terraform `chat_stream.tf`). Its base URL is the Terraform output `chat_stream_url` (`https://<id>.execute-api.<region>.amazonaws.com/v1`), which the app reads as a public variable. Same Cognito access token as the main API (`Authorization: Bearer …`, checked by the same `get_current_user`), same ownership rule: a conversation of another account answers 404. It generates nothing and calls no LLM: it replays and follows the fragments the chat worker persists.

Query parameters:

| Name | Required | Meaning |
| --- | --- | --- |
| `turn_id`, `attempt_id` | no | the generation the app is showing (`active_generation` of the conversation, or the send response). Omitted: stream whatever is live |
| `after_seq` | no, default `-1` | the last fragment sequence the app holds; the stream starts after it |

Answers before the stream starts:

| Status | Body | When |
| --- | --- | --- |
| 204 | — | no generation in flight on this conversation, or the one in flight is lost: read the conversation from the main API, which shows the final answer and seals a lost turn |
| 401 | — | missing or invalid JWT |
| 404 | `{"detail": {"error_code": "conversation_not_found"}}` | unknown or foreign conversation |
| 409 | `{"detail": {"error_code": "generation_stale", "turn_id", "turn_index", "attempt_id"}}` | the identity sent is no longer the live one; the body names the live one |
| 429 | — | the stage's throttling (stream openings per second) |

Otherwise `200`, `Content-Type: text/event-stream`. Events, in order:

| `event` | `id` | `data` | Meaning |
| --- | --- | --- | --- |
| `generation` | — | `{turn_id, turn_index, attempt_id}` | the generation this stream follows, always first |
| `fragment` | the sequence | `{seq, text}` | the next piece of the answer. Sequences of one attempt start at 0 and grow by 1; the app drops any `seq` it already holds |
| `end` | — | `{turn_id, attempt_id, status, interruption_cause, error_code, last_seq, text}` | sent only after the turn's final state was **read back persisted**: `status` is `completed`, `interrupted` (with its cause: `cancelled`, `output_limit`, `provider_error`) or `failed`; `text` is the final answer as stored. The stream then closes |
| `reconnect` | — | `{turn_id, attempt_id, after_seq}` | the stream reached its own time limit (14 minutes); the app reconnects with this cursor. Nothing is lost: fragments live a day |

If the generation is lost while the stream is open, the stream closes **without** an `end`: this door is read-only and no terminal state is persisted yet. The app reads the conversation, which seals the turn; reopening the stream answers `204`.

A comment line `: keepalive` is sent every 15 s of silence, below the 5-minute idle timeout of a regional streaming endpoint. A dropped connection is resumed the same way as `reconnect`: same identity, `after_seq` = the last sequence received. Closing the stream never stops the generation; only the stop route does.

**CORS (task-474), for the web app.** The browser sends `Authorization`, so every opening is preflighted. Only the environment's web app origin (Terraform `web_app_origin`: `http://localhost:5173` in dev, `https://app.<domain>` once it exists, empty elsewhere) is allowed, never `*`, and no cookie is involved:

- `OPTIONS` on the stream path is answered by API Gateway itself (mock integration): `200`, `Access-Control-Allow-Origin: <origin>`, `Access-Control-Allow-Headers: authorization`, `Access-Control-Allow-Methods: GET,OPTIONS`, `Access-Control-Max-Age: 3600`.
- The Lambda adds `Access-Control-Allow-Origin: <origin>` (and `Vary: Origin`) to every answer to a request carrying that `Origin` — `200` stream, `204`, `401`, `404`, `409` — and nothing for any other origin (`WEB_APP_ORIGIN`).
- The gateway responses `DEFAULT_4XX` and `DEFAULT_5XX` (throttling `429`, a missing route's `403`, integration errors) carry the same header, so the app reads their status instead of an opaque CORS error.

With `web_app_origin` empty the stream has no CORS at all: no `OPTIONS` method, no header. The mobile app is not a browser and is unaffected.

## File upload entrypoints (non-canonical, same organization contract)

Three ingestion entrypoints work from a file instead of a URL: `POST /api/media/upload`,
`POST /api/media/upload-audio`, and `POST /api/media/ingest-shared-content` with
`share_type=audio`. They are **not** part of the six canonical endpoints above and have their own
compact response shapes, but since task-264 they accept the same organization fields as
`POST /api/media/ingest-url`. There is one dialect for "where does this save go", implemented once in
`_resolve_media_organization` (`media_summarizer/api/endpoints/media.py`) and shared by all four.

**No endpoint of this API ever receives a file.** Requests arrive through API Gateway, which
base64-encodes the body into the Lambda event, so Lambda's 6 MiB synchronous payload ceiling caps any
HTTP body at **4 718 592 raw bytes** — and past that the gateway answers `Request Entity Too Large`
itself, before FastAPI, so the API cannot even shape the error. Since task-345 the client uploads
straight to S3 and the endpoints take JSON carrying the resulting key.

### POST /api/media/upload-url

`application/json`. Issues a presigned S3 PUT. Same pattern as
`POST /api/bug-reports/upload-url`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `target` | string | yes | `document`, `audio` or `shared_audio` — which of the three flows the file is for. Decides the bucket, the accepted formats and the ceiling. |
| `filename` | string | yes | Name including its extension; it is what the format check reads, and it is kept in the key. Any path component is stripped. |
| `content_type` | string | no | MIME type the client will send with the PUT. Required for `shared_audio`, whose check is MIME-based. |
| `file_size` | integer | yes | Bytes. Checked against the ceiling before signing, so a hopeless transfer never starts. Re-checked from S3 at submission — the client's figure is never trusted. |

Response (`200 OK`):
```json
{
  "upload_url": "https://<bucket>.s3.<region>.amazonaws.com/uploads/usr_01JQ.../3f1c.../invoice-2026-03.pdf?X-Amz-Algorithm=...",
  "upload_key": "uploads/usr_01JQ8X8J5S3H3CXX8V70M9M3K7/3f1c9a2e.../invoice-2026-03.pdf",
  "expires_in": 900
}
```

The client then sends the raw bytes with `PUT` to `upload_url`, **without** the `Authorization`
header: the signature is the credential, and the session must not travel to a host that is not this
API. Ceilings are `MAX_UPLOAD_SIZE_BYTES` (50 MB) for `document` and `audio`,
`MAX_SHARED_AUDIO_SIZE_BYTES` (25 MB) for `shared_audio`; both are mirrored in the mobile client
(`packages/core/src/types/upload.ts`, `packages/core/src/types/sharedContent.ts`).

### POST /api/media/upload

`application/json`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `upload_key` | string | yes | Key returned by `upload-url` for `target=document`. Extension must be in `DocumentFormat.supported_extensions()`: `pdf`, `docx`, `pptx`, `xlsx`, `txt`, `text`, `md`, `markdown`, `rtf`, `jpg`, `jpeg`, `png`, `tiff`, `tif`, `bmp`, `heif`, `heic`. Images go through OCR. The text formats are decoded in-process by `PlainTextResolver` — no provider call, no page count, nothing debited (task-380). |
| `folder_id` | string \| null | no | Destination folder. Omitted or null means the user's default Uncategorized folder. |

Response (`UploadDocumentResponse`, `202 Accepted`):
```json
{
  "media_item_id": "med_01JQ8X8J5S3H3CXX8V70M9M3K7",
  "status": "processing",
  "source_platform": "document",
  "file_name": "invoice-2026-03.pdf"
}
```

### POST /api/media/upload-audio

`application/json`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `upload_key` | string | yes | Key returned by `upload-url` for `target=audio`. Extension must be one of `.mp3`, `.m4a`, `.aac`, `.ogg`, `.wav`, `.flac`, `.opus`. Transcribed by Deepgram. |
| `folder_id` | string \| null | no | Same semantics as above. |

Response (`UploadAudioResponse`, `202 Accepted`):
```json
{
  "media_item_id": "med_01JQ8X8J5S3H3CXX8V70M9M3K7",
  "status": "processing",
  "source_platform": "audio"
}
```

### Shared semantics

- `folder_id` is validated against the caller **before** the quota check, so an unusable folder
  costs nothing to the user's allowance. An id that does not exist or belongs to someone else is
  `400 Folder not found` — identical wording and status to `ingest-url`.
- It lands on the durable library row through `save_media_for_user`, never on the processing job —
  organization belongs to what the user saved, not to the pipeline working for it.
- An `upload_key` that does not start with `uploads/{caller_id}/` is `403`, decided on the key alone
  **before any S3 call**, so these endpoints cannot be used to probe another user's objects.
- An `upload_key` with no object behind it is `422` naming the missing upload: the transfer either
  never happened or has expired. The key is single-use — the object is moved to its canonical
  location and the staged copy deleted — so replaying the same submission gets this same `422`.
- Rejections that do not depend on the file's content are stable: unsupported extension or MIME
  `400`, empty object `400`, over the ceiling `413`. Extension and size are checked twice, once at
  `upload-url` (so a refusal costs no transfer) and once at submission against what S3 actually
  holds.
- **The content identity of an uploaded file is a fingerprint of its bytes, inside the account**
  (task-393). The API never sees the body, so the fingerprint comes from S3: the object's ETag when
  it is the MD5 of the body (single-part PUT, SSE-S3 — pinned on both staging buckets), otherwise a
  full-object checksum S3 stored for it. Consequences a client can rely on: the same file submitted
  twice under two different names is one content, and two different files that happen to share a
  name and a byte count are two. The owner is part of the identity, so two accounts uploading
  identical bytes share neither content nor artifacts. When S3 reports no digest that is a function
  of the body alone — a multipart upload, or an object encrypted with a KMS or client-supplied key —
  the submission is refused with `422` and an `X-Upload-Error-Code` header
  (`upload_fingerprint_multipart`, `upload_fingerprint_encrypted`, `upload_fingerprint_missing`)
  rather than being keyed on something that does not identify it.
- A budget refusal carries the `X-Quota-Error-Code` header (`budget_exhausted`, `not_entitled`,
  `item_too_large` or `budget_unavailable`) and the body `{"error_code", ...figures}`, exactly like
  the URL and shared-content entrypoints. For an audio upload the duration is read from the object
  over a presigned GET (a few Range requests) and the import is admitted in the request, so the
  "too long for one import" refusal still happens before anything is queued (task-549).
- The library row stores `media_type` `document` / `audio`, which the list endpoint returns as-is;
  `GET /api/media/{media_item_id}` normalizes them to the canonical `article` / `audio_file`.
- Objects the client uploads and never submits stay under `uploads/` and expire after one day
  through the bucket lifecycle rule (`infrastructure/terraform/modules/platform/s3.tf`).

## Shared text and the page it came from

`POST /api/media/ingest-shared-content` with `share_type=text` turns a text into a note
(`source_platform` `notes`). Since task-486 it also accepts the address of the page the text was
selected on — what the browser extension sends with a right-click selection:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `text` | string | yes | The note, at most `MAX_SHARED_TEXT_LENGTH` characters once trimmed. |
| `source_url` | string \| null | no | Page the text was selected on. **`share_type=text` only.** An absolute `http` or `https` URL with a host, at most 2 048 characters. Omitted, null or blank means no address. |

Refusals, all `400` before anything is written: `source_url` sent with `share_type=audio`, a value
that is not an absolute `http(s)` URL with a host, a value over 2 048 characters.

The address is **never part of the media identity**. A shared text is keyed by a hash of the text
alone, with no account in it (`_share_locator` in `media_summarizer/core/media_ingestion/use_cases.py`):
two accounts that share the same words share one media and its artifacts, whatever page each of
them was on. The address is therefore kept on the caller's **durable library row** (`user_media`
attribute `origin_url`), written once by the create path and copied by nothing else — the job
mirror and the duplicate finalisation refresh `source_url`, the content's locator, on every save of
the same content, and must not carry one reader's page to another.

It is returned by `GET /api/media/{media_item_id}` as `media_item.origin_url`, null for every item
saved without one. `media_item.original_url` keeps being the content's locator (`share://…` for a
note).

## Domain enums (locked)

`MediaItem`:
- `status`: `ingested | resolving | processing | ready_for_artifacts | failed | cancelled`
- `transcript.status`: `pending | extracting | transcribing | ready | failed`
- `review_blurb_status`: `pending | ready | failed` — the source preview shown above the
  full text. `review_blurb` itself is null unless this reads `ready`, and the status is what
  tells a client whether that null is a preview on its way or one that will never come: the
  generation is an internal artifact triggered best-effort at the end of ingestion, so no entry
  at all on a finished item reads as `failed` (repaired by
  `media_summarizer/scripts/backfill_review_blurbs.py`). **`pending` is bounded** (task-391):
  an entry left in flight past `ARTIFACT_INTERNAL_STALL_SECONDS` (30 min) is ended by the read
  itself and answers `failed`, so no item stays "preview being written" for ever. A save of
  content someone already ingested provisions its own preview at save time, from the content's
  existing artifact or from a generation of its own, so a deduplicated save never announces
  `ready` over a row that carries nothing.

`MediaArtifact`:
- `scope`: `media | folder`
- `artifact_type`: `summary_short | notes | quiz | flashcards`
- `status`: `queued | generating | ready | failed`

`ProcessingJob` lifecycle usage:
- `pending | classifying | resolving | downloading | extracting | transcribing | ready_for_artifacts | completed | failed | cancelled`

## Transitional status mapping (legacy -> canonical)

When reading existing `ProcessingJob.status` values during migration:
- `pending` -> `pending`
- `rss_resolving` -> `resolving`
- `downloading` -> `downloading`
- `transcribing` -> `transcribing`
- `summarizing` -> `ready_for_artifacts`
- `notifying` -> `completed`
- `completed` -> `completed`
- `failed` -> `failed`
- `cancelled` -> `cancelled`

## Error contract (stable)

Canonical error response:
```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "The provided URL is invalid.",
    "request_id": "0d4b1c81-a8d1-4ff2-88f9-8af0c1fdf6ba"
  },
  "detail": "Invalid URL"
}
```

Stable error codes:
- `BAD_REQUEST`
- `INVALID_URL`
- `UNSUPPORTED_URL`
- `SESSION_EXPIRED`
- `NOT_AUTHORIZED`
- `NOT_FOUND`
- `MEDIA_NOT_FOUND`
- `ARTIFACT_NOT_FOUND`
- `CONFLICT`
- `VALIDATION_ERROR`
- `RATE_LIMITED`
- `PAYMENT_REQUIRED`
- `QUOTA_EXCEEDED`
- `INSUFFICIENT_MINUTES`
- `INTERNAL_ERROR`

HTTP mapping rules:
- `400`: input/URL errors (`BAD_REQUEST`, `INVALID_URL`, `UNSUPPORTED_URL`)
- `401`: `SESSION_EXPIRED`
- `403`: `NOT_AUTHORIZED`
- `404`: not-found family (`NOT_FOUND`, `MEDIA_NOT_FOUND`, `ARTIFACT_NOT_FOUND`)
- `409`: `CONFLICT`
- `422`: `VALIDATION_ERROR`
- `429`: `RATE_LIMITED`
- `402`: `PAYMENT_REQUIRED`, `INSUFFICIENT_MINUTES`, `QUOTA_EXCEEDED`
- `500`: `INTERNAL_ERROR` (user-safe message only)

## Contract invariants

- `media_key` must be deterministic from canonical URL normalization.
- Processing is idempotent for equivalent normalized URLs; saving is intentionally
  non-idempotent and creates a fresh library row on every successful request.
- Artifact creation writes an entry **only** when `(user, scope, scope_id, artifact_type, parameters, sorted source ids)` has no entry yet (`parameters` being the output language plus the generation options away from their defaults, so a request spelling out every default — the reading language included — is the request without options), or when the entry it has is `failed`. Any other identical request — a double tap or one months later — returns the stored entry, with no new generation and no quota movement. The storage stays an append-only history: a *different* source set writes a new entry next to the older ones, and no request is ever refused for already existing.
- A **provider call** is made only when `(scope, media_key, artifact_type, parameters, sorted source ids)` — the same material without the user — has no live generation yet. So an account can gain an entry (and be debited for it) without any model being called, and one generation of one content is what every account's entry over that content reads. Artifacts over a user-uploaded file are outside this rule: their content identity is account-scoped, so they are never served to another account.
- Timestamps use ISO-8601 UTC strings.
- `request_id` must be returned in error payload and response header.

## Relationship to existing runtime APIs

Current runtime still exposes legacy paths:
- `/api/podcast-search/*`
- `/api/jobs/*`

These legacy paths are not the canonical target contract and must not drive new mobile share-first implementation once canonical endpoints are implemented. As of 2026-08-18 neither has a single caller left in `mobile/` — the constraint has held, and what remains is backend surface nothing consumes. `/api/episodes/my-episodes` was listed here too and no longer exists; its router is not mounted.

The paths named above carry no active mobile callers and exist only to prevent breaking pre-existing API integrations (unlikely given zero shipped clients). Whether they should exist at all is out of scope of this API harmonization; that is a separate product decision.
