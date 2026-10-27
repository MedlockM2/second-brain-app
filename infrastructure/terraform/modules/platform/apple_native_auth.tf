# Native provider sign-in (tasks 527, 540). Provider proofs are validated by the API;
# this small trigger consumes one-use grants, links exact provider subjects and refuses
# a second account for an address (task-529). The table also holds link intents.
resource "aws_dynamodb_table" "apple_auth" {
  name         = "${var.project_name}-apple-auth${local.suffix}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  attribute {
    name = "pk"
    type = "S"
  }
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }
}
resource "aws_iam_role" "apple_auth" {
  name = "${var.project_name}-apple-auth${local.suffix}"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "lambda.amazonaws.com" }
  }] })
}
resource "aws_cloudwatch_log_group" "apple_auth" {
  name              = "/aws/lambda/${var.project_name}-apple-auth${local.suffix}"
  retention_in_days = 7
}
resource "aws_iam_role_policy" "apple_auth" {
  role = aws_iam_role.apple_auth.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:DeleteItem"], Resource = aws_dynamodb_table.apple_auth.arn },
    # Pre sign-up enforces one account per verified address (task-529): it lists the
    # holders of an address and deletes the unconfirmed sign-ups among them.
    { Effect = "Allow", Action = ["cognito-idp:AdminLinkProviderForUser", "cognito-idp:ListUsers", "cognito-idp:AdminDeleteUser"],
    Resource = aws_cognito_user_pool.users.arn },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"],
    Resource = "${aws_cloudwatch_log_group.apple_auth.arn}:*" }
  ] })
}
data "archive_file" "apple_auth" {
  type        = "zip"
  source_file = "${path.module}/../../../lambda/apple_auth.py"
  output_path = "${path.module}/.build/apple_auth${local.suffix}.zip"
}
resource "aws_lambda_function" "apple_auth" {
  function_name    = "${var.project_name}-apple-auth${local.suffix}"
  role             = aws_iam_role.apple_auth.arn
  runtime          = "python3.12"
  handler          = "apple_auth.handler"
  filename         = data.archive_file.apple_auth.output_path
  source_code_hash = data.archive_file.apple_auth.output_base64sha256
  timeout          = 5
  memory_size      = 128
  environment {
    variables = { APPLE_AUTH_TABLE = aws_dynamodb_table.apple_auth.name }
  }
  depends_on = [aws_cloudwatch_log_group.apple_auth]
}
resource "aws_lambda_permission" "apple_auth" {
  statement_id   = "CognitoAppleAuthentication"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.apple_auth.function_name
  principal      = "cognito-idp.amazonaws.com"
  source_arn     = aws_cognito_user_pool.users.arn
  source_account = data.aws_caller_identity.current.account_id
}
resource "aws_iam_role_policy" "apple_auth_api" {
  role = aws_iam_role.lambda_api.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"],
    Resource = aws_dynamodb_table.apple_auth.arn },
    { Effect = "Allow", Action = ["cognito-idp:AdminCreateUser", "cognito-idp:AdminSetUserPassword", "cognito-idp:AdminUpdateUserAttributes"],
    Resource = aws_cognito_user_pool.users.arn }
  ] })
}
