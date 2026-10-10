# Chat data model

Durable state of the conversational chat, built by task-457 from the owner's
decision in `docs/research/task-430-chatbot-architecture/README.md` (Owner
Validation, points 3, 4, 6 and 7). This is the reference the other chat tasks
cite (API, worker, SSE stream, outbox relay).

| Piece | Location |
|---|---|
| Table | `infrastructure/terraform/modules/platform/dynamodb_chat_tables.tf` — `chat-<env>`, env var `CHAT_TABLE` |
| Models | `media_summarizer/core/models/chat.py` |
| Access layer | `media_summarizer/utils/chat_db.py` — **every** state-changing write goes through it |
| Account erasure | `_USER_PARTITION_TABLES` in `media_summarizer/core/services/account_deletion_service.py` |
| Retention | `docs/DATA_RETENTION.md` §2 |

## 1. Table

`PAY_PER_REQUEST`, PITR, deletion protection, `prevent_destroy`.

- **Partition key `user_id`**: the account. One account is one partition, so
  account erasure sweeps every chat item with one paginated query, and a read by
  key can only ever return the caller's own item.
- **Sort key `sk`**: a prefixed string, see §2.
- **TTL attribute `fragment_expires_at`** (epoch seconds), written **on fragments
  only**. DynamoDB ignores items with no numeric value in that attribute, so
  conversations and messages never expire.
- **LSI `scope-activity-index`**, range key `scope_activity_key` =
  `<scope>#<scope_id>#<last_activity_at ISO-8601 UTC>`. Set on conversation items
  only, so the index is sparse. Projection `INCLUDE` of what a history row draws
  (`SUMMARY_PROJECTED_ATTRIBUTES` in the models, which must match the Terraform
  list). One scope's history is a `begins_with("<scope>#<scope_id>#")` query with
  `ScanIndexForward=False`.

## 2. Items

Every item carries `user_id`, `conversation_id`, `sk` and `kind`. Timestamps are
ISO-8601 UTC strings with the same `+00:00` offset everywhere, so DynamoDB's string
comparison is the chronological one (the lease condition relies on it). Ids are
opaque: `cv_…` (conversation), `tn_…` (turn), `at_…` (attempt).

| `kind` | `sk` | Holds |
|---|---|---|
| `conversation` | `CONV#<cid>` | scope, frozen source snapshot, turn count, the live generation |
| `user_message` | `CONV#<cid>#MSG#<turn:04d>#0` | the question of a turn |
| `assistant_message` | `CONV#<cid>#MSG#<turn:04d>#1` | the answer of a turn **and the turn's state** |
| `attempt` | `CONV#<cid>#ATT#<turn:04d>#<attempt_id>` | one generation run of a turn: lease, stop request |
| `fragment` | `CONV#<cid>#FRAG#<attempt_id>#<seq:08d>` | one flush of streamed text, with TTL |
| `dispatch_intent` | `CONV#<cid>#OUT#<attempt_id>` | what the outbox relay sends to the chat queue |
| `turn_in_flight` | `INFLIGHT` | the account's one turn in flight (task-462), outside every conversation range |

Consequences of the key layout:

- a conversation and everything under it is the range `CONV#<cid>`; its children
  are `CONV#<cid>#…`;
- messages come back in conversation order, each question before its answer
  (`#0` < `#1`); `turn_index` is 1-based;
- fragments are keyed **per attempt**: two attempts of one turn never share a
  range, so a new attempt cannot be read as the continuation of an old one;
- turns are **not** stored inside the conversation item. An `UpdateItem` is billed
  on the full item size (complement C1.8), so a growing conversation item would
  make every write dearer than the last.

### 2.1 Conversation

| Attribute | Notes |
|---|---|
| `scope` | `media` or `folder` — the `ArtifactScope` vocabulary |
| `scope_id` | the library row id (media) or the folder id, as for artifacts |
| `content_scope_id` | the `media_key` (media) or the folder id: what the artifacts key their `prompt_cache_key` on, so a conversation reuses their cached corpus prefix (task-462) |
| `language` | the language answers are written in, the reader's at opening, frozen so instructions and cached prefix do not move between turns |
| `title` | the first question, cut to 120 characters; set by turn 1 with `if_not_exists` |
| `source_snapshot` | `{version, taken_at, sources[]}`, see §2.2 |
| `turn_count` | number of accepted turns |
| `active_turn_id`, `active_turn_index`, `active_attempt_id` | the generation in flight; absent when none. At most one per conversation |
| `last_turn_status` | state of the latest turn, for the history row |
| `created_at`, `updated_at`, `last_activity_at` | `last_activity_at` moves when a turn is accepted and orders the history |
| `scope_activity_key` | the LSI range key (§1) |

### 2.2 Source snapshot

Frozen when the conversation is opened (README §11.1): changing the corpus
mid-conversation would answer on text earlier answers never read and break the
prompt-cache prefix. If the folder's contents change, a **new** conversation reads
the new state. `create_conversation` is the only write that sets it.

