# Beta budget control

The shared control that keeps each beta tester inside a budget of provider usage,
built by task-548 from the owner's decision in
`docs/research/task-547-beta-budget-control/README.md` (Owner Validation, validated
2026-10-27, and its section « Décision de l'owner : règles d'implémentation », which
overrides sections 1 to 7 of that README), on top of R.1–R.2 of
`docs/research/pricing-challenge/README.md`. Rule numbers below (« rule 5 ») are the
numbered rules of that decision section.

This document is the reference the following tasks cite: TASK-549 (route every
provider call through the control), TASK-550 (expose its state and refusals),
TASK-551 (show it on mobile and web), TASK-552 (report and alert on it), TASK-559
(refresh the exchange rate).

| Piece | Location |
|---|---|
| Formula, rate, barème | `beta_access`, `eur_usd_rate`, `provider_tariffs` in `DEFAULT_PRICING_CONFIG` (`media_summarizer/core/services/pricing_config_service.py`), overridable in `pricing_config-<env>` |
| Rules (bounds, valuation, transitions) | `media_summarizer/core/services/beta_budget.py` |
| Models | `media_summarizer/core/models/beta_budget.py` |
| Access layer | `media_summarizer/utils/beta_budget_db.py`: **every** write to the ledger goes through it |
| Table | `infrastructure/terraform/modules/platform/dynamodb_beta_budget.tf`: `beta_budget-<env>`, env var `BETA_BUDGET_TABLE` |
| Attribution of the beta | `get_entitlement_snapshot` in `media_summarizer/core/services/quota_enforcer.py` |
| Account erasure | `_USER_PARTITION_TABLES` in `media_summarizer/core/services/account_deletion_service.py` |
| Retention | `docs/DATA_RETENTION.md` §2 |

## 1. The beta formula

The beta is a formula of its own, **independent of the commercial catalogue**. While
`beta_access` is open, every account is on it: `get_entitlement_snapshot` builds
the snapshot from `beta_access` alone and reads no tier of `tiers`, no subscription
row and no free-trial window. A beta snapshot has `is_beta_access: true`,
`subscription_status: "beta"`, no tier, **no minute allowance** (`minutes_included`
is 0), the formula's per-item audio limit as `max_minutes_per_item`, and the
calendar month UTC as its period. `evaluate_submission` never refuses a beta
account on minutes; its per-item limit still applies.

| Key of `beta_access` | Default | Meaning |
|---|---|---|
| `enabled`, `ends_at` | `true`, `null` | Unchanged since task-429: open while enabled and before `ends_at`. An unreadable date leaves the beta open and logs `quota.beta_access_ends_at_unreadable`. |
| `monthly_budget_eur` | `"5"` | Budget of provider usage per account and per month, outside fixed infrastructure. Not to be recalibrated here. |
| `period` | `"calendar_month_utc"` | The only period implemented. Another value is logged (`beta_budget.config_unsupported`) and ignored. |
| `carry_over` | `false` | No carry-over: each month's counter starts from the full budget. Same handling as `period`. |
| `item_limits` | 240 audio minutes, 100 document pages, 30 spreadsheet sheets | Above them, one item is refused as `item_too_large` (rule 2). |
| `translation_output_ratio` | `"1.5"` | `max_completion_tokens` of a full-text translation, as a multiple of its input tokens (rule 11). |
| `estimated_text_tokens_per_audio_minute`, `estimated_text_tokens_per_document_page` | 200, 700 | Upstream estimate of the text an import produces, to reserve its blurb and translation with it (rule 10). |
| `hold_expiry_minutes` | 360 | Backstop after which an attempt still open is released (§3.5). |

A block stored with only `enabled` and `ends_at` (the shape `pricing_config-dev`
holds since 2026-10-05) gets every other key from the defaults, leaf by leaf
(`_merge_defaults`).

