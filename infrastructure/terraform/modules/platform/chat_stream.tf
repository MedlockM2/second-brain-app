# =============================================================================
# chat stream -- the SSE door of the chat (task-464)
#
# Owner decision: docs/research/task-430-chatbot-architecture/README.md, Owner
# Validation, point 5. A dedicated Lambda reads the persisted fragments back and
# streams them (media_summarizer/api/chat_stream_app.py, FastAPI + uvicorn behind
# the Lambda Web Adapter, image infrastructure/docker/lambda-chat-stream.Dockerfile),
# behind a REGIONAL REST API in STREAM mode. No Function URL: the REST API brings
# throttling, access logs and streaming metrics. The main HTTP API keeps every
# other chat route under /api/chat.
#
# Not in local.workers: it has no queue, and that map's for_each builds an SQS
# event source mapping per entry (task-430 complement C1.6). Its name is
# media-summarizer-chat-stream-<env>, NOT media-summarizer-worker-*: the workers'
# deploy loop would otherwise push the worker image onto it.
#
# Why the integration is declared through an OpenAPI body: the AWS provider this
# repo pins (~> 5.0, locked at 5.100.0) has no response_transfer_mode argument on
# aws_api_gateway_integration -- REST API streaming shipped on 2025-11-19, after
# the 5.x line. The x-amazon-apigateway-integration extension does carry
# `responseTransferMode: STREAM`, and an imported body is applied by API Gateway
# itself whatever the provider version
# (https://docs.aws.amazon.com/apigateway/latest/developerguide/response-streaming-lambda-configure.html).
# Streaming needs the InvokeWithResponseStream URI: API version 2021-11-15 and
# /response-streaming-invocations instead of /invocations.
# =============================================================================

variable "chat_stream_image_tag" {
  description = "Bootstrap tag for the chat stream image; CI deploys immutable image digests afterwards."
  type        = string
  default     = "chat-stream-latest"
}

variable "chat_stream_reserved_concurrency" {
  description = <<-EOT
    The connection budget of the chat stream (Decision point 5): every open
    stream holds one execution for as long as it lasts, so this is the number of
    phones that can follow an answer at once. Reserved, so a burst of streams can
    neither starve the API and the workers nor be starved by them. A stream only
    lives while a turn is generating (one per account), so 20 is several times the
    beta's peak; both accounts have 1 000 of concurrency (read 2026-10-11).
  EOT
  type        = number
  default     = 20
}

variable "chat_stream_throttle_rate" {
  description = "Steady-state requests per second the stream stage accepts (stream openings, not bytes)."
  type        = number
  default     = 20
}

variable "chat_stream_throttle_burst" {
  description = "Burst of stream openings the stage accepts above the steady rate."
  type        = number
  default     = 40
}

locals {
  chat_stream_function_name = "${var.project_name}-chat-stream${local.suffix}"
  chat_stream_stage_name    = "v1"

  # The integration, shared by the method of the OpenAPI body below.
  chat_stream_integration_uri = "arn:aws:apigateway:${var.aws_region}:lambda:path/2021-11-15/functions/${aws_lambda_function.chat_stream.arn}/response-streaming-invocations"

  # CORS for the web app (task-474). The stream authenticates with an
  # Authorization header, never a cookie, so a browser preflights every opening:
  # OPTIONS is answered here by a mock integration, without reaching the Lambda.
  # The Lambda adds the same origin to its own answers (chat_stream_app.py), and
  # the gateway responses carry it too, or the browser hides a 401/403/5xx from
  # the app behind an opaque CORS error. Same origin as the HTTP API's
  # (var.web_app_origin, one per environment); empty means no CORS at all.
  chat_stream_cors_origin = "'${var.web_app_origin}'"

  chat_stream_preflight = {
    responses = {
      "200" = {
        description = "CORS preflight"
        headers = {
          "Access-Control-Allow-Origin"  = { schema = { type = "string" } }
          "Access-Control-Allow-Headers" = { schema = { type = "string" } }
          "Access-Control-Allow-Methods" = { schema = { type = "string" } }
          "Access-Control-Max-Age"       = { schema = { type = "string" } }
          "Vary"                         = { schema = { type = "string" } }
        }
      }
    }
    "x-amazon-apigateway-integration" = {
      type             = "mock"
      requestTemplates = { "application/json" = "{\"statusCode\": 200}" }
      responses = {
        default = {
          statusCode = "200"
          responseParameters = {
            "method.response.header.Access-Control-Allow-Origin"  = local.chat_stream_cors_origin
            "method.response.header.Access-Control-Allow-Headers" = "'authorization'"
            "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
            "method.response.header.Access-Control-Max-Age"       = "'3600'"
            "method.response.header.Vary"                         = "'Origin'"
          }
        }
      }
    }
  }

  chat_stream_gateway_responses = {
    for kind in ["DEFAULT_4XX", "DEFAULT_5XX"] : kind => {
      responseParameters = {
        "gatewayresponse.header.Access-Control-Allow-Origin" = local.chat_stream_cors_origin
        "gatewayresponse.header.Vary"                        = "'Origin'"
      }
    }
  }

  chat_stream_openapi = merge({
    openapi = "3.0.1"
    info = {
      title   = "${var.project_name}-chat-stream${local.suffix}"
      version = "1"
    }
    paths = {
      "/chat/conversations/{conversation_id}/stream" = merge(var.web_app_origin == "" ? {} : { options = local.chat_stream_preflight }, {
        get = {
          parameters = [
            { name = "conversation_id", "in" = "path", required = true, schema = { type = "string" } },
            { name = "turn_id", "in" = "query", required = false, schema = { type = "string" } },
            { name = "attempt_id", "in" = "query", required = false, schema = { type = "string" } },
            { name = "after_seq", "in" = "query", required = false, schema = { type = "string" } },
          ]
          "x-amazon-apigateway-integration" = {
            type                 = "aws_proxy"
            httpMethod           = "POST"
            uri                  = local.chat_stream_integration_uri
            responseTransferMode = "STREAM"
            # 15 minutes, the ceiling of a streamed response. The app ends its own
            # stream before (CHAT_STREAM_MAX_SECONDS) and the phone reconnects.
            timeoutInMillis = 900000
          }
        }
      })
    }
  }, var.web_app_origin == "" ? {} : { "x-amazon-apigateway-gateway-responses" = local.chat_stream_gateway_responses })
}

