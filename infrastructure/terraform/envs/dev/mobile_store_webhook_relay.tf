# Mobile beta webhook relay (TASK-635).
#
# EAS (BUILD, SUBMIT) and App Store Connect (BUILD_UPLOAD_STATE_UPDATED,
# BUILD_BETA_DETAIL_EXTERNAL_BUILD_STATE_UPDATED) post here when a beta can move
# forward. The function checks the signature, then starts mobile-beta-distribute.yml
# through GitHub's workflow_dispatch API for the platform concerned. This replaces
# the 30-minute poll of that workflow, which now runs once a day as a safety net.
#
# Dev root only: the beta CI is a property of the repository, not of an
# environment, and nothing in staging or prod should call GitHub.
#
# Entry point is an HTTP API rather than a Lambda function URL: a public function
# URL now needs a lambda:InvokeFunction grant to everyone, which the pinned AWS
# provider (~> 5.0) cannot scope to the URL. The HTTP API also throttles, so a
# flood of unsigned requests costs at most a few rejected invocations per second.
#
# The secret holds three values, set out of band and never by Terraform:
#   {"github_token": "...", "eas_webhook_secret": "...", "asc_webhook_secret": "..."}
# mobile/MOBILE_CI_CD.md describes how to fill and rotate them.

locals {
  mobile_store_webhook_relay_name = "${local.gha_project_name}-mobile-store-webhook-relay-${local.gha_environment}"
}

resource "aws_secretsmanager_secret" "mobile_store_webhook_relay" {
  name        = local.mobile_store_webhook_relay_name
  description = "GitHub token and webhook secrets of the mobile store webhook relay (TASK-635). Value managed out of band."
}

# Empty initial version so the function can read the secret before the owner fills
# it; until then every request fails the signature check.
resource "aws_secretsmanager_secret_version" "mobile_store_webhook_relay" {
  secret_id     = aws_secretsmanager_secret.mobile_store_webhook_relay.id
  secret_string = jsonencode({})

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_cloudwatch_log_group" "mobile_store_webhook_relay" {
  name              = "/aws/lambda/${local.mobile_store_webhook_relay_name}"
  retention_in_days = 14
}

resource "aws_iam_role" "mobile_store_webhook_relay" {
  name = local.mobile_store_webhook_relay_name
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "lambda.amazonaws.com" }
  }] })
}

# Its own logs and its own secret, nothing else.
resource "aws_iam_role_policy" "mobile_store_webhook_relay" {
  role = aws_iam_role.mobile_store_webhook_relay.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = aws_secretsmanager_secret.mobile_store_webhook_relay.arn },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.mobile_store_webhook_relay.arn}:*" }
  ] })
}

data "archive_file" "mobile_store_webhook_relay" {
  type        = "zip"
  source_file = "${path.module}/../../../lambda/mobile_store_webhook_relay.py"
  output_path = "${path.module}/.build/mobile_store_webhook_relay.zip"
}

resource "aws_lambda_function" "mobile_store_webhook_relay" {
  function_name    = local.mobile_store_webhook_relay_name
  role             = aws_iam_role.mobile_store_webhook_relay.arn
  runtime          = "python3.12"
  handler          = "mobile_store_webhook_relay.handler"
  filename         = data.archive_file.mobile_store_webhook_relay.output_path
  source_code_hash = data.archive_file.mobile_store_webhook_relay.output_base64sha256
  timeout          = 15
  memory_size      = 128
  architectures    = ["arm64"]

  environment {
    variables = {
      RELAY_SECRET_ID      = aws_secretsmanager_secret.mobile_store_webhook_relay.arn
      GITHUB_REPOSITORY    = "MedlockM2/second-brain-app"
      GITHUB_WORKFLOW_FILE = "mobile-beta-distribute.yml"
      GITHUB_REF           = "main"
    }
  }

  depends_on = [aws_cloudwatch_log_group.mobile_store_webhook_relay]
}

resource "aws_apigatewayv2_api" "mobile_store_webhook_relay" {
  name          = local.mobile_store_webhook_relay_name
  protocol_type = "HTTP"
  description   = "EAS and App Store Connect webhooks for the mobile beta distribution (TASK-635)"
}

resource "aws_apigatewayv2_integration" "mobile_store_webhook_relay" {
  api_id                 = aws_apigatewayv2_api.mobile_store_webhook_relay.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.mobile_store_webhook_relay.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "mobile_store_webhook_relay" {
  api_id    = aws_apigatewayv2_api.mobile_store_webhook_relay.id
  route_key = "POST /webhook"
  target    = "integrations/${aws_apigatewayv2_integration.mobile_store_webhook_relay.id}"
}

# A few builds a day: the limits only bound what an unsigned flood can cost.
resource "aws_apigatewayv2_stage" "mobile_store_webhook_relay" {
  api_id      = aws_apigatewayv2_api.mobile_store_webhook_relay.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = 2
    throttling_burst_limit = 5
  }
}

resource "aws_lambda_permission" "mobile_store_webhook_relay" {
  statement_id  = "AllowMobileStoreWebhookRelayHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mobile_store_webhook_relay.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.mobile_store_webhook_relay.execution_arn}/*/*/webhook"
}

output "mobile_store_webhook_relay_url" {
  description = "URL to register as the EAS and App Store Connect webhook (TASK-635)."
  value       = "${aws_apigatewayv2_stage.mobile_store_webhook_relay.invoke_url}webhook"
}

output "mobile_store_webhook_relay_secret_name" {
  description = "Secrets Manager secret holding the relay's GitHub token and webhook secrets."
  value       = aws_secretsmanager_secret.mobile_store_webhook_relay.name
}
