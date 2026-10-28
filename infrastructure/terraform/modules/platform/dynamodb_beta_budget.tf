# Beta budget ledger (task-548). Schema, states, transitions and the condition of
# every write: docs/BETA_BUDGET_CONTROL.md. Owner decision:
# docs/research/task-547-beta-budget-control/README.md.
#
# One partition per account (`user_id`), two kinds of item under the sort key
# `sk`: the month counter (`period#YYYY-MM`) and one attempt per paid provider call
# (`attempt#<operation>:<component>:<try>`). Admission, settlement and release are
# TransactWriteItems over a counter and its attempts, which the API and worker
# roles already hold through the environment-suffix match of local.table_arns
# (Put, Update and ConditionCheckItem); no policy change is needed.
#
# `open-attempts-index` is sparse: only an attempt still `held` or `sending`
# carries `open_since`, which every close removes. It is what the backstop reads to
# release the holds no worker will ever close, without reading an account's whole
# history.
#
# TTL on `ttl_epoch`, written only on items whose life is over: a month counter
# (its period end + 400 days) and a closed attempt (its close + 400 days). An open
# attempt never carries it, so an unreconciled reservation cannot disappear. The
# 400 days keep a full year of months comparable for TASK-552 and outlast by far the
# 14-day retention of any queue that could replay an operation.
#
# PITR, deletion protection and prevent_destroy like every other user-scoped table:
# the ledger is what proves what a tester consumed and what the operator spent.
resource "aws_dynamodb_table" "beta_budget" {
  name         = "beta_budget${local.suffix}"
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
  attribute {
    name = "open_since"
    type = "S" # ISO 8601 UTC, microseconds always written, so text order is time order
  }

  global_secondary_index {
    name            = "open-attempts-index"
    hash_key        = "user_id"
    range_key       = "open_since"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl_epoch"
    enabled        = true
  }

  tags = {
    Name = "beta_budget${local.suffix}"
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}

output "beta_budget_table_name" {
  value       = aws_dynamodb_table.beta_budget.name
  description = "Beta budget ledger table name"
}