# -----------------------------------------------------------------------------
# Lambda
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "chat_stream" {
  name              = "/aws/lambda/${local.chat_stream_function_name}"
  retention_in_days = 14

  tags = {
    Name = "${local.chat_stream_function_name}-logs"
  }
}

resource "aws_iam_role" "chat_stream" {
  name = "${var.project_name}-chat-stream${local.suffix}"

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
    Name = "${var.project_name}-chat-stream${local.suffix}"
  }
}

# Read-only, and only what a stream reads: the chat table, and the user row the
# shared JWT check (api/dependencies/auth.py) loads. The runtime secret holds the
# JWT key.
resource "aws_iam_role_policy" "chat_stream" {
  name = "${var.project_name}-chat-stream${local.suffix}"
  role = aws_iam_role.chat_stream.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.chat_stream.arn}:*"
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:Query"]
        Resource = [aws_dynamodb_table.chat.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem"]
        Resource = [aws_dynamodb_table.users_v2.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.runtime.arn
      },
    ]
  })
}

resource "aws_lambda_function" "chat_stream" {
  function_name = local.chat_stream_function_name
  role          = aws_iam_role.chat_stream.arn
  package_type  = "Image"
  image_uri     = "${var.ecr_repository_url}:${var.chat_stream_image_tag}"
  # The REST API's streaming ceiling. The app closes its stream at 840 s and the
  # phone resumes from its cursor; the minute between is the margin.
  timeout                        = 900
  memory_size                    = 512
  architectures                  = ["arm64"]
  reserved_concurrent_executions = var.chat_stream_reserved_concurrency

  # The entrypoint (uvicorn) and the adapter's settings are in the image.
  # WEB_APP_ORIGIN: the one browser origin whose requests get CORS headers back
  # from the app (task-474). Empty: none.
  environment {
    variables = merge(local.lambda_environment, { WEB_APP_ORIGIN = var.web_app_origin })
  }

  depends_on = [aws_cloudwatch_log_group.chat_stream]

  # image_uri is owned by deploy-lambda.yml (:chat-stream-<sha> by digest), like
  # the API's and the workers'.
  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name = local.chat_stream_function_name
  }
}

# -----------------------------------------------------------------------------
# REST API, regional, STREAM
# -----------------------------------------------------------------------------

resource "aws_api_gateway_rest_api" "chat_stream" {
  name = "${var.project_name}-chat-stream${local.suffix}"
  body = jsonencode(local.chat_stream_openapi)

  endpoint_configuration {
    # Regional, not edge-optimized: an edge endpoint closes a silent stream after
    # 30 seconds, a regional one after 5 minutes.
    types = ["REGIONAL"]
  }

  # One explicit route: nothing else of the app is reachable through this door.
  put_rest_api_mode = "overwrite"

  tags = {
    Name = "${var.project_name}-chat-stream${local.suffix}"
  }
}

resource "aws_api_gateway_deployment" "chat_stream" {
  rest_api_id = aws_api_gateway_rest_api.chat_stream.id

  triggers = {
    redeployment = sha1(jsonencode(local.chat_stream_openapi))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_cloudwatch_log_group" "chat_stream_access" {
  name              = "/aws/apigateway/${var.project_name}-chat-stream${local.suffix}"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-chat-stream${local.suffix}-access"
  }
}