- `sources[]` keeps the order it was given: readable sources first, in resolution
  order, then the excluded ones, so the readable sources' refs are exactly the
  `[Sk]` tags `llm_corpus.build_corpus_block` gives them. Each line has
  the `ArtifactSource` fields (`media_item_id`, `title`, `transcript_s3_key` — the
  original transcript the model reads, `language`, `excluded`, `excluded_reason`)
  plus `ref`, the citable tag `[S1]` … `[Sn]`, identical to
  `llm_corpus.source_label` of the artifact prompts, and on a readable line
  `byte_length` (transcript plus description, the measure the corpus ceiling was
  checked on, which the context budget reads), `published` and `captured` (the
  corpus header's dates).
- `version` = `src_v1_<sha256>` over the ordered `(media_item_id,
  transcript_s3_key)` pairs: two conversations with the same version read the same
  text in the same order.
- Built by `ChatSourceSnapshot.freeze(sources)`.

### 2.3 Assistant message (turn state)

Exists from the moment the turn is accepted, with no `text`.

| Attribute | Notes |
|---|---|
| `turn_id`, `turn_index` | the turn's identity and position |
| `status` | `accepted` → `generating` → `completed` \| `failed` \| `interrupted` |
| `interruption_cause` | only with `interrupted`: `cancelled` (stop requested), `output_limit` (`finish_reason == "length"`), `provider_error` (failure after text was streamed — a partial answer is not taken back) |
| `attempt_id` | the attempt allowed to produce the answer; the one that produced it once sealed |
| `attempt_count` | 1, +1 per replacement |
| `text` | the final answer, set by the seal. A 32,000-token answer is ~130 kB, under the 400 kB item limit |
| `error_code`, `error_message` | on `failed` or a `provider_error` interruption |
| `llm_usage` | `ArtifactLlmUsage` (model, tokens, cache, cost; `usage_estimated` when a stream ended without its usage) |
| `quota_period_key`, `quota_minutes_debited`, `quota_cost_eur` | the debit applied for the turn, written after it (task-462); what a refund credits back, on that period. Absent when no debit was applied |
| `created_at`, `started_at`, `completed_at` | |

### 2.4 Attempt

The **generation identity is (turn_id, attempt_id)**. Every conditional write made
on behalf of a generation is fenced on its attempt.

| Attribute | Notes |
|---|---|
| `attempt_number` | 1, 2, … |
| `status` | `queued` → `generating` → `completed` \| `failed` \| `interrupted`; or `queued`/`generating` → `superseded` |
| `lease_expires_at` | the worker's lease while `generating` |
| `cancel_requested_at` | set by the stop route; the worker reads it while streaming |
| `error_code`, `created_at`, `started_at`, `ended_at` | |

An attempt whose lease expired is **never re-claimed in place**: its fragments are
already out and a second run would repeat them. It is replaced by a new attempt
(§3.5).

### 2.5 Fragment

`turn_id`, `turn_index`, `attempt_id`, `seq` (0, 1, 2… per attempt), `text`,
`created_at`, `fragment_expires_at` = write time + 1 day. A transport buffer: the
stream replays the fragments after the client's cursor, then follows new ones; once
sealed, the final text is on the message and the fragments only serve a resume.

### 2.6 Dispatch intent

`turn_id`, `turn_index`, `attempt_id`, `dispatch_status` (`pending` →
`dispatched`), `created_at`, `dispatched_at`. Written in the same transaction as
the attempt it launches. It holds only what any relay needs; how it is sent, and
whatever the relay needs on top (a stream, an index), is task-458/465's choice.

## 3. Writes, transitions and their conditions

All in `utils/chat_db.py`. A write refused because the state moved on returns
`False`/`None` (the caller lost a race and acknowledges); any other error raises.
"Transaction" means one `TransactWriteItems`: all items or none.

### 3.1 `create_conversation`

Put, `attribute_not_exists(sk)`. Writes the snapshot — the only write that does.

### 3.2 `accept_turn` — transaction, 6 items

| Item | Write | Condition |
|---|---|---|
| conversation | `turn_count = n+1`, active turn/attempt, `last_turn_status = accepted`, activity, title if absent | exists, **no active attempt**, `turn_count = expected` |
| user message | put | not exists |
| assistant message | put, `accepted`, `attempt_id` | not exists |
| attempt | put, `queued` | not exists |
| dispatch intent | put, `pending` | not exists |
| in-flight marker `INFLIGHT` | put: conversation, turn, `in_flight_until` = now + 15 min | not exists, **or** `in_flight_until < now` |

Refusal raises `TurnNotAcceptedError` with `conversation_not_found`,
`turn_in_progress`, `account_turn_in_flight` (the marker is held by a live turn of
another conversation) or `turn_count_changed` (read off the conversation's old image,
`ReturnValuesOnConditionCheckFailure`). `idempotency_token` becomes the
`ClientRequestToken`: the same request repeated within ten minutes is not written
twice. Nothing is sent to SQS here (Decision point 4: the outbox does it).

### 3.3 `claim_attempt` — transaction, 3 items

attempt `queued` → `generating` with a lease; answer `accepted|generating` →
`generating` if it still names this attempt; conversation `last_turn_status`, if
its active attempt is this one. `False` = duplicate delivery, replaced or ended
attempt: acknowledge without calling the provider. The worker re-reads the attempt
afterwards, since a stop may have been requested before the claim.

`renew_attempt_lease`: update conditional on `generating`. `False` = stop working.

### 3.4 `append_fragment` — transaction, 2 items

ConditionCheck attempt `status = generating` + put fragment `attribute_not_exists`.
`False` = the attempt was superseded or sealed: a stale worker can no longer add
text. A sequence written twice raises `FragmentAlreadyWrittenError` (a bug, not a
race). The stop request does **not** fence fragments: the worker flushes what it
has, then seals `interrupted`.

Reads: `list_fragments(after_seq=cursor)` (strongly consistent, ascending) and
`get_last_fragment_seq` (the highest persisted sequence, read by the conversation
endpoint before a resume).

### 3.5 `replace_attempt` — transaction, 5 items

| Item | Write | Condition |
|---|---|---|
| old attempt | `superseded` | `queued`, or `generating` with `lease_expires_at < now` |
| assistant message | `attempt_id = new`, `attempt_count + 1`, `accepted` | names the old attempt, not terminal |
| conversation | `active_attempt_id = new` | active attempt is the old one |
| new attempt | put, `queued` | not exists |
| new dispatch intent | put, `pending` | not exists |

From the commit on, every write of the old attempt fails its condition. The new
attempt starts from an empty answer.

### 3.6 `request_cancellation`

Update `cancel_requested_at = if_not_exists(…)` on the attempt, conditional on
`queued|generating`. A stop aimed at an ended or replaced generation is refused
instead of landing on a newer one. Closing the stream does not call it.

### 3.7 `seal_turn` — transaction, 3 items

| Item | Write | Condition |
|---|---|---|
| attempt | terminal status, `ended_at`, lease removed | `queued` or `generating` |
| assistant message | `status`, `text`, cause, error, usage, `completed_at` | names this attempt, `accepted|generating` |
| conversation | `last_turn_status`, active generation removed | active attempt is this one |

`interrupted` requires a cause and only `interrupted` has one (checked before
writing). After the commit, and outside the transaction, the account's in-flight
marker is deleted if it names this turn (`release_turn_in_flight`): a marker
already taken over by a newer turn past its guard must not make the seal fail, and
a release that fails costs at most the 15-minute guard. **The terminal state is committed before anything announces the end**:
the stream's terminal event and any notification come after this call and read
what it wrote (Decision point 3). Sealing from `queued` exists for a turn the relay
gave up on.

### 3.8 `mark_intent_dispatched`

`pending` → `dispatched`. `False` if already dispatched.

### 3.8b `record_turn_debit`

Update of the assistant message, `attribute_exists(sk)`: the period key, minutes
and cost of the turn's debit, written by the send route once the debit is applied.
`chat_service.refund_unanswered_turn` reads them back.

### 3.9 `delete_conversation`

Attempts first (which fences any worker still writing fragments), then the rest of
the range, read after that, then the conversation item last — an interrupted
deletion leaves a conversation the user can still see and delete again. A fragment
that slips between the two reads expires by TTL within a day.
Last, the account's in-flight marker is released if a turn of this conversation
held it.

### 3.10 Account erasure

`("CHAT_TABLE", "sk")` in `_USER_PARTITION_TABLES`: the account partition is
queried and every item deleted, whatever its kind.

## 4. State diagram

```
turn (assistant message)        attempt
accepted ──claim──► generating  queued ──claim──► generating
   │                    │          │                  │
   └────────seal────────┤          ├──replace──► superseded ◄──replace (lease expired)
                        ▼          └──seal──┐         │
          completed | failed | interrupted  ▼         ▼ seal
                                completed | failed | interrupted
```

A replacement sets the turn back to `accepted` under the new attempt.

## 5. Read operations

`get_conversation`, `list_conversations_by_scope` (LSI page + cursor),
`list_messages`, `get_assistant_message`, `get_attempt`, `list_attempts`,
`list_fragments`, `get_last_fragment_seq`, `get_dispatch_intent`. All base-table
reads are strongly consistent.

## 6. Not decided here

- Product limits (question length, 20 turns, context budget): task-462, as
  explicit parameters in `core/services/chat_prompt.py` — the storage model has no
  limit of its own. The one turn in flight per account is the `INFLIGHT` marker
  above.
- How intents are sent and how stuck turns are recovered: task-458 / task-465.
- Routes, queue, worker, stream: task-461 to task-464.
