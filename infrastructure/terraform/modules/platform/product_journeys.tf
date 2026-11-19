# TASK-628. The queue conditions are deliberately silent: they only exist as
# inputs to journey composites. A retry/throttle alone is not a product incident.
locals {
  alert_queue_groups = {
    import_capture = {
      journey = "imports"
      queues  = [aws_sqs_queue.x_ingestion, aws_sqs_queue.youtube_ingestion, aws_sqs_queue.instagram_ingestion, aws_sqs_queue.tiktok_ingestion, aws_sqs_queue.web_page_render]
      dlqs    = [aws_sqs_queue.x_ingestion_dlq, aws_sqs_queue.youtube_ingestion_dlq, aws_sqs_queue.instagram_ingestion_dlq, aws_sqs_queue.tiktok_ingestion_dlq, aws_sqs_queue.web_page_render_dlq]
    }
    # Reddit (TASK-633) sits here rather than with the other capture queues:
    # import_capture already holds five queues, the ten-metric ceiling of one alarm.
    import_read = {
      journey = "imports"
      queues  = [aws_sqs_queue.reddit_ingestion, aws_sqs_queue.rss_resolution, aws_sqs_queue.article_extraction, aws_sqs_queue.deepgram_transcription, aws_sqs_queue.document_parsing]
      dlqs    = [aws_sqs_queue.reddit_ingestion_dlq, aws_sqs_queue.rss_resolution_dlq, aws_sqs_queue.article_extraction_dlq, aws_sqs_queue.deepgram_transcription_dlq, aws_sqs_queue.document_parsing_dlq]
    }
    import_finish = {
      journey = "imports"
      queues  = [aws_sqs_queue.media_completed_events, aws_sqs_queue.transcript_translation]
      dlqs    = [aws_sqs_queue.media_completed_events_dlq, aws_sqs_queue.transcript_translation_dlq]
    }
    artifacts = {
      journey = "artefacts"
      queues  = [aws_sqs_queue.artifact_generator]
      dlqs    = [aws_sqs_queue.artifact_generator_dlq]
    }
    chat = {
      journey = "chat"
      queues  = [aws_sqs_queue.chat]
      dlqs    = [aws_sqs_queue.chat_dlq]
    }
    search = {
      journey = "recherche"
      queues  = [aws_sqs_queue.search_indexing]
      dlqs    = [aws_sqs_queue.search_indexing_dlq]
    }
  }
  # A terminal worker failure with retryable=true exhausted the SQS deliveries.
  # Permanent content rejections (private/deleted content, no speech) are excluded.
  import_failure_pattern   = "{ (($.event = \"worker.failed\") && ($.retryable = true)) || ($.event = \"worker.fail_job_failed\") || (($.event = \"llm.generation_failed\") && ($.failure_kind = \"other\")) || (($.event = \"transcription.failed\") && (($.error_code = \"PROVIDER_UNAVAILABLE\") || ($.error_code = \"PROVIDER_TIMED_OUT\") || ($.error_code = \"PROVIDER_RESULT_INVALID\") || ($.error_code = \"INTERNAL_ERROR\"))) }"
  artifact_failure_pattern = "{ ($.event = \"artifact.failed\") && ($.artifact_type != \"review_blurb\") && (($.error_code = \"INTERNAL_ERROR\") || ($.error_code = \"VALIDATION_ERROR\") || ($.error_code = \"PROVIDER_UNAVAILABLE\") || ($.error_code = \"PROVIDER_TIMED_OUT\") || ($.error_code = \"PROVIDER_RESULT_INVALID\") || ($.error_code = \"generation_stalled\") || ($.error_code = \"sources_preparation_timeout\")) }"
  journey_log_sources = merge(
    { for w in ["podcastindex_resolution", "article_extraction", "x_ingestion", "reddit_ingestion", "youtube_ingestion", "instagram_ingestion", "tiktok_ingestion", "deepgram_transcription", "document_parsing", "media_completed_events", "transcript_translation"] : w => {
      group = aws_cloudwatch_log_group.lambda_worker[w].name, journey = "imports", pattern = local.import_failure_pattern
    } },
    { for w, group in { artifacts_api = aws_cloudwatch_log_group.lambda_api.name, artifacts_worker = aws_cloudwatch_log_group.lambda_worker["artifact_generator"].name } : w => {
      group                           = group, journey = "artefacts", pattern = local.artifact_failure_pattern
    } },
    {
      chat_worker   = { group = aws_cloudwatch_log_group.lambda_worker["chat"].name, journey = "chat", pattern = "{ (($.event = \"llm.generation_failed\") && ($.failure_kind = \"other\")) || (($.event = \"worker.failed\") && ($.retryable = true)) }" }
      chat_dispatch = { group = aws_cloudwatch_log_group.lambda_api.name, journey = "chat", pattern = "{ $.event = \"chat.turn.dispatch_failed\" }" }
      search        = { group = aws_cloudwatch_log_group.lambda_worker["search_indexing"].name, journey = "recherche", pattern = "{ ($.event = \"worker.failed\") && ($.retryable = true) }" }
    }
  )
}