# API Gateway writes REST access logs with an account-level role. One setting per
# account and region; dev and prod are separate accounts.
resource "aws_iam_role" "apigateway_cloudwatch" {
  name = "${var.project_name}-apigateway-cloudwatch${local.suffix}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "apigateway.amazonaws.com" }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "apigateway_cloudwatch" {
  role       = aws_iam_role.apigateway_cloudwatch.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = aws_iam_role.apigateway_cloudwatch.arn

  depends_on = [aws_iam_role_policy_attachment.apigateway_cloudwatch]
}

resource "aws_api_gateway_stage" "chat_stream" {
  rest_api_id   = aws_api_gateway_rest_api.chat_stream.id
  deployment_id = aws_api_gateway_deployment.chat_stream.id
  stage_name    = local.chat_stream_stage_name

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.chat_stream_access.arn
    format = jsonencode({
      requestId          = "$context.requestId"
      ip                 = "$context.identity.sourceIp"
      requestTime        = "$context.requestTime"
      httpMethod         = "$context.httpMethod"
      resourcePath       = "$context.resourcePath"
      status             = "$context.status"
      responseLength     = "$context.responseLength"
      responseLatency    = "$context.responseLatency"
      integrationLatency = "$context.integration.latency"
      integrationStatus  = "$context.integration.status"
      errorMessage       = "$context.error.message"
      errorResponseType  = "$context.error.responseType"
    })
  }

  depends_on = [aws_api_gateway_account.main]

  tags = {
    Name = "${var.project_name}-chat-stream${local.suffix}-${local.chat_stream_stage_name}"
  }
}

resource "aws_api_gateway_method_settings" "chat_stream" {
  rest_api_id = aws_api_gateway_rest_api.chat_stream.id
  stage_name  = aws_api_gateway_stage.chat_stream.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled        = true
    throttling_rate_limit  = var.chat_stream_throttle_rate
    throttling_burst_limit = var.chat_stream_throttle_burst
  }
}

resource "aws_lambda_permission" "chat_stream" {
  statement_id  = "AllowChatStreamRestApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat_stream.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.chat_stream.execution_arn}/*/GET/chat/conversations/*/stream"
}

output "chat_stream_url" {
  description = "Base URL of the chat stream (task-464): GET <url>/chat/conversations/{id}/stream. The mobile reads it as a public variable."
  value       = aws_api_gateway_stage.chat_stream.invoke_url
}

# -----------------------------------------------------------------------------
# Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "chat_stream_lambda_errors" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-chat-stream-errors${local.suffix}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  alarm_description   = "The chat stream Lambda raised. Read its log group. Runbook: infrastructure/observability/runbooks/pipeline-alerts.md#chat-stream"
  alarm_actions       = [aws_sns_topic.pipeline_alerts[0].arn]
  treat_missing_data  = "notBreaching"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  dimensions          = { FunctionName = aws_lambda_function.chat_stream.function_name }

  tags = { Severity = "medium" }
}

resource "aws_cloudwatch_metric_alarm" "chat_stream_lambda_throttles" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-chat-stream-throttles${local.suffix}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  alarm_description   = "Chat streams were refused for lack of concurrency: the connection budget (chat_stream_reserved_concurrency) is spent. Runbook: infrastructure/observability/runbooks/pipeline-alerts.md#chat-stream"
  alarm_actions       = [aws_sns_topic.pipeline_alerts[0].arn]
  treat_missing_data  = "notBreaching"
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  dimensions          = { FunctionName = aws_lambda_function.chat_stream.function_name }

  tags = { Severity = "high" }
}

resource "aws_cloudwatch_metric_alarm" "chat_stream_5xx" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-chat-stream-5xx${local.suffix}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  alarm_description   = "The chat stream stage answered 5xx. Read its access log group. Runbook: infrastructure/observability/runbooks/pipeline-alerts.md#chat-stream"
  alarm_actions       = [aws_sns_topic.pipeline_alerts[0].arn]
  treat_missing_data  = "notBreaching"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  dimensions = {
    ApiName = aws_api_gateway_rest_api.chat_stream.name
    Stage   = aws_api_gateway_stage.chat_stream.stage_name
  }

  tags = { Severity = "medium" }
}

# Latency of a stream is its whole duration, so the stage's Latency metric says
# nothing useful here; the time to the response headers does. IntegrationLatency
# on a STREAM integration is measured to the first byte from Lambda: above 5 s at
# p90, opening a stream (auth, two reads) has become slow.
resource "aws_cloudwatch_metric_alarm" "chat_stream_open_latency" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-chat-stream-open-latency${local.suffix}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 5000
  alarm_description   = "Opening a chat stream takes more than 5 s at p90 (IntegrationLatency). Cold starts or slow DynamoDB reads. Runbook: infrastructure/observability/runbooks/pipeline-alerts.md#chat-stream"
  alarm_actions       = [aws_sns_topic.pipeline_alerts[0].arn]
  treat_missing_data  = "notBreaching"
  metric_name         = "IntegrationLatency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  extended_statistic  = "p90"
  dimensions = {
    ApiName = aws_api_gateway_rest_api.chat_stream.name
    Stage   = aws_api_gateway_stage.chat_stream.stage_name
  }

  tags = { Severity = "low" }
}
