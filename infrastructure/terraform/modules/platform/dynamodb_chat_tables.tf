# =============================================================================
# chat -- durable state of the conversational chat (task-457)
#
# Owner decision: docs/research/task-430-chatbot-architecture/README.md, Owner
# Validation, point 3. Item schema, states and write conditions:
# docs/CHAT_DATA_MODEL.md.
#
# A table of its own, not media_artifacts: that table is addressed by content
# and shared between accounts (README §2.1), a conversation belongs to one
# account and is never shared.
#
# PK user_id, SK sk. Every item of a conversation sits under "CONV#<id>" in the
# account's partition: the conversation, its messages, its attempts and its
# fragments. That one-partition-per-account layout is
# what lets account erasure empty the table with a single partition query
# (_USER_PARTITION_TABLES in core/services/account_deletion_service.py).
#
# Load-bearing, do not edit casually:
#
#   1. `fragment_expires_at` is the ONLY TTL attribute, and only fragments carry
#      it. DynamoDB ignores items without a numeric value in the TTL attribute,
#      which is how conversations and messages are kept forever on a table that
#      has a TTL (Decision point 3: no TTL on conversations and messages).
#   2. The LSI can only be declared at table creation. Adding it later means
#      recreating a table that carries prevent_destroy.
# =============================================================================

resource "aws_dynamodb_table" "chat" {
  name         = "chat${local.suffix}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "sk"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  # "<scope>#<scope_id>#<last activity ISO-8601>", set on conversation items
  # only, so the index is sparse: one entry per conversation, none per message
  # or fragment.
  attribute {
    name = "scope_activity_key"
    type = "S"
  }

  # The history of one media or one folder, latest activity first, in one
  # strongly consistent query. INCLUDE rather than ALL: the source snapshot (up
  # to ~10 kB on a full folder) stays out, a history page draws without it.
  # The list must match SUMMARY_PROJECTED_ATTRIBUTES in core/models/chat.py.
  # An LSI caps an account's partition at 10 GB, several orders of magnitude
  # above what a chat history weighs.
  local_secondary_index {
    name            = "scope-activity-index"
    range_key       = "scope_activity_key"
    projection_type = "INCLUDE"
    non_key_attributes = [
      "conversation_id",
      "scope",
      "scope_id",
      "title",
      "turn_count",
      "active_turn_id",
      "last_turn_status",
      "created_at",
      "last_activity_at",
    ]
  }

  ttl {
    attribute_name = "fragment_expires_at"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = "chat${local.suffix}"
  }
}

output "chat_table_name" {
  value       = aws_dynamodb_table.chat.name
  description = "Durable chat state: conversations, messages, attempts, fragments (task-457)"
}
