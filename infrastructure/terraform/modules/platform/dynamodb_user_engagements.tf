# TASK-582: one last explicit engagement per owned artifact or conversation.
resource "aws_dynamodb_table" "user_engagements" {
  name         = "user_engagements${local.suffix}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "target_key"

  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "target_key"
    type = "S"
  }
  attribute {
    name = "recency_key"
    type = "S"
  }
  attribute {
    name = "scope_key"
    type = "S"
  }

  # Small pointer records only; current titles, states and covers are hydrated.
  local_secondary_index {
    name            = "recent-index"
    range_key       = "recency_key"
    projection_type = "ALL"
  }
  local_secondary_index {
    name            = "scope-index"
    range_key       = "scope_key"
    projection_type = "KEYS_ONLY"
  }

  ttl {
    attribute_name = "expires_at"
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
    Name = "user_engagements${local.suffix}"
  }
}
