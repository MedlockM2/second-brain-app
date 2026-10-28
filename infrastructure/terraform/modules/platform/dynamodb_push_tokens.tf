# Device registrations for Digest push notifications (task-369).
#
# Account registrations: PK user_id, SK push_token. Several phones per account
# are listed by querying its partition. The reserved __push_token_owners__
# partition holds the sole current owner of each token; registration updates both
# rows in one transaction, and delivery checks that owner with a strong read.
# This prevents a phone from receiving pushes for two accounts after a switch.
# No extra table or index is needed.
#
# No TTL attribute, deliberately. Staleness here is not "this row expired at a
# time we knew in advance": a device goes quiet when the app is uninstalled, and
# nothing tells us when. The 90-day sweep in utils/push_token_db.py reads
# last_seen_at and deletes, driven by the daily rule in
# lambda_digest_scheduler.tf. The repo also has a guard (scripts/
# check_purge_at_writers.py) against writing purge_at where it does not belong,
# and this table is one of those places.
#
# Sign-out, staleness and account deletion use utils/push_token_db.py to remove
# account and owner rows together without unregistering a subsequent owner.

resource "aws_dynamodb_table" "user_push_tokens" {
  name         = "user_push_tokens${local.suffix}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "push_token"

  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "push_token"
    type = "S"
  }

  tags = {
    Name = "user_push_tokens${local.suffix}"
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}

output "user_push_tokens_table_name" {
  value       = aws_dynamodb_table.user_push_tokens.name
  description = "Device registrations for Digest push notifications"
}
