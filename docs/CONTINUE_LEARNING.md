# Continue learning by target (TASK-582)

Owner-approved implementation plan, 2026-11-03. This replaces the scope-level
model of task-303/305: one media/folder can now contribute several artifacts and
conversations. It is not an event history or a reading-progress tracker.

## Storage and activity

`user_engagements-<env>` stores one pointer per `(user_id, target_key)`;
`target_key` is `artifact#<id>` or `conversation#<id>`. Records contain kind/id,
current navigation scope/id, `scope_key`, `engaged_at`, `recency_key` (UTC
microsecond timestamp plus target identity), and epoch `expires_at`. No title,
message or generated body is copied. New activity replaces the same pointer,
conditionally on its timestamp being newer. There is no 60-second dampener.

Two LSIs are declared at creation: `recent-index` on `recency_key` (ALL), and
`scope-index` on `scope_key` (KEYS_ONLY). Both support strongly consistent queries.
The read path pages until 12 visible entries (maximum configurable request: 20)
or exhaustion, batch-hydrates owned targets and visible parents, then signs covers.
Only metadata is read; folder mosaics reuse bounded folder overviews. When an
artifact's initial save is gone, all unresolved content ids are resolved together
against this account's visible saves, choosing the newest remaining save.

A transaction checks that the target still belongs to the account and the chosen
parent still exists and is visible, then writes the pointer. This fences a late
open against deletion. Accepted generations/retries, accepted non-replayed chat
turns, and explicit viewer openings count. Reads, automatic chat-history selection
on the desktop page, polls, background completions and empty composers do not.
Failed recording is logged and never fails the main user action.

The query excludes activity at or beyond 90 days. DynamoDB TTL asynchronously
removes expired pointers; it never expires artifacts, conversations or library rows.
Explicit deletions remove the corresponding target/scope pointers. Cleanup failures
are logged, while read-time validation still hides missing targets/parents; TTL is
the final backstop. Account erasure inventories and deletes the entire partition
after removing artifact and conversation targets, preventing late recreation.

## Clients

Both clients use shared display logic and catalogues in `packages/core`.
Vignettes retain the parent cover/mosaic, with an icon/type badge, target title,
parent subtitle and pending/failed status. Their stable identity is kind plus id.
Pending entries are re-read using the clients' existing bounded refresh hooks.
Recently added remains a media row with its original presentation.

Mobile artifact links use the dedicated viewer. Media/folder routes consume a
`conversationId` request: select that exact conversation, show the modal, position
at its last message after layout, and leave the keyboard closed. Normal history
selection still uses the same controller and streaming transport.

Desktop URLs carry `artifactId` or `conversationId`. An artifact is fetched directly
by id, independent of history pagination, and displayed in the expanded AI pane.
A selected conversation is fetched directly and positioned at the end of the thread.
Closing/starting a new conversation removes the corresponding URL selection.
No pixel offsets, quiz answers or flashcard-session progression are persisted.

## Delivery and owner recipe

No compatibility layer, dual write, historical backfill or data migration. The old
scope timestamps cannot identify a target, so the new list fills from subsequent
explicit activity. Existing dev fixture attributes can remain unread. Terraform
adds the new table and runtime variable, and removes only the old `engaged-index`
from the library table; it must not replace any existing table.

LAUNCH PREREQUISITE: after owner merge/push, let the dev Terraform workflow apply
and deliver the backend, mobile update and web bundle together. Until the backend
has the new runtime/table and both clients use the new contract, the recency row
may be unavailable. No deployed API/E2E run is an implementation acceptance gate.

Owner manual recipe after delivery, on mobile and web:

- Open two artifacts of the same type and a conversation on one media: three
  separate vignettes, each opening its exact target. Repeat for a folder.
- Open A, B, A rapidly: two vignettes, A first, with no duplicate.
- Restart/reload, open an older conversation: exact thread, last message visible,
  keyboard closed on mobile. Also exercise a response still streaming.
- Open an artifact absent from the first history page; reload its desktop URL.
- Generate/retry while leaving Home visible: pending becomes ready/failed without
  changing the engagement ordering merely because the worker finished.
- Open just a source/transcript or empty composer; poll/reconnect a stream:
  none of these creates or reorders an activity entry.
- Delete a conversation, failed artifact, media or folder: affected destinations
  vanish; media moved out of a deleted folder keep their own learning entries.
- Delete an original duplicate save while another remains; a later artifact open
  still works through the remaining save, with one entry for that artifact id.
- Check a target removed between list and click: readable failure and Home/back
  navigation. Simulate offline recording: the main read/send remains usable.
- Confirm old activity is excluded at 90 days and account erasure includes the
  new table. Check both themes, translated labels and screen-reader descriptions.