`eur_usd_rate` holds `usd_per_eur` (seeded `"1.1188"`, ECB, 26 October 2026) and
`published_on`. The Lambda `media-summarizer-worker-ecb-rate-<env>` refreshes it
every working day at 15:30 UTC from the ECB daily file (task-559,
`workers/ecb_rate_refresh.py`, `lambda_ecb_rate.tf`): the row is updated only when
the publication date moves forward (a top-level `published_on` attribute carries the
condition), so a rerun, a weekend or a holiday changes nothing, and a failed read
writes nothing and logs `fx.ecb_refresh_failed` — the last rate stays in place. Its
role may update that single row and nothing else. A rate edited by hand must update
the top-level `published_on` as well, or the next refresh compares against the old
date. An unusable stored value falls back to the seed and logs
`beta_budget.fx_rate_unreadable`. The rate is never a reason to refuse a call (rule 15).

`provider_tariffs` is the versioned barème in USD, at normal prices: promotional
credits and free volumes are ignored, so a call paid by a sign-up credit consumes
the same budget as after it runs out. Bump `version` with any price change. A price
the barème does not list falls back to the dearest price of the same family and
logs `beta_budget.tariff_missing`. An Apify actor configured with an id other than
the defaults of `apify_adapter.py` must get its own price there first.

## 2. Table and items

`PAY_PER_REQUEST`, PITR, deletion protection, `prevent_destroy`. Partition key
`user_id`, sort key `sk`. Every amount is an **integer number of nano-euros**
(1 EUR = 10^9). Every instant is ISO 8601 UTC with microseconds always written, so
the text order of two instants is their time order.

### 2.1 Month counter, `period#<YYYY-MM>`

| Attribute | Meaning |
|---|---|
| `budget_nano_eur` | The month's budget, fixed when the counter is created. A budget change applies from the next month. |
| `available_nano_eur` | `budget − held − consumed`, kept as its own attribute because a DynamoDB condition cannot add two attributes. Negative after an overrun (rule 8). |
| `held_nano_eur` | Sum of the reservations still open. Not consumption. |
| `consumed_nano_eur` | Settled cost of what reached the tester. **The only figure the displayed percentage is built from** (rule 13). |
| `released_nano_eur` | Cumulative capacity handed back to the tester by releases. An audit figure; it never lowers anything else. |
| `operator_spend_nano_eur` | Provider cost of attempts that delivered nothing (rule 5): measured, or the reserved bound when no metric came back. Never subtracted from anything. |
| `period_key`, `created_at`, `updated_at`, `item_type = "period"`, `ttl_epoch` | `ttl_epoch` = start of the next month + 400 days. |

The month's financial spend is `consumed + operator_spend`. `consumed_pct` is
`consumed / budget × 100`, unrounded, above 100 after an overrun.

### 2.2 Attempt, `attempt#<operation_id>:<step>:<try>`

One per paid provider call. `operation_id` is the logical operation (a job, an
artifact generation, a chat turn), never a queue message. The step is the
component — `collection` (Apify run, X API read), `transcription`,
`document_parsing`, `review_blurb`, `translation`, `generation`, `chat_turn`,
`reuse` — qualified by a `part` when one step makes several calls in one operation
(`document_parsing.image-2` for the images of a carousel parsed one by one). `try`
starts at 1; `beta_budget.next_try_number` reads the next one from the ledger.

| Attribute | Meaning |
|---|---|
| `status` | `held`, `sending`, `settled` or `released` (§3.7). |
| `kind`, `provider`, `model` | What was priced: `transcription`/`deepgram`/`nova-3`, `document_parsing`/`llamaparse`/`page`, `llm`/`openai`/`gpt-6-luna`, `apify`/`apify`/actor id, `x_api`/`x_api`/`post`. |
| `quantities`, `measured` | The bounded quantities, and False when they are the per-item ceiling (failed measurement) or an upstream estimate. |
| `bound_usd`, `reserved_nano_eur` | Exact bound in USD, and its conversion rounded up. |
| `tariff_version`, `usd_per_eur`, `fx_published_on` | Barème and rate of the reservation. The settlement converts at this same rate. |
| `period_key` | The month the attempt was reserved in. Settlement and release always move **this** month's counter. |
| `created_at`, `open_since` | `open_since` exists only while the attempt is open: it is the key of the sparse index. |
| `claimed_at` | When a worker took the right to send. |
| `closed_at`, `ttl_epoch` | Set by the close. `ttl_epoch` = close + 400 days. An open attempt never has a TTL. |
| `consumed_nano_eur`, `cost_usd`, `usage`, `metric_source`, `settled_tariff_version` | Settled attempts: real cost and the provider metrics it comes from. |
| `release_reason`, `operator_cost_nano_eur`, `cost_basis`, `operator_cost_usd` | Released attempts: why, and what the operator spent (`measured`, `bound` or `not_sent`). |
| `source_operation_id` | `reuse` attempts: the operation whose settled value was charged. |

