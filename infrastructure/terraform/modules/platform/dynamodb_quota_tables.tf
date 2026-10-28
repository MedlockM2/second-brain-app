# DynamoDB tables for quota enforcement (user usage counters)

# Monthly usage counters per user (hard caps enforcement)
resource "aws_dynamodb_table" "user_usage_monthly" {
  name         = "user_usage_monthly${local.suffix}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "period"

  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "period"
    type = "S" # format: YYYY-MM
  }

  tags = {
    Name = "user_usage_monthly${local.suffix}"
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}

# user_usage_daily is gone (task-548). It held the invisible daily burst-guard
# counters, which only ever logged; the beta budget now bounds what one account can
# spend (rule 16 of docs/research/task-547-beta-budget-control/README.md), and no
# code reads or writes the table any more.
#
# Dropped from state rather than destroyed: the table was created with
# deletion_protection_enabled and prevent_destroy, so a plain resource removal
# would fail the plan. This leaves the physical table untouched in AWS for the
# owner to delete by hand (its rows expire after three days on their own TTL), and
# stops Terraform from managing it.
removed {
  from = aws_dynamodb_table.user_usage_daily

  lifecycle {
    destroy = false
  }
}

# Outputs
output "user_usage_monthly_table_name" {
  value       = aws_dynamodb_table.user_usage_monthly.name
  description = "User usage monthly counters table name"
}
