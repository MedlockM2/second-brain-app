# Product alerting (TASK-628). Technical conditions have no actions; only
# journey composites and actionable safeguards notify. Policy: docs/PRODUCT_ALERTING.md.
resource "aws_sns_topic" "pipeline_alerts" {
  count = var.enable_alarms ? 1 : 0
  name  = "${var.project_name}-pipeline-alerts${local.suffix}"
  tags  = { Name = "${var.project_name}-pipeline-alerts${local.suffix}" }
}

resource "aws_sns_topic_subscription" "pipeline_alerts_email" {
  count     = var.enable_alarms && var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.pipeline_alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

locals {
  alert_runbook = "https://github.com/MedlockM2/second-brain-app/blob/main/docs/PRODUCT_ALERTING.md"
  alert_logs    = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#logsV2:log-groups"
  alert_prefix  = "Deepn ${upper(var.environment)}"
}

# Three failed HTTP requests in ten minutes, without a minimum traffic volume:
# one person repeatedly blocked matters in beta. A single transient 5xx does not.
resource "aws_cloudwatch_metric_alarm" "api_5xx_rate" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-api-indisponible${local.suffix}"
  alarm_description   = "${local.alert_prefix} : au moins 3 requetes HTTP ont echoue en 10 minutes (5xx). Action : identifier le parcours en echec dans les logs API puis corriger ou revenir a la release precedente. Logs : ${local.alert_logs} Guide : ${local.alert_runbook}#api"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 3
  evaluation_periods  = 1
  metric_name         = "5xx"
  namespace           = "AWS/ApiGateway"
  period              = 600
  statistic           = "Sum"
  dimensions          = { ApiId = local.api_gateway_id }
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.pipeline_alerts[0].arn]
  tags                = { Severity = "high", Journey = "api" }
}