### 2.3 Index

`open-attempts-index` (GSI, `user_id` + `open_since`, projection ALL) is sparse:
only `held` and `sending` attempts are in it, and every close removes
`open_since`. It is eventually consistent, which is harmless because every close
is conditional on the attempt still being open.

## 3. Writes, transitions and their conditions

### 3.1 `reserve`: admission, one transaction of 1 + N items

Rule 4. For an operation and its N lines (for an import: its acquisition step,
its blurb and its translation, rule 10). An Instagram reel or carousel makes two
admissions of one operation, because the audio length and the image count are only
known after the Apify run: `collection` first, then `transcription` or
`document_parsing` with the blurb and the translation. If the second is refused,
the import fails with a budget refusal and the collection's cost stays the
operator's (§3.4).

1. the configuration is read; a closed formula refuses `not_entitled`;
2. each line's bound is converted at the current rate and rounded up; a total above
   the whole monthly budget refuses `budget_exhausted` without writing;
3. the backstop (§3.5) runs for the account; its failure is logged, never fatal;
4. **one `TransactWriteItems`**: the month counter is created with the full budget if
   absent (`if_not_exists`), then `available −= total`, `held += total`, under
   `attribute_not_exists(available) OR available >= :total`; each attempt is `Put`
   `held` under `attribute_not_exists(sk)`.

Outcomes: admitted with the N attempts; `budget_exhausted` (counter condition false,
with `period_end` and `required_nano_eur`); `replayed` (every attempt already
existed, so nothing more is held and the originals come back);
`budget_unavailable` (only some attempts existed, or the ledger failed: rule 7,
never fail-open). Either every line is admitted or none is.

A line builder raises `ItemTooLargeError` before any write when a measured
quantity is above its limit; `refusal_for_item_limit` turns it into the
`item_too_large` admission.

### 3.2 `claim_send`: `held` → `sending`

Persisted before the HTTP call, conditional on `status = held`. False means another
delivery holds the attempt or it is closed: the caller sends nothing under this
reservation. A ledger failure raises, and the request is not sent either.

### 3.3 `settle`: a result reached the user

Read the attempt, then one transaction: the attempt becomes `settled` under
`status IN (held, sending)`, and its month's counter gets `held −= R`,
`consumed += C`, `available += R − C`, where R is the reservation and C the real
cost converted at the reservation's rate. C above R is applied as it is, even past
the budget (rule 8), and logs `beta_budget.overrun`. Outcomes: `applied`,
`already_closed` (settled before: nothing moves), `conflict` (already released:
nothing moves, logs `beta_budget.settle_after_release` with the real cost),
`missing`.

### 3.4 `release`: no result reached the user

Rule 5: failure, timeout, cut stream, unreadable or unpersisted result, or a
component that turned out unnecessary. Read the attempt, decide the operator cost,
then one transaction conditional on the **exact status that was read** (so an
attempt claimed in between is never released as `not_sent`): the attempt becomes
`released` with its reason, and its month's counter gets `held −= R`,
`available += R`, `released += R`, `operator_spend += O`.

| Situation | O | `cost_basis` |
|---|---|---|
| The caller passes the provider's cost of the failed call | that cost | `measured` |
| The attempt was `sending`, no metric came back | R, the reserved bound | `bound` |
| The attempt was still `held` | 0 | `not_sent` |

Reasons: `failed`, `not_needed` (a translation into the language the content is
already in), `lost_in_flight`, `expired`. `lost_in_flight` only applies to a
`sending` attempt whose `claimed_at` is at least the given lease old: a redelivered
message whose previous delivery died mid-call releases it, then reserves a new try;
a concurrent duplicate inside the lease gets `still_in_lease` and does nothing.

