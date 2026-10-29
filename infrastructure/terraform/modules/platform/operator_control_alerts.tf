# TASK-566: the operator's spend against its ceilings, read every 30 minutes by the
# budget audit (`operator.spend_level`, media_summarizer/workers/budget_audit.py).
# The ceilings themselves are `pricing_config.operator_control`; the thresholds
# below are percentages of them, fixed by the owner decision (TASK-563 Owner
# Validation, point 3: alerts at 50 % and 80 % of the monthly ceiling). Runbook:
# docs/OPERATOR_SPEND_CONTROL.md. No account identity in any dimension.
locals {
  operator_levels = {
    exposure = { field = "exposure_pct", metric = "OperatorExposurePct" }
    loss_day = { field = "loss_daily_pct", metric = "OperatorLossDailyPct" }
    loss_mon = { field = "loss_monthly_pct", metric = "OperatorLossMonthlyPct" }
    drift    = { field = "per_account_drift", metric = "OperatorPerAccountDrift" }
    circuits = { field = "open_circuits", metric = "OperatorOpenCircuits" }
  }
  operator_alarms = {
    exposure-50 = { level = "exposure", threshold = 50, description = "Operator spend reached 50 % of its monthly ceiling. Raise the ceiling if growth is healthy." }
    exposure-80 = { level = "exposure", threshold = 80, description = "Operator spend reached 80 % of its monthly ceiling: new spend stops at 100 %." }
    loss-day    = { level = "loss_day", threshold = 80, description = "Failures and open commitments reached 80 % of the daily loss reserve." }
    loss-month  = { level = "loss_mon", threshold = 80, description = "Failures and open commitments reached 80 % of the monthly loss reserve." }
    drift       = { level = "drift", threshold = 0, description = "Operator spend per active account is above its drift threshold: each account costs more, not more accounts." }
    circuits    = { level = "circuits", threshold = 0, description = "At least one provider circuit, or the manual pause, is not closed." }
  }
}

resource "aws_cloudwatch_log_metric_filter" "operator_level" {
  for_each       = local.operator_levels
  name           = "operator-${each.key}${local.suffix}"
  log_group_name = aws_cloudwatch_log_group.budget_audit.name
  pattern        = "{ ($.event = \"operator.spend_level\") && ($.${each.value.field} = *) }"
  metric_transformation {
    name      = each.value.metric
    namespace = local.metrics_namespace
    value     = "$.${each.value.field}"
  }
}

resource "aws_cloudwatch_metric_alarm" "operator_level" {
  for_each            = var.enable_alarms ? local.operator_alarms : {}
  alarm_name          = "${var.project_name}-operator-${each.key}${local.suffix}"
  alarm_description   = "${each.value.description} Runbook: docs/OPERATOR_SPEND_CONTROL.md"
  comparison_operator = each.value.threshold == 0 ? "GreaterThanThreshold" : "GreaterThanOrEqualToThreshold"
  threshold           = each.value.threshold
  evaluation_periods  = 1
  period              = 1800
  statistic           = "Maximum"
  metric_name         = local.operator_levels[each.value.level].metric
  namespace           = local.metrics_namespace
  # The audit's own absence is `budget-audit-missing`; a missing point here is not
  # a reading of zero spend, so it neither alarms nor clears.
  treat_missing_data = "ignore"
  alarm_actions      = [aws_sns_topic.pipeline_alerts[0].arn]
  ok_actions         = [aws_sns_topic.pipeline_alerts[0].arn]
}
