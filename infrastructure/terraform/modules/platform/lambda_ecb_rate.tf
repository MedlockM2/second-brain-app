# =============================================================================
# Daily ECB EUR/USD rate for the beta budget (task-559, rule 15 of the owner
# decision in docs/research/task-547-beta-budget-control/README.md).
#
# One Lambda, one schedule. On working days after the ECB publication it reads
# the public daily file and writes the `eur_usd_rate` row of `pricing_config`,
# only when the publication date moves forward. A failed read writes nothing and
# the last rate stays in place.
#
# Least privilege, unlike the shared worker role: its own role may only update
# that single row (dynamodb:LeadingKeys) and write its own logs. It carries no
# runtime secret (its environment drops RUNTIME_SECRET_NAME), so its cold start
# reads nothing from Secrets Manager.
#
# Declared outside local.workers like the Digest scheduler: it is not an SQS
# consumer. CI deploys its image all the same — deploy-lambda.yml discovers the
# Lambdas by the Environment tag and the `media-summarizer-worker-` name prefix,
# which this one carries.
#
# Handler: media_summarizer.workers.lambda_handlers.ecb_rate_refresh_handler
# =============================================================================

variable "ecb_rate_refresh_schedule" {
  description = <<-EOT
    When the EUR/USD rate is refreshed. The ECB publishes its reference rates on
    working days around 16:00 CET; EventBridge rules run in UTC, so 15:30 UTC is
    16:30 in winter and 17:30 in summer, after the publication either way. A
    holiday or a late publication leaves the file on the previous day, and the
    conditional write then changes nothing.
  EOT
  type        = string
  default     = "cron(30 15 ? * MON-FRI *)"
}

locals {
  ecb_rate_function_name = "${var.project_name}-worker-ecb-rate${local.suffix}"
}

resource "aws_cloudwatch_log_group" "ecb_rate" {
  name              = "/aws/lambda/${local.ecb_rate_function_name}"
  retention_in_days = 14

  tags = {
    Name = "${local.ecb_rate_function_name}-logs"
  }
}

resource "aws_iam_role" "ecb_rate" {
  name = "${var.project_name}-ecb-rate${local.suffix}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ecb-rate${local.suffix}"
  }
}

resource "aws_iam_role_policy" "ecb_rate" {
  name = "${var.project_name}-ecb-rate${local.suffix}"
  role = aws_iam_role.ecb_rate.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.ecb_rate.arn}:*"
      },
      {
        # One action on one row: the conditional update of `eur_usd_rate`.
        Effect   = "Allow"
        Action   = ["dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.pricing_config_v1.arn
        Condition = {
          "ForAllValues:StringEquals" = {
            "dynamodb:LeadingKeys" = ["eur_usd_rate"]
          }
        }
      }
    ]
  })
}

resource "aws_lambda_function" "ecb_rate" {
  function_name = local.ecb_rate_function_name
  role          = aws_iam_role.ecb_rate.arn
  package_type  = "Image"
  image_uri     = "${var.ecr_repository_url}:${var.worker_image_tag}"

  # One HTTP GET of a 1.5 kB file and one UpdateItem.
  timeout       = 60
  memory_size   = 256
  architectures = ["arm64"]

  image_config {
    command = ["media_summarizer.workers.lambda_handlers.ecb_rate_refresh_handler"]
  }

  # The shared names every module of the image requires at import
  # (media_summarizer/utils/__init__.py loads the DynamoDB layer, which refuses to
  # start without its table names), minus RUNTIME_SECRET_NAME: without it the cold
  # start loads no secret, which this role could not read anyway. Names are not
  # permissions — the role above still reaches one row of one table.
  environment {
    variables = { for name, value in local.lambda_environment : name => value if name != "RUNTIME_SECRET_NAME" }
  }

  depends_on = [aws_cloudwatch_log_group.ecb_rate]

  # See lambda_workers.tf: image_uri is owned by deploy-lambda.yml.
  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name = local.ecb_rate_function_name
  }
}

resource "aws_cloudwatch_event_rule" "ecb_rate_refresh" {
  name                = "${var.project_name}-ecb-rate-refresh${local.suffix}"
  description         = "Daily ECB EUR/USD rate of the beta budget (task-559)"
  schedule_expression = var.ecb_rate_refresh_schedule
  state               = "ENABLED"

  tags = {
    Name = "${var.project_name}-ecb-rate-refresh${local.suffix}"
  }
}

resource "aws_cloudwatch_event_target" "ecb_rate_refresh" {
  rule      = aws_cloudwatch_event_rule.ecb_rate_refresh.name
  target_id = "${local.ecb_rate_function_name}-refresh"
  arn       = aws_lambda_function.ecb_rate.arn
}

resource "aws_lambda_permission" "ecb_rate_refresh" {
  statement_id  = "AllowEventBridgeEcbRateRefresh"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ecb_rate.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.ecb_rate_refresh.arn
}

output "ecb_rate_function_name" {
  description = "Name of the Lambda that refreshes the EUR/USD rate of the beta budget."
  value       = aws_lambda_function.ecb_rate.function_name
}
