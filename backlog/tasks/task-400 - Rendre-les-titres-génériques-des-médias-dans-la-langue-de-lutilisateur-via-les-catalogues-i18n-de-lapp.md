---
id: TASK-400
title: >-
  Rendre les titres génériques des médias dans la langue de l'utilisateur via
  les catalogues i18n de l'app
status: To Do
assignee: []
created_date: '2026-09-16 12:45'
labels:
  - backend
  - mobile
  - i18n
  - ingestion
dependencies: []
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Origine : feedback beta TestFlight (build 9, 2026-09-10) — un utilisateur fr-FR voit « Article — 10 Sep 2026 ». Décision de l'owner le 2026-09-16 : le titre générique n'est plus une chaîne stockée, c'est l'app qui le rend depuis ses catalogues.

## Constat
`core/media_ingestion/title_derivation.py` : quand aucun vrai titre ne survit, `fallback_title` stocke `f"{label} — {date:%d %b %Y}"` avec des libellés anglais codés en dur (`_MEDIA_TYPE_LABELS`, `_PLATFORM_LABELS`, `_file_label` : `Photo`, `Document`, `Article`, `Podcast episode`, `Shared note`, `Audio note`, `Voice note`, `Instagram video`, `TikTok video`, `Saved item`…) et une date en locale C. Aucune langue n'est transmise. Ce titre n'est pas propre aux échecs : un worker ne le remplace que s'il trouve un vrai titre (`select_title`). Sur dev le 2026-09-16, 21 médias portaient un titre générique, dont 14 traités avec succès (12 photos importées).

