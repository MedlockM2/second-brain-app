# Permanent provider refusals: a human can act on credit or authentication.
# Rate limits, transient circuits and an owner's manual pause do not match.
# The capacity composite consumes this condition, avoiding separate LLM/operator mails.
resource "aws_cloudwatch_log_metric_filter" "provider_action_required" {
  for_each       = local.budget_log_groups
  name           = "provider-action-${each.key}${local.suffix}"
  log_group_name = each.value
  pattern        = "{ (($.event = \"operator.suspended\") && ($.kind = \"action_required\")) || (($.event = \"llm.generation_failed\") && (($.refusal_reason = \"quota\") || ($.refusal_reason = \"authentication\"))) }"
  metric_transformation {
    name      = "ProviderActionRequired"
    namespace = local.metrics_namespace
    value     = "1"
  }
}
resource "aws_cloudwatch_metric_alarm" "provider_action_required" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-condition-fournisseur-refuse${local.suffix}"
  alarm_description   = "Condition sans notification : compte fournisseur ou credit refuse durablement. Consommee par l’incident de capacite. Guide : ${local.alert_runbook}#capacite"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 1
  period              = 300
  statistic           = "Maximum"
  metric_name         = "ProviderActionRequired"
  namespace           = local.metrics_namespace
  treat_missing_data  = "ignore"
}

# An observed all-closed audit is positive evidence of recovery. Silence or a
# manual pause is neither a new incident nor a fabricated recovery notification.
resource "aws_cloudwatch_log_metric_filter" "providers_recovered" {
  name           = "providers-recovered${local.suffix}"
  log_group_name = aws_cloudwatch_log_group.budget_audit.name
  pattern        = "{ ($.event = \"operator.spend_level\") && ($.open_circuits = 0) }"
  metric_transformation {
    name      = "ProviderActionRequired"
    namespace = local.metrics_namespace
    value     = "0"
  }
}
