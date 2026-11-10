# =============================================================================
# Web page render worker
# =============================================================================
#
# Reads a web page in headless Chromium when its served HTML is not enough --
# script-drawn text, or embedded videos -- and hands the videos to the Deepgram
# worker (media_summarizer/workers/web_page_render_worker.py).
#
# Outside `local.workers` on purpose: it runs its own image
# (lambda-web-render.Dockerfile, the shared worker code plus Chromium), and the
# workers' deploy loop in deploy-lambda.yml updates every
# `media-summarizer-worker-*` function with the shared image. The name keeps it
# out of that loop; deploy-lambda.yml deploys it by digest in its own job, like
# the chat stream.
#
# Sizing: Chromium wants memory (2 GB is the usual floor for a stable headless
# browser on Lambda, and buys proportionally more CPU), and the videos' audio is
# written to /tmp before upload (each up to 200 MB, deleted once uploaded), hence
# 2 GB of ephemeral storage. 300 s covers the render (~5 s measured) plus up to
# five videos downloaded one after the other; the queue's visibility stays above
# it so a redelivery can never overlap a running invocation.

variable "web_render_image_tag" {
  description = "Bootstrap tag for the web page render image; CI deploys immutable image digests afterwards."
  type        = string
  default     = "web-render-latest"
}

locals {
  web_render_function_name = "${var.project_name}-web-render${local.suffix}"
}

resource "aws_sqs_queue" "web_page_render_dlq" {
  name                      = "web-page-render-dlq${local.suffix}"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name = "web-page-render-dlq${local.suffix}"
  }
}

resource "aws_sqs_queue" "web_page_render" {
  name                       = "web-page-render-queue${local.suffix}"
  visibility_timeout_seconds = 360
  message_retention_seconds  = 1209600

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.web_page_render_dlq.arn
    maxReceiveCount     = local.worker_max_receive_count
  })

  tags = {
    Name = "web-page-render-queue${local.suffix}"
  }
}

resource "aws_cloudwatch_log_group" "web_render" {
  name              = "/aws/lambda/${local.web_render_function_name}"
  retention_in_days = 14

  tags = {
    Name = "${local.web_render_function_name}-logs"
  }
}

resource "aws_lambda_function" "web_render" {
  function_name = local.web_render_function_name
  role          = aws_iam_role.lambda_worker.arn
  package_type  = "Image"
  image_uri     = "${var.ecr_repository_url}:${var.web_render_image_tag}"
  timeout       = 300
  memory_size   = 2048
  architectures = ["arm64"]

  ephemeral_storage {
    size = 2048
  }

  # The entrypoint (awslambdaric) and the handler are in the image.
  environment {
    variables = merge(
      local.lambda_environment,
      { SQS_MAX_RECEIVE_COUNT = tostring(local.worker_max_receive_count) },
    )
  }

  depends_on = [aws_cloudwatch_log_group.web_render]

  # image_uri is owned by deploy-lambda.yml (:web-render-<sha> by digest).
  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name = local.web_render_function_name
  }
}

resource "aws_lambda_event_source_mapping" "web_render" {
  event_source_arn        = aws_sqs_queue.web_page_render.arn
  function_name           = aws_lambda_function.web_render.arn
  batch_size              = 1
  function_response_types = ["ReportBatchItemFailures"]
  enabled                 = var.enable_worker_polling

  # A browser per invocation: a handful at once is plenty for a beta, and keeps a
  # burst of saves from stacking 2 GB functions.
  scaling_config {
    maximum_concurrency = 5
  }
}

output "web_render_function_name" {
  description = "Name of the web page render Lambda function."
  value       = aws_lambda_function.web_render.function_name
}
