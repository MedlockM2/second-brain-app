# One actionable capacity warning. 50%, spend/account and temporary open
# commitments remain in the existing cost report/logs, without alarm objects.
resource "aws_cloudwatch_log_metric_filter" "operator_exposure" {
  name           = "operator-exposure${local.suffix}"
  log_group_name = aws_cloudwatch_log_group.budget_audit.name
  pattern        = "{ ($.event = \"operator.spend_level\") && ($.exposure_pct = *) }"
  metric_transformation {
    name      = "OperatorExposurePct"
    namespace = local.metrics_namespace
    value     = "$.exposure_pct"
  }
}
resource "aws_cloudwatch_metric_alarm" "operator_exposure" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-capacite-financiere-80${local.suffix}"
  alarm_description   = "${local.alert_prefix} : 80 % du plafond mensuel operateur sont engages ou consommes. A 100 %, de nouvelles operations seront refusees. Action : lire les montants et engagements dans l’audit, puis decider du plafond. Ce n’est pas une panne. Guide : ${local.alert_runbook}#depense"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 80
  evaluation_periods  = 1
  period              = 1800
  statistic           = "Maximum"
  metric_name         = "OperatorExposurePct"
  namespace           = local.metrics_namespace
  treat_missing_data  = "ignore"
  alarm_actions       = [aws_sns_topic.pipeline_alerts[0].arn]
  tags                = { Severity = "warning", Journey = "capacity" }
}
