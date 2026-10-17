# User authentication (task-526). Credentials for Google/Apple are supplied through
# sensitive Terraform variables, never committed. Terraform state must stay private.
variable "cognito_google" {
  type        = object({ client_id = string, client_secret = string })
  sensitive   = true
  default     = null
  description = "Google Web OAuth client registered with the Cognito /oauth2/idpresponse callback."
}
variable "cognito_apple" {
  type        = object({ client_id = string, team_id = string, key_id = string, private_key = string })
  sensitive   = true
  default     = null
  description = "Apple Services ID and Sign in with Apple signing key; configure the Cognito callback at Apple."
}

resource "aws_cognito_user_pool" "users" {
  name                     = "${local.prefix}-users"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  username_configuration { case_sensitive = false }
  email_configuration { email_sending_account = "COGNITO_DEFAULT" }
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 1
  }
  verification_message_template { default_email_option = "CONFIRM_WITH_CODE" }
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 3
      max_length = 320
    }
  }
  # Only AdminUpdateUserAttributes may attach a fixture. Clients cannot write it.
  schema {
    name                = "app_user_id"
    attribute_data_type = "String"
    required            = false
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 128
    }
  }
}
resource "aws_cognito_user_pool_domain" "users" {
  domain       = "deepn-${data.aws_caller_identity.current.account_id}${local.suffix}"
  user_pool_id = aws_cognito_user_pool.users.id
}
resource "aws_cognito_identity_provider" "google" {
  count         = nonsensitive(var.cognito_google != null) ? 1 : 0
  user_pool_id  = aws_cognito_user_pool.users.id
  provider_name = "Google"
  provider_type = "Google"
  provider_details = {
    client_id        = var.cognito_google.client_id
    client_secret    = var.cognito_google.client_secret
    authorize_scopes = "openid email profile"
  }
  attribute_mapping = { email = "email", email_verified = "email_verified" }
}
resource "aws_cognito_identity_provider" "apple" {
  count         = nonsensitive(var.cognito_apple != null) ? 1 : 0
  user_pool_id  = aws_cognito_user_pool.users.id
  provider_name = "SignInWithApple"
  provider_type = "SignInWithApple"
  provider_details = {
    client_id        = var.cognito_apple.client_id
    team_id          = var.cognito_apple.team_id
    key_id           = var.cognito_apple.key_id
    private_key      = var.cognito_apple.private_key
    authorize_scopes = "email name"
  }
  attribute_mapping = { email = "email", email_verified = "email_verified" }
}
locals {
  cognito_domain          = "https://${aws_cognito_user_pool_domain.users.domain}.auth.${var.aws_region}.amazoncognito.com"
  cognito_mobile_callback = "media-summarizer://auth-callback"
  cognito_clients = merge({ mobile = {
    callback = local.cognito_mobile_callback, refresh_days = 365
    } }, var.web_app_origin == "" ? {} : { web = {
    callback = "${var.web_app_origin}/auth/callback", refresh_days = 30
  } })
}
resource "aws_cognito_user_pool_client" "app" {
  for_each                             = local.cognito_clients
  name                                 = "deepn-${each.key}${local.suffix}"
  user_pool_id                         = aws_cognito_user_pool.users.id
  generate_secret                      = false
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  explicit_auth_flows                  = ["ALLOW_USER_PASSWORD_AUTH"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "aws.cognito.signin.user.admin"]
  supported_identity_providers = concat(["COGNITO"],
    aws_cognito_identity_provider.google[*].provider_name,
  aws_cognito_identity_provider.apple[*].provider_name)
  callback_urls          = [each.value.callback]
  logout_urls            = [each.value.callback]
  default_redirect_uri   = each.value.callback
  read_attributes        = ["email", "email_verified", "custom:app_user_id"]
  write_attributes       = ["email"]
  access_token_validity  = 15
  id_token_validity      = 15
  refresh_token_validity = each.value.refresh_days
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
  refresh_token_rotation {
    feature                    = "ENABLED"
    retry_grace_period_seconds = 60
  }
}
# GetUser is access-token authorized, not IAM. Administrative operations are
# restricted to the single pool; neither API nor stream can change passwords.
resource "aws_iam_role_policy" "cognito_api" {
  name = "cognito-users${local.suffix}"
  role = aws_iam_role.lambda_api.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect   = "Allow", Action = ["cognito-idp:AdminGetUser", "cognito-idp:AdminDeleteUser"],
    Resource = aws_cognito_user_pool.users.arn
  }] })
}
output "cognito_configuration" {
  value = {
    user_pool_id      = aws_cognito_user_pool.users.id
    domain            = local.cognito_domain
    mobile_client_id  = aws_cognito_user_pool_client.app["mobile"].id
    web_client_id     = try(aws_cognito_user_pool_client.app["web"].id, "")
    provider_callback = "${local.cognito_domain}/oauth2/idpresponse"
  }
}