resource "aws_cloudwatch_log_metric_filter" "journey_failed" {
  for_each       = local.journey_log_sources
  name           = "parcours-${each.key}-echec${local.suffix}"
  log_group_name = each.value.group
  pattern        = each.value.pattern
  metric_transformation {
    name      = "JourneyFailures-${each.value.journey}"
    namespace = local.metrics_namespace
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "journey_failed" {
  for_each            = var.enable_alarms ? toset(["imports", "artefacts", "chat", "recherche"]) : toset([])
  alarm_name          = "${var.project_name}-condition-echecs-${each.key}${local.suffix}"
  alarm_description   = "Condition sans notification : echecs repetes du parcours ${each.key}. Le compteur mesure des evenements, pas des utilisateurs. Guide : ${local.alert_runbook}#parcours"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 2
  evaluation_periods  = 1
  period              = 900
  statistic           = "Sum"
  metric_name         = "JourneyFailures-${each.key}"
  namespace           = local.metrics_namespace
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "journey_queue_blocked" {
  for_each            = var.enable_alarms ? local.alert_queue_groups : {}
  alarm_name          = "${var.project_name}-condition-file-${replace(each.key, "_", "-")}${local.suffix}"
  alarm_description   = "Condition sans notification : ${each.value.journey}, message sans resultat apres le budget de reprises, ou en file d’echec. Consommee par le parcours. Guide : ${local.alert_runbook}#parcours"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  treat_missing_data  = "notBreaching"

  metric_query {
    id = "blocked"
    expression = "MAX([${join(",", flatten([for i, q in each.value.queues : [
      "IF(age${i} > ${max(900, q.visibility_timeout_seconds * local.worker_max_receive_count)},1,0)",
      "IF(dead${i} > 0,1,0)"
    ]]))}])"
    label       = "Travail sans resultat apres reprises"
    return_data = true
  }
  # At most five queues per condition: CloudWatch permits ten MetricStat
  # inputs per alarm. The imports composite consumes all three import phases.
  dynamic "metric_query" {
    for_each = merge([for i, q in each.value.queues : {
      "age${i}"  = { metric = "ApproximateAgeOfOldestMessage", queue = q.name }
      "dead${i}" = { metric = "ApproximateNumberOfMessagesVisible", queue = each.value.dlqs[i].name }
    }]...)
    content {
      id          = metric_query.key
      return_data = false
      metric {
        namespace   = "AWS/SQS"
        metric_name = metric_query.value.metric
        period      = 300
        stat        = "Maximum"
        dimensions  = { QueueName = metric_query.value.queue }
      }
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "chat_delivery_failed" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-condition-diffusion-chat${local.suffix}"
  alarm_description   = "Condition sans notification : au moins 3 lectures du chat ont echoue en 10 minutes. Consommee par l’incident chat. Guide : ${local.alert_runbook}#parcours"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 3
  evaluation_periods  = 1
  namespace           = "AWS/ApiGateway"
  metric_name         = "5XXError"
  period              = 600
  statistic           = "Sum"
  dimensions          = { ApiName = local.chat_stream_function_name, Stage = local.chat_stream_stage_name }
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_composite_alarm" "journey" {
  for_each = var.enable_alarms ? {
    imports   = "Des imports ne livrent plus leur contenu. Identifier la plateforme et les demandes touchees ; corriger la cause puis reprendre les messages recuperables."
    artefacts = "Des resultats demandes ne sont pas livres. Identifier les artefacts en echec et corriger la generation avant relance. Les apercus automatiques sont exclus du compteur."
    chat      = "Des reponses ne sont pas generees ou ne peuvent plus etre lues. Identifier les tours touches et reparer generation ou diffusion. La lenteur d’ouverture seule n’est pas surveillee."
    recherche = "Des contenus ne deviennent plus trouvables. Reparer l’indexation puis rejouer les indexations en echec."
  } : {}
  alarm_name        = "${var.project_name}-${each.key}-bloques${local.suffix}"
  alarm_description = "${local.alert_prefix} : ${each.value} La condition enfant indique la cause. Logs : ${local.alert_logs} Guide : ${local.alert_runbook}#parcours"
  alarm_rule = join(" OR ", concat(
    ["ALARM(${aws_cloudwatch_metric_alarm.journey_failed[each.key].alarm_name})"],
    [for k, v in local.alert_queue_groups : "ALARM(${aws_cloudwatch_metric_alarm.journey_queue_blocked[k].alarm_name})" if v.journey == each.key],
    each.key == "chat" ? ["ALARM(${aws_cloudwatch_metric_alarm.chat_delivery_failed[0].alarm_name})"] : []
  ))
  alarm_actions = [aws_sns_topic.pipeline_alerts[0].arn]
  # No OK action: counters/queue silence do not prove the user's result arrived.
  tags = { Severity = "high", Journey = each.key }
}

resource "aws_cloudwatch_metric_alarm" "library_write_failed" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-condition-bibliotheque-ecriture${local.suffix}"
  alarm_description   = "Condition sans notification : enregistrement ou etat durable non persiste. Les simples miroirs de metadonnees sont exclus. Guide : ${local.alert_runbook}#bibliotheque"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 1
  namespace           = local.metrics_namespace
  metric_name         = "DurableMediaWriteFailed"
  statistic           = "Sum"
  period              = 300
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_composite_alarm" "library_integrity" {
  count             = var.enable_alarms ? 1 : 0
  alarm_name        = "${var.project_name}-bibliotheque-a-preserver${local.suffix}"
  alarm_description = "${local.alert_prefix} : un enregistrement n’a pas ete conserve correctement, ou un contenu a disparu sans demande. Un seul cas suffit. Action : identifier les medias, preserver les donnees et restaurer si necessaire. Logs : ${local.alert_logs} Guide : ${local.alert_runbook}#bibliotheque"
  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.library_write_failed[0].alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.user_media_unexplained_purge[0].alarm_name})"
  ])
  alarm_actions = [aws_sns_topic.pipeline_alerts[0].arn]
  tags          = { Severity = "critical", Journey = "library" }
}