### 3.5 `release_expired`: the backstop

Reads the account's open attempts with `open_since` older than
`hold_expiry_minutes` on the sparse index and releases each as `expired` (cost
basis as in §3.4). It runs before every admission of the account, so a stale hold
never refuses the tester. The default of 6 hours is above the longest legitimate
chain of an import (three deliveries of a one-hour visibility timeout on the
transcription or parsing queue, then the blurb and the translation held with it).
It is only for attempts no worker will close (a message lost to a dead-letter
queue). A known failure is released at once by the worker that saw it.

### 3.6 `charge_reuse`: a content another account already paid for

Rule 12. One `TransactWriteItems` like §3.1 with nothing held: `available −= V`,
`consumed += V` under `available >= V`, and one attempt (`component = reuse`)
written directly `settled` with `consumed_nano_eur = V` and `source_operation_id`.
V is the settled value stored with the content when it was first processed. Refused
`budget_exhausted` exactly like a new processing. The same account filing again a
media it already holds is not charged (task-281); that check is the caller's.

### 3.7 States

```
          reserve                 claim_send
  (none) ─────────► held ───────────────────► sending
                     │ │                        │ │
          settle     │ │ release        settle  │ │ release
     ┌───────────────┘ │ (not_sent)  ┌──────────┘ │ (measured | bound)
     ▼                 ▼             ▼            ▼
  settled           released      settled      released

  charge_reuse: (none) ─► settled
```

`settled` and `released` are terminal. No transition leaves them.

## 4. Rules the transitions enforce

### 4.1 Concurrency

Two admissions of one account at the same instant update the same counter item.
DynamoDB serialises them and each condition is evaluated atomically, so their sum
can never exceed the available amount. A transaction cancelled by a concurrent one
(`TransactionConflict`) is retried up to three times, then treated as unavailable.
Sending is fenced by `claim_send`; closing by the open-status condition.

### 4.2 Duplicates and retries

A redelivered message or a retried request is the **same attempt**: `reserve` with
the same operation and try returns the original attempts and holds nothing more,
`settle` and `release` on a closed attempt move nothing. A **new try** is a new
attempt with its own reservation (rule 6), whether it is a retry of the same
provider or the Unstructured fallback after LlamaParse. How many tries a component
gets stays bounded by the existing retry configuration of each worker; the ledger
records them, it does not add a second limit.

### 4.3 Month rollover

The admission month is the month of `reserve`, in UTC. A result arriving after
midnight settles in the month it was reserved in, and a release hands the hold back
to that month: the new month starts from its own full budget, with nothing carried
over in either direction. A try made in the new month reserves in the new month. A
result already available stays readable before and after the rollover.

### 4.4 Capacity handed back is not spend erased

AC #3 of task-548 and rule 5. A release gives the tester's capacity back
(`available`, recorded in `released`) and **adds** the attempt's provider cost to
`operator_spend`. Nothing in the control lowers `consumed` or `operator_spend`: no
release, no settlement and no other write subtracts from them, and there is no
manual capacity grant during the beta (rule 14). A missing metric never becomes a
zero cost: a call that may have left is recorded at its bound (`cost_basis = bound`).
The month's financial spend (`consumed + operator_spend`) therefore only grows.

### 4.5 A failing ledger refuses

Rule 7. Any read or write of the ledger that fails for a reason other than a
condition refuses the admission with `budget_unavailable`; no path admits on an
unknown state. Reading and organising existing content never touches the ledger
and stays available.

### 4.6 Valuation and rounding

Exact decimals from the barème and the rate, no binary float. One rounding per
amount: up to the next nano-euro. Nothing is rounded to a minute, a page or a cent.
Deepgram is priced to the second. An LLM bound prices every input token at the
dearer of the fresh and the cache-write rate and assumes no cache read; a settled
LLM cost partitions the input into fresh, cache-read and cache-written tokens and
never counts reasoning tokens twice. Above 272 000 input tokens the long-context
rates of Luna apply to the whole request.

### 4.7 Bounds by type

Builders in `beta_budget.py`. When a measurement is missing, the per-item ceiling is
reserved, never a provisional minimum (rule 3).

