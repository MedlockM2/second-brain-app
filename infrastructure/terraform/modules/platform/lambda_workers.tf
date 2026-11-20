# Lambda functions for all SQS-triggered workers.
# Each worker is a container image from the shared ECR repository with a
# per-function CMD override pointing to the appropriate handler module.

variable "worker_image_tag" {
  description = "Bootstrap tag for the shared worker image; CI deploys immutable image digests afterwards."
  type        = string
  default     = "worker-latest"
}

locals {
  # The maxReceiveCount of every queue's redrive policy (sqs.tf), handed to the
  # workers as SQS_MAX_RECEIVE_COUNT: the Lambda handler fails a job on the
  # delivery after which SQS dead-letters its message (workers/sqs_delivery.py).
  worker_max_receive_count = 3

  workers = {
    podcastindex_resolution = {
      memory_size = 256
      timeout     = 60
      queue_arn   = aws_sqs_queue.rss_resolution.arn
      handler     = "media_summarizer.workers.lambda_handlers.podcastindex_resolution_handler"
    }
    article_extraction = {
      memory_size = 512
      timeout     = 60
      queue_arn   = aws_sqs_queue.article_extraction.arn
      handler     = "media_summarizer.workers.lambda_handlers.article_extraction_handler"
    }
    x_ingestion = {
      memory_size = 256
      timeout     = 60
      queue_arn   = aws_sqs_queue.x_ingestion.arn
      handler     = "media_summarizer.workers.lambda_handlers.x_ingestion_handler"
    }
    # TASK-633. 120 s: a callback reads the whole dataset of a thread (page by
    # page) and the run's cost before storing it. Under the queue's 300 s
    # visibility timeout.
    reddit_ingestion = {
      memory_size = 512
      timeout     = 120
      queue_arn   = aws_sqs_queue.reddit_ingestion.arn
      handler     = "media_summarizer.workers.lambda_handlers.reddit_ingestion_handler"
    }
    youtube_ingestion = {
      memory_size = 512
      timeout     = 60
      queue_arn   = aws_sqs_queue.youtube_ingestion.arn
      handler     = "media_summarizer.workers.lambda_handlers.youtube_ingestion_handler"
    }
    instagram_ingestion = {
      memory_size = 512
      # 300 s, not the 60 s the other resolvers get: since task-384 a photo post is
      # OCR'd inside this invocation, image by image, through LlamaParse (upload
      # then poll, up to 120 s for one file) with the Unstructured fallback behind
      # it. That is the document worker's workload, and it is why that worker has
      # 600 s. The worker's own budget (POST_IMAGE_PARSE_BUDGET_SECONDS, 240 s)
      # stops the parsing loop before this ceiling, so a long carousel completes
      # with the slides it managed rather than being killed with nothing. Stays
      # under the queue's 360 s visibility timeout so a redelivery can never
      # overlap a running invocation.
      timeout   = 300
      queue_arn = aws_sqs_queue.instagram_ingestion.arn
      handler   = "media_summarizer.workers.lambda_handlers.instagram_ingestion_handler"
    }
    # TASK-636. 300 s like Instagram: a post's images are OCR'd in the callback
    # that also reads its comments, under the queue's 360 s visibility timeout.
    facebook_ingestion = {
      memory_size = 512
      timeout     = 300
      queue_arn   = aws_sqs_queue.facebook_ingestion.arn
      handler     = "media_summarizer.workers.lambda_handlers.facebook_ingestion_handler"
    }
    tiktok_ingestion = {
      memory_size = 512
      timeout     = 60
      queue_arn   = aws_sqs_queue.tiktok_ingestion.arn
      handler     = "media_summarizer.workers.lambda_handlers.tiktok_ingestion_handler"
    }
    deepgram_transcription = {
      memory_size = 512
      timeout     = 600
      queue_arn   = aws_sqs_queue.deepgram_transcription.arn
      handler     = "media_summarizer.workers.lambda_handlers.deepgram_transcription_handler"
    }
    artifact_generator = {
      memory_size = 512
      timeout     = 300
      queue_arn   = aws_sqs_queue.artifact_generator.arn
      handler     = "media_summarizer.workers.lambda_handlers.artifact_generator_handler"
    }
    document_parsing = {
      memory_size = 512
      timeout     = 600
      queue_arn   = aws_sqs_queue.document_parsing.arn
      handler     = "media_summarizer.workers.lambda_handlers.document_parsing_handler"
    }
    search_indexing = {
      memory_size = 256
      timeout     = 60
      queue_arn   = aws_sqs_queue.search_indexing.arn
      handler     = "media_summarizer.workers.lambda_handlers.search_indexing_handler"
    }
    rss_feed_poll = {
      memory_size = 512
      timeout     = 120
      queue_arn   = aws_sqs_queue.rss_feed_poll.arn
      handler     = "media_summarizer.workers.lambda_handlers.rss_feed_poll_handler"
    }
    media_completed_events = {
      memory_size = 256
      timeout     = 60
      queue_arn   = aws_sqs_queue.media_completed_events.arn
      handler     = "media_summarizer.workers.lambda_handlers.media_completed_events_handler"
    }
    transcript_translation = {
      memory_size = 512
      timeout     = 300
      queue_arn   = aws_sqs_queue.transcript_translation.arn
      handler     = "media_summarizer.workers.lambda_handlers.transcript_translation_handler"
    }
    # The chat's own worker (task-463). Timeout and queue visibility are explained
    # together on aws_sqs_queue.chat. Concurrency 10 like the artifact worker, but
    # its own: the chat and the artifacts no longer wait in one line. What they
    # share is the provider's token-rate limit, which task-459/466 controls.
    chat = {
      memory_size         = 512
      timeout             = 600
      queue_arn           = aws_sqs_queue.chat.arn
      handler             = "media_summarizer.workers.lambda_handlers.chat_handler"
      maximum_concurrency = 10
    }
    # Two HTTP calls to Expo and a handful of DynamoDB reads. 60s and 256MB is the
    # smallest envelope in this map, and it is the right one: the work is waiting
    # on a third party, not computing.
    push_notification = {
      memory_size = 256
      timeout     = 60
      queue_arn   = aws_sqs_queue.push_notification.arn
      handler     = "media_summarizer.workers.lambda_handlers.push_notification_handler"
    }
  }
}

