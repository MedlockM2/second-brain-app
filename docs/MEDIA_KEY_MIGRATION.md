# Canonical media identity

URL-derived `media_key` identifies content; `media_item_id` identifies a saved
library row owned by a user. They are different identities.

## Canonical tables

- `media_idempotence` (PK: `media_key`) stores the content transcript and its
  terminal processing outcome.
- `user_media` (PK: `user_id`, SK: `media_item_id`) is the durable source of
  library ownership and organization. Every successful save creates a fresh row.

## Runtime behavior

New saves enter through the canonical media ingestion API. A completed content
transcript can be reused with the beta budget value attached to it. An import
whose content is still being processed proceeds independently under its own
processing job and budget; it does not wait on another account's job.

Queue/event payloads carry `media_key` and `canonical_job_id`. Completion events
close the content ledger and settle the submitting import's budget. The consumer
prepares indexing and previews for saved library rows, arms the submitter's
translations and queues that import's ready notification. Artifact requests
waiting for the text are resumed from their own entries. Failures close the
import budget and end dependent artifact waits.

A failed content row can be reclaimed by a later import. No old table alias,
episode-guid fallback or data migration is required in this pre-production app.

## Configuration

`MEDIA_IDEMPOTENCE_TABLE` and `USER_MEDIA_TABLE` are supplied by Terraform.
Neither has a guessed default. Apply the infrastructure and deploy application
changes together through the normal owner release workflow.