resource "aws_cloudwatch_metric_alarm" "deletion_incomplete" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-condition-suppression-incomplete${local.suffix}"
  alarm_description   = "Condition sans notification : cascade de suppression en echec ou echeance de purge depassee. Guide : ${local.alert_runbook}#suppression"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  metric_query {
    id          = "incomplete"
    expression  = "MAX([failed,overdue])"
    return_data = true
  }
  dynamic "metric_query" {
    for_each = { failed = { metric = "UserMediaPurgeFailed", stat = "Sum" }, overdue = { metric = "UserMediaRowsOverduePurge", stat = "Maximum" } }
    content {
      id          = metric_query.key
      return_data = false
      metric {
        namespace   = local.metrics_namespace
        metric_name = metric_query.value.metric
        period      = 86400
        stat        = metric_query.value.stat
      }
    }
  }
}
resource "aws_cloudwatch_composite_alarm" "deletion" {
  count             = var.enable_alarms ? 1 : 0
  alarm_name        = "${var.project_name}-suppression-non-honoree${local.suffix}"
  alarm_description = "${local.alert_prefix} : des donnees peuvent subsister apres l’echeance de suppression. Action : lire les elements residuels et leur anciennete, reparer la cascade puis achever la purge. Guide : ${local.alert_runbook}#suppression"
  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.deletion_incomplete[0].alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.user_media_ttl_without_cascade[0].alarm_name})"
  ])
  alarm_actions = [aws_sns_topic.pipeline_alerts[0].arn]
  tags          = { Severity = "high", Journey = "deletion" }
}
resource "aws_cloudwatch_composite_alarm" "capacity" {
  count             = var.enable_alarms ? 1 : 0
  alarm_name        = "${var.project_name}-nouvelles-operations-bloquees${local.suffix}"
  alarm_description = "${local.alert_prefix} : controle de capacite en defaut, reservations abandonnees persistantes, refus repetes du plafond operateur ou compte fournisseur refuse. Action : lire la condition enfant ; reparer le controle ou le compte fournisseur. Ne pas remettre les capacites a zero. Une pause manuelle ne declenche pas cette alarme. Logs : ${local.alert_logs} Guide : ${local.alert_runbook}#capacite"
  alarm_rule = join(" OR ", concat(
    [for a in aws_cloudwatch_metric_alarm.budget_anomaly : "ALARM(${a.alarm_name})"],
    ["ALARM(${aws_cloudwatch_metric_alarm.provider_action_required[0].alarm_name})"]
  ))
  alarm_actions = [aws_sns_topic.pipeline_alerts[0].arn]
  tags          = { Severity = "high", Journey = "capacity" }
}