## Comportement cible
- Le backend ne fabrique plus de chaîne de titre générique : il enregistre et expose de quoi la rendre (le libellé comme **clé** stable — type, et plateforme quand elle précise le libellé — et la date d'enregistrement), dans les contrats de liste et de détail que lit le mobile.
- Le mobile rend « <libellé> — <date> » via i18n, dans la langue courante de l'utilisateur, avec une date formatée selon la locale, partout où il affiche `item.title`.
- Une clé par libellé dans les 11 catalogues.
- Le dictionnaire de libellés anglais et la construction de chaîne côté backend sont **supprimés**, pas conservés en repli (rien n'est déployé). Les médias dev existants au titre générique n'ont pas à être migrés : il suffit qu'ils soient ré-enregistrables ; l'implémenteur documente s'il faut purger ou non.

## Points que l'implémenteur tranche et documente
- **Algolia** : `title` est l'attribut recherchable le mieux classé et ne peut pas être vide (docstring de `fallback_title`). Définir ce qui est indexé pour un titre générique.
- **Consommateurs serveur du titre** : `push_notification_worker.py` et `digest/scheduler.py` lisent le titre ; ils doivent produire un texte correct pour un média au titre générique, dans la langue de l'utilisateur.
- Tout autre lecteur de `title` (artefacts, export, recherche) trouvé en chemin.

## Note owner (hors AC)
Partie mobile en TypeScript seul → OTA attendue. Vérification visuelle après déploiement : une photo importée en fr-FR s'affiche « Photo — 16 sept. 2026 » et suit un changement de langue.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 title_derivation.py ne contient plus de libellés anglais ni de formatage de date pour le titre générique ; un média sans vrai titre est enregistré avec une clé de libellé et une date, sans chaîne générique construite côté backend
- [x] #2 Les contrats de liste et de détail lus par le mobile exposent la clé de libellé et la date d'un titre générique
- [x] #3 Le mobile rend le titre générique via i18n avec une date formatée selon la locale à chaque endroit qui affiche le titre d'un média ; les 11 catalogues contiennent chaque clé
- [x] #4 Le traitement d'Algolia, des notifications push et des digests pour un titre générique est implémenté et décrit dans les notes d'implémentation
- [x] #5 ruff et mypy passent sur les fichiers backend modifiés ; npm run typecheck et npm run lint passent dans mobile/
<!-- AC:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
### What the row now stores

`core/media_ingestion/title_derivation.py` no longer builds any string for a media
nothing named. Deleted: `_MEDIA_TYPE_LABELS`, `_PLATFORM_LABELS`, `_DEFAULT_LABEL`,
`media_type_label`, `label_for_file_name`, `fallback_title`, `derive_media_title`
and the `datetime` import. In their place, the same decision tree returns a *key*:
`_MEDIA_TYPE_LABEL_KEYS`, `_PLATFORM_LABEL_KEYS`, `_DEFAULT_LABEL_KEY =
"saved_item"`, plus `title_label_key_for()` and `title_label_key_for_file_name()`.
The 15 wire values are exported as `TITLE_LABEL_KEYS` so both sides can be checked
against each other: `youtube_video`, `podcast_episode`, `article`, `video`,
`image_post`, `instagram_video`, `tiktok_video`, `instagram_post`, `x_post`,
`audio_note`, `voice_note`, `shared_note`, `document`, `photo`, `saved_item`.

The single entry point for a save is `derive_stored_title(...) -> DerivedTitle`
(`NamedTuple(title, label_key)`): a real title, or the label key — never both, never
neither. Two call sites decide: `core/media_ingestion/adapters/orchestrators.py`
(URL/share ingestion) and the two upload handlers of `api/endpoints/media.py`.

Why a stored key rather than a key the app derives itself from `media_type` +
`source_platform`: the upload path files **every** import as `media_type="document"`,
yet an image among them has to read "Photo" — the 12 imported dev photos. Only the
handler that sees the filename knows that, hence `title_label_key_for_file_name`
(image extension → `photo`, else `document`) and the `label_key=` override on
`derive_stored_title`.

**Precedence:** `title` wins whenever it is set; `title_label_key` is read only when
`title` is null. This is what makes the change need no cleanup write anywhere —
`update_attributes` on `user_media` is attribute-level and cannot REMOVE, so a worker
that later learns the real title just writes `title` and the stale key simply stops
being read.

Producers that are *not* the save (`workers/podcastindex_resolution_worker.py`,
`workers/rss_feed_poll_worker.py`, `workers/x_ingestion_worker.py`,
`infrastructure/resolvers/instagram_apify_resolver.py`) moved from
`derive_media_title` to `select_title`: a producer that learns nothing returns
`None` and leaves the row alone instead of stamping a placeholder over it.

**No new date field.** The date half of a generic title is the row's `saved_at`,
already exposed as `created_at` by the list, detail and search contracts. Only the
recent-engagement contract was missing it, so `saved_at` joined the `engaged-index`
`non_key_attributes` alongside `title_label_key`
(`infrastructure/terraform/modules/platform/dynamodb_user_media.tf`) rather than
paying a per-tile row read.

### Contracts carrying the pair (AC #2)

`MediaItemContract` (detail + list), `MediaSearchItem` (search-in-library),
`SearchHit` (Algolia), `RecentEngagementResponse` (+ `created_at`, documented as the
media's *save* date, not the engagement's). `docs/CANONICAL_MEDIA_API_CONTRACT.md`
documents the field, the precedence rule and the client-side rendering.

### Mobile rendering (AC #3)

`mobile/src/lib/mediaTitle.ts` — `resolveMediaTitle({ title, title_label_key,
created_at })`: stored title if any, else `t("mediaTitle.generic", { label, date })`
with `formatDate(savedAt, { day: "numeric", month: "short", year: "numeric" })`, so
the date follows the active locale (`toLocaleDateString`) exactly like the rest of
the app. A key the build does not know renders as "Saved item" rather than raw or
"Untitled" — that is handling a newer server's enum value, not a compatibility layer.
No date at all (or an unparseable one) degrades to the bare label.

Every place that shows a media title goes through it: `MediaListCard`, `HomeTile`
(Home rows), `CompletedDetailView`, `media/unsorted-review` (card + its three action
a11y labels), `media/folders/[id]` (source rows), and `useMediaActions.open()` for the
title carried into the player/reader route.

**Locale reactivity** is why the resolution happens in render bodies (or at press
time) and never inside a payload-keyed `useMemo`. `HomeTileItem` therefore carries the
raw triple (`title`, `titleLabelKey`, `savedAt`) and `HomeTile` resolves it itself:
the first design had `inbox.tsx` pre-resolve the title, which forced `locale` into two
`useMemo` dependency arrays that `react-hooks/exhaustive-deps` correctly called
unnecessary.

17 keys added to each of the 11 catalogues: `mediaTitle.generic` (`"{label} — {date}"`,
and `"{label}（{date}）"` in `ja`/`zh` where the em dash is not the idiomatic joiner),
the 15 `mediaTitle.label.*`, and `folder.sourceOpenA11y` (the folder source row's a11y
label was a hardcoded English `Open ${title}`). `Catalog = Record<TranslationKey,
string> & …` makes a missing key a `tsc` error, so completeness is machine-checked.

### AC #4 — Algolia, push, digests, and everything else that reads a title

**Algolia: an untitled media is indexed with an empty `title`, no code change.**
`core/services/search_indexing.py:159` already writes `"title": title or ""` per
transcript chunk. The deleted docstring claimed the field "cannot be empty"; the index
config does not require it — `searchableAttributes: ["title", "creator_name",
"transcript"]` means an empty title costs the ranking of one attribute, and the item
stays findable by its transcript and its creator, which is what a photo or a voice note
is actually searched by. The alternative — indexing an English "Photo — 16 Sep 2026" —
would make the record findable only by a word the user never sees, in a language they
may not read. A rename makes the user's own words searchable through the existing
`update_media_title()` patch. Hit *display* is unaffected: `load_display_details()`
reads the library row and now carries `title_label_key`, so the app renders the hit's
name the same way as everywhere else.

**Push notifications and digests: the premise is a false positive, nothing to do.**
- `workers/push_notification_worker.py` has three `title` references (lines 159, 161,
  195) and all three are the *notification headline* taken from the queue message. It
  never reads a media row.
- `workers/digest/scheduler.py:157-172` hardcodes "Your daily digest is ready" /
  "Your weekly digest is ready" with a count-only body, and says so in its own comment:
  "nothing about *what* the user saved travels: no title, no source, no excerpt".

So no generic title can leak into a notification today. (Both texts are English and
server-built, which is a separate localisation gap — out of scope here, and it would be
a different fix: a push body cannot be rendered client-side from the app's catalogues
the way a screen can.)

**Other title readers found along the way, all fine as-is:**
- `core/services/artifact_service.py:1216` builds `pending_titles=[...]`, which never
  reaches the wire (only `pending_count` does) and is read by nothing in `mobile/`.
- `workers/artifact_generator/generators/corpus.py:82-84` writes a `title:` line into
  the corpus header only when there is one, and the `captured:` line already carries the
  date — the model sees strictly less noise than it did with a fabricated title.
- `workers/artifact_generator/worker.py:100,368` pass `source.get("title")` through; the
  artifact's own title comes from the model. `ArtifactSource.title` exists in
  `mobile/src/types/artifacts.ts` but is never rendered (the app only reads
  `media_item_id`).

### Dev data — no purge

The 21 dev rows carrying a generic title need nothing. Their `title` holds the old
English string, so by the precedence rule the app keeps displaying it verbatim — stale,
not broken, and only on dev. `title_label_key` is null on them and never consulted.
Re-saving the same content produces a correctly keyed row, which is the requirement.
A purge would be free to run but would also delete the transcripts and artifacts behind
those rows, so it is not worth it; the owner can wipe individual items from the app if a
"Article — 10 Sep 2026" bothers them during a demo.

### Owner notes

- **`engaged-index` projection change**: adding `title_label_key` and `saved_at` to
  `non_key_attributes` makes Terraform recreate the GSI online. Existing items are
  backfilled into the index by DynamoDB; the "Continue learning" row shows no label
  before the backfill completes on the affected items. No `terraform plan` was possible
  from the worktree (no AWS credentials); `terraform validate` is clean.
- **OTA**: the mobile half is TypeScript only. The visual check after deploy is an
  fr-FR device importing a photo and reading "Photo — 16 sept. 2026", then switching the
  app language and seeing the title follow.

### Verification

`ruff check media_summarizer/` → all checks passed. `mypy` on the 18 modified Python
modules → no issues. `terraform validate` → success. `cd mobile && npm run typecheck` →
clean; `npm run lint` → clean apart from one pre-existing warning in the untouched
`src/services/purchaseService.ts:136`.

No automated tests were added (project rule).
<!-- SECTION:NOTES:END -->