# CloudWatch Log Groups for workers
resource "aws_cloudwatch_log_group" "lambda_worker" {
  for_each = local.workers

  name              = "/aws/lambda/${var.project_name}-worker-${each.key}${local.suffix}"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-worker-${each.key}${local.suffix}-logs"
  }
}

# Lambda Functions
resource "aws_lambda_function" "worker" {
  for_each = local.workers

  function_name = "${var.project_name}-worker-${each.key}${local.suffix}"
  role          = aws_iam_role.lambda_worker.arn
  package_type  = "Image"
  image_uri     = "${var.ecr_repository_url}:${var.worker_image_tag}"
  timeout       = each.value.timeout
  memory_size   = each.value.memory_size
  architectures = ["arm64"]

  image_config {
    command = [each.value.handler]
  }

  # Every table, queue and bucket name this environment owns. The application
  # code no longer carries hardcoded defaults, so this block is the only source
  # of resource names at runtime (see runtime_env.tf).
  environment {
    variables = merge(
      local.lambda_environment,
      { SQS_MAX_RECEIVE_COUNT = tostring(local.worker_max_receive_count) },
      contains(["instagram_ingestion", "tiktok_ingestion", "youtube_ingestion", "reddit_ingestion", "facebook_ingestion"], each.key) ? {
        APIFY_WEBHOOK_URL = "${aws_apigatewayv2_api.main.api_endpoint}/api/webhooks/apify"
      } : {},
      # The two Reddit actors are configuration, not secrets: swapping them is
      # the remedy when the primary keeps failing (TASK-633). Their token,
      # APIFY_REDDIT_API_TOKEN, is in the runtime secret like every Apify token.
      each.key == "reddit_ingestion" ? {
        APIFY_REDDIT_PRIMARY_ACTOR_ID      = "kaix~reddit-scraper"
        APIFY_REDDIT_FALLBACK_ACTOR_ID     = "automation-lab~reddit-scraper"
        APIFY_REDDIT_FALLBACK_MAX_COMMENTS = "1000"
      } : {},
      # The four Facebook actors and the comment cap (TASK-636): configuration,
      # swapped here if an actor breaks. APIFY_FACEBOOK_API_TOKEN is in the
      # runtime secret like every Apify token.
      each.key == "facebook_ingestion" ? {
        APIFY_FACEBOOK_VIDEO_ACTOR_ID          = var.apify_facebook_actors.video
        APIFY_FACEBOOK_VIDEO_FALLBACK_ACTOR_ID = var.apify_facebook_actors.video_fallback
        APIFY_FACEBOOK_POST_ACTOR_ID           = var.apify_facebook_actors.post
        APIFY_FACEBOOK_COMMENT_ACTOR_ID        = var.apify_facebook_actors.comments
        APIFY_FACEBOOK_MAX_COMMENTS            = tostring(var.apify_facebook_max_comments)
      } : {},
    )
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_worker
  ]

  # image_uri is owned by deploy-lambda.yml (it pushes :worker-<sha> per commit
  # and runs aws lambda update-function-code on every worker function).
  # Terraform only seeds :worker-latest at first creation; afterwards the CI is
  # the source of truth, so don't let `terraform apply` revert deployed images.
  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name = "${var.project_name}-worker-${each.key}${local.suffix}"
  }
}

# SQS Event Source Mappings
resource "aws_lambda_event_source_mapping" "worker" {
  for_each = local.workers

  event_source_arn = each.value.queue_arn
  function_name    = aws_lambda_function.worker[each.key].arn
  batch_size       = 1

  # Without it Lambda ignores the batchItemFailures the handler returns, counts
  # the batch as a success and deletes every message: a worker's exception was
  # lost on its first delivery, and the redrive policy only ever saw timeouts
  # and crashes (task-573).
  function_response_types = ["ReportBatchItemFailures"]

  # Disabling the mapping stops the long-poll without deleting it: an idle
  # environment's 14 mappings issue ~74k SQS Tier-1 requests a day against
  # queues that never receive anything (~$0.90/mo). Re-enabling is a one-line
  # apply, so a mothballed environment stays one command from usable.
  enabled = var.enable_worker_polling

  # Scale up slowly to avoid throttling. A worker may set its own ceiling.
  scaling_config {
    maximum_concurrency = lookup(each.value, "maximum_concurrency", 10)
  }
}

output "worker_bootstrap_image_uri" {
  description = "Shared worker image URI used by Terraform when creating worker Lambdas."
  value       = "${var.ecr_repository_url}:${var.worker_image_tag}"
}

output "worker_function_names" {
  description = "Names of this environment's worker Lambda functions."
  value       = [for w in aws_lambda_function.worker : w.function_name]
}
