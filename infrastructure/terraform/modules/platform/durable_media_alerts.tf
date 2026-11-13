# Product outcomes for the durable library, not metadata/cache failures.
# Silent conditions below are read by the product composites (TASK-628).

resource "aws_cloudwatch_log_metric_filter" "durable_media_write_failed_api" {
  name           = "durable-media-write-failed-api${local.suffix}"
  log_group_name = aws_cloudwatch_log_group.lambda_api.name
  pattern        = "{ ($.event = \"durable_media.write_failed\") && (($.attributes NOT EXISTS) || ($.attributes[*] = \"processing_status\")) }"

  metric_transformation {
    name          = "DurableMediaWriteFailed"
    namespace     = local.metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "durable_media_write_failed_worker" {
  for_each = local.workers

  name           = "durable-media-write-failed-${each.key}${local.suffix}"
  log_group_name = aws_cloudwatch_log_group.lambda_worker[each.key].name
  pattern        = "{ ($.event = \"durable_media.write_failed\") && (($.attributes NOT EXISTS) || ($.attributes[*] = \"processing_status\")) }"

  metric_transformation {
    name          = "DurableMediaWriteFailed"
    namespace     = local.metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "user_media_purge_completed" {
  name           = "user-media-purge-completed${local.suffix}"
  log_group_name = aws_cloudwatch_log_group.media_lifecycle.name
  pattern        = "{ $.event = \"user_media.purge_cascade_completed\" }"

  metric_transformation {
    name          = "UserMediaPurgeCompleted"
    namespace     = local.metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "user_media_purge_failed" {
  name           = "user-media-purge-failed${local.suffix}"
  log_group_name = aws_cloudwatch_log_group.media_lifecycle.name
  pattern        = "{ $.event = \"user_media.purge_cascade_failed\" }"

  metric_transformation {
    name          = "UserMediaPurgeFailed"
    namespace     = local.metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "user_media_unexplained_purge" {
  name           = "user-media-unexplained-purge${local.suffix}"
  log_group_name = aws_cloudwatch_log_group.media_lifecycle.name
  pattern        = "{ $.event = \"user_media.unexplained_purge\" }"

  metric_transformation {
    name          = "UserMediaUnexplainedPurge"
    namespace     = local.metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "user_media_reconciliation_ran" {
  name           = "user-media-reconciliation-ran${local.suffix}"
  log_group_name = aws_cloudwatch_log_group.media_lifecycle.name
  pattern        = "{ $.event = \"user_media.reconciliation_completed\" }"

  metric_transformation {
    name          = "UserMediaReconciliationRuns"
    namespace     = local.metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "user_media_rows_overdue_purge" {
  name           = "user-media-rows-overdue-purge${local.suffix}"
  log_group_name = aws_cloudwatch_log_group.media_lifecycle.name
  pattern        = "{ $.event = \"user_media.reconciliation_completed\" }"

  metric_transformation {
    name      = "UserMediaRowsOverduePurge"
    namespace = local.metrics_namespace
    value     = "$.library_rows_overdue_purge"
  }
}

resource "aws_cloudwatch_metric_alarm" "user_media_unexplained_purge" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-user-media-unexplained-purge${local.suffix}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  threshold           = "0"
  alarm_description   = "Condition sans notification : contenu disparu sans suppression demandee. Preserver les objets puis restaurer la ligne. Consommee par l’incident bibliotheque. Guide : ${local.alert_runbook}#bibliotheque"
  treat_missing_data  = "notBreaching"

  metric_name = "UserMediaUnexplainedPurge"
  namespace   = local.metrics_namespace
  period      = "300"
  statistic   = "Sum"

  tags = {
    Name     = "${var.project_name}-user-media-unexplained-purge${local.suffix}"
    Severity = "critical"
  }
}

resource "aws_cloudwatch_metric_alarm" "user_media_ttl_without_cascade" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-user-media-ttl-without-cascade${local.suffix}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  datapoints_to_alarm = "2"
  threshold           = "0"
  alarm_description   = "Condition sans notification : des expirations TTL restent sans cascade comptabilisee pendant deux jours. Consommee par l’incident suppression. Guide : ${local.alert_runbook}#suppression"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "unaccounted"
    expression  = "IF(swept - (cascaded + flagged) > 0, swept - (cascaded + flagged), 0)"
    label       = "TTL sweeps the cascade never accounted for"
    return_data = true
  }

  metric_query {
    id = "swept"
    metric {
      metric_name = "TimeToLiveDeletedItemCount"
      namespace   = "AWS/DynamoDB"
      period      = "86400"
      stat        = "Sum"
      dimensions = {
        TableName = aws_dynamodb_table.user_media_v1.name
      }
    }
  }

  metric_query {
    id = "cascaded"
    metric {
      metric_name = "UserMediaPurgeCompleted"
      namespace   = local.metrics_namespace
      period      = "86400"
      stat        = "Sum"
    }
  }

  metric_query {
    id = "flagged"
    metric {
      metric_name = "UserMediaUnexplainedPurge"
      namespace   = local.metrics_namespace
      period      = "86400"
      stat        = "Sum"
    }
  }

  tags = {
    Name     = "${var.project_name}-user-media-ttl-without-cascade${local.suffix}"
    Severity = "critical"
  }
}

resource "aws_cloudwatch_metric_alarm" "user_media_reconciliation_stopped" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-user-media-reconciliation-stopped${local.suffix}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  threshold           = "1"
  alarm_description   = "${local.alert_prefix} : aucun controle complet de bibliotheque depuis 48 h. Les pertes et suppressions peuvent devenir invisibles. Action : reparer la reconciliation. Guide : ${local.alert_runbook}#controles"
  alarm_actions       = [aws_sns_topic.pipeline_alerts[0].arn]
  ok_actions          = [aws_sns_topic.pipeline_alerts[0].arn]
  treat_missing_data  = "breaching"

  metric_name = "UserMediaReconciliationRuns"
  namespace   = local.metrics_namespace
  period      = "172800"
  statistic   = "Sum"

  tags = {
    Name     = "${var.project_name}-user-media-reconciliation-stopped${local.suffix}"
    Severity = "warning"
  }
}
