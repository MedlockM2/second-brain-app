# TASK-552: observations, not a second financial counter. Notifications use the
# existing operational SNS channel; no account identity is recorded here.
locals {
  budget_audit_name = "${var.project_name}-worker-budget-audit${local.suffix}"
  budget_log_groups = merge(
    { api = aws_cloudwatch_log_group.lambda_api.name, audit = aws_cloudwatch_log_group.budget_audit.name },
    { for key, group in aws_cloudwatch_log_group.lambda_worker : key => group.name }
  )
  budget_anomalies = {
    control = {
      pattern   = "{ ($.event = \"beta_budget.unavailable\") || ($.event = \"budget_guard.*_unavailable\") || ($.event = \"budget_guard.*_failed\") || ($.event = \"budget_guard.no_payer\") || ($.event = \"beta_budget.observation_failed\") || ($.event = \"beta_budget.settle_after_release\") || ($.event = \"beta_budget.release_after_settle\") || ($.event = \"beta_budget.settle_missing\") || ($.event = \"beta_budget.expiry_sweep_failed\") }"
      threshold = 0
    }
    measurement = {
      pattern   = "{ $.event = \"beta_budget.measurement_missing\" }"
      threshold = 0
    }
    overrun = {
      pattern   = "{ $.event = \"beta_budget.overrun\" }"
      threshold = 0
    }
    stale = {
      pattern   = "{ $.event = \"beta_budget.audit_stale\" }"
      threshold = 0
    }
    # TASK-566: a provider suspended, a send refused by an operator ceiling, a
    # ceiling unreadable (all new spend paused), a circuit update lost.
    operator = {
      pattern   = "{ ($.event = \"operator.suspended\") || ($.event = \"operator.limit_refused\") || ($.event = \"operator.bound_missing\") || ($.event = \"operator.circuit_update_failed\") }"
      threshold = 0
    }
  }
  budget_filters = { for pair in setproduct(keys(local.budget_log_groups), keys(local.budget_anomalies)) :
    "${pair[0]}-${pair[1]}" => { source = pair[0], kind = pair[1] }
  }
}

resource "aws_cloudwatch_log_group" "budget_audit" {
  name              = "/aws/lambda/${local.budget_audit_name}"
  retention_in_days = 14
}

resource "aws_iam_role" "budget_audit" {
  name = "${var.project_name}-budget-audit${local.suffix}"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy" "budget_audit" {
  role = aws_iam_role.budget_audit.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.budget_audit.arn}:*" },
      { Effect = "Allow", Action = ["dynamodb:Scan"], Resource = [aws_dynamodb_table.beta_budget.arn, "${aws_dynamodb_table.beta_budget.arn}/index/open-attempts-index"] },
      # TASK-566: the operator partition only, read for its ceilings and circuits.
      {
        Effect    = "Allow", Action = ["dynamodb:GetItem", "dynamodb:Query"], Resource = aws_dynamodb_table.beta_budget.arn,
        Condition = { "ForAllValues:StringEquals" = { "dynamodb:LeadingKeys" = ["operator"] } }
      },
      {
        Effect    = "Allow", Action = ["dynamodb:GetItem"], Resource = aws_dynamodb_table.pricing_config_v1.arn,
        Condition = { "ForAllValues:StringEquals" = { "dynamodb:LeadingKeys" = ["beta_access", "operator_control"] } }
      }
    ]
  })
}

resource "aws_lambda_function" "budget_audit" {
  function_name = local.budget_audit_name
  role          = aws_iam_role.budget_audit.arn
  package_type  = "Image"
  image_uri     = "${var.ecr_repository_url}:${var.worker_image_tag}"
  timeout       = 120
  memory_size   = 256
  architectures = ["arm64"]
  image_config {
    command = ["media_summarizer.workers.lambda_handlers.budget_audit_handler"]
  }
  environment {
    # Names allow the image's shared modules to import; the role remains read-only
    # and cannot read any runtime secret, user content or provider credential.
    variables = { for name, value in local.lambda_environment : name => value if name != "RUNTIME_SECRET_NAME" }
  }
  depends_on = [aws_cloudwatch_log_group.budget_audit]
  lifecycle {
    ignore_changes = [image_uri]
  }
  tags = { Name = local.budget_audit_name }
}

resource "aws_cloudwatch_event_rule" "budget_audit" {
  name                = "${var.project_name}-budget-audit${local.suffix}"
  schedule_expression = "rate(30 minutes)"
  state               = "ENABLED"
}
resource "aws_cloudwatch_event_target" "budget_audit" {
  rule      = aws_cloudwatch_event_rule.budget_audit.name
  target_id = "budget-audit"
  arn       = aws_lambda_function.budget_audit.arn
}
resource "aws_lambda_permission" "budget_audit" {
  statement_id  = "AllowEventBridgeBudgetAudit"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.budget_audit.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.budget_audit.arn
}

resource "aws_cloudwatch_log_metric_filter" "budget_anomaly" {
  for_each       = local.budget_filters
  name           = "budget-${each.key}${local.suffix}"
  log_group_name = local.budget_log_groups[each.value.source]
  pattern        = local.budget_anomalies[each.value.kind].pattern
  metric_transformation {
    name      = "BetaBudget${title(each.value.kind)}Anomalies"
    namespace = local.metrics_namespace
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "budget_anomaly" {
  for_each            = var.enable_alarms ? local.budget_anomalies : {}
  alarm_name          = "${var.project_name}-budget-${each.key}${local.suffix}"
  alarm_description   = "Beta budget ${each.key} anomaly. No automatic capacity reset. Runbook: docs/BETA_BUDGET_REPORTING.md"
  comparison_operator = "GreaterThanThreshold"
  threshold           = each.value.threshold
  evaluation_periods  = 1
  period              = 300
  statistic           = "Sum"
  metric_name         = "BetaBudget${title(each.key)}Anomalies"
  namespace           = local.metrics_namespace
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.pipeline_alerts[0].arn]
  ok_actions          = [aws_sns_topic.pipeline_alerts[0].arn]
}

resource "aws_cloudwatch_log_metric_filter" "budget_audit_completed" {
  name           = "budget-audit-completed${local.suffix}"
  log_group_name = aws_cloudwatch_log_group.budget_audit.name
  pattern        = "{ $.event = \"beta_budget.audit_succeeded\" }"
  metric_transformation {
    name      = "BetaBudgetAuditCompleted"
    namespace = local.metrics_namespace
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "budget_audit_missing" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-budget-audit-missing${local.suffix}"
  alarm_description   = "The read-only budget reservation audit has not completed for an hour. Runbook: docs/BETA_BUDGET_REPORTING.md"
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  evaluation_periods  = 2
  period              = 1800
  statistic           = "Sum"
  metric_name         = "BetaBudgetAuditCompleted"
  namespace           = local.metrics_namespace
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.pipeline_alerts[0].arn]
  ok_actions          = [aws_sns_topic.pipeline_alerts[0].arn]
}