| Builder | Quantity | Limit | Missing measurement |
|---|---|---|---|
| `transcription_line` | seconds from `audio_duration_probe` | 240 min | 240 min reserved |
| `document_line(unit="page")` | pages (PDF, images = 1, TIFF frames, PPTX slides, DOCX always unknown) | 100 pages | 100 pages reserved |
| `document_line(unit="sheet")` | XLSX sheets | 30 sheets | 30 sheets reserved |
| `llm_line` | complete request tokens, output = `max_completion_tokens` sent | `max_input_tokens` given by the caller | `max_input_tokens` reserved |
| `translation_line` | input tokens; output = `translation_max_completion_tokens` (1.5 ×) | output ≤ 1.5 × input | estimated with `estimated_text_tokens` at import |
| `apify_line` | one result of the actor | one result per run | n/a (fixed price) |
| `x_post_line` | one post | one post | n/a (fixed price) |

Matching costs for settlement: `transcription_cost`, `document_cost`, `llm_cost`,
`apify_cost`, `x_cost`.

## 5. Lifecycle

- **TTL** only on items whose life is over: a month counter 400 days after its month
  ends, a closed attempt 400 days after its close. Thirteen months keep a year of
  months comparable, far beyond the 14-day retention of any queue or dead-letter
  queue that could replay an operation. An open attempt never expires by TTL: it is
  closed by its worker or by the backstop.
- **Account erasure**: the whole partition goes with the account
  (`account_deletion_service`). An attempt still open is erased with it; a worker
  settling it later gets `missing` and writes nothing, because every close is
  conditional on the attempt existing.
- **E2E accounts**: `scripts/purge_e2e_accounts.py` sweeps the table on dev.
- **Backups**: PITR on the table. It is not in the AWS Backup library plan, which
  covers the user's library, not operational ledgers.

## 6. Delivered by task-548, and what remains

Delivered: the formula and its configuration, the exchange-rate key, the versioned
barème, the ledger table, the reservation, sending, settlement and release
transitions with their recovery rules, the reuse charge, the attribution of the beta
independent of the catalogue, and the data lifecycle above. The daily burst guards
(`burst_guards`, `user_usage_daily`) are deleted (rule 16): the budget replaces them.

Not delivered here:

| What | Where |
|---|---|
| Routing every paid path through `reserve` / `claim_send` / `settle` / `release` (transcription, collections, parsing, blurbs, translations, generations, chat, retries, fallbacks), sending `max_completion_tokens` on the translation, removing the minute debits, the fail-open of `check_submission_allowed` and the chat refund in minutes, storing the settled value with the content for rule 12 | TASK-549 |
| The authenticated contract: percentage consumed (from `consumed` only), availability, renewal date, typed refusals (`budget_exhausted`, `item_too_large`, `budget_unavailable`), and the removal of the minute fields | TASK-550 |
| What mobile and web show | TASK-551 |
| Reports and alerts on overruns, operator spend, expired holds, refusals | TASK-552 |
| Daily refresh of `eur_usd_rate` from the ECB file | TASK-559 |
| Translation on Luna | TASK-556 |
| Shared free-tier pools (`provider_pools`), outside this control | TASK-557 |

Until TASK-549 is merged, no path calls `reserve`: beta accounts are bounded by the
per-item limits only, and their minute debits keep writing `user_usage_monthly`
without refusing anything. Until TASK-550, the entitlements endpoint returns 0
minutes for a beta account.

**Owner checks after merge and push** (not acceptance criteria of task-548):
`terraform apply` on dev creates `beta_budget-dev` and stops managing
`user_usage_daily-dev`. Check with `aws dynamodb describe-table` and
`describe-time-to-live` (profile `second-brain-app`, region `eu-west-3`) that the
table, its index, PITR and TTL are in place. Then delete `user_usage_daily-dev` by
hand: turn off its deletion protection first. Do the same on prod at its next
apply. Nothing has to be written to `pricing_config-dev`: on 2026-10-28 its
`beta_access` row held only `enabled` and `ends_at`, and it held no `burst_guards`
row. `pricing_config-prod` was not read from the worktree: if it holds a
`burst_guards` row, delete it there (a key dropped from the defaults survives in
the table).
