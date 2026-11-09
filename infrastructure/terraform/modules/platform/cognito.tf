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
  lambda_config {
    define_auth_challenge          = aws_lambda_function.apple_auth.arn
    create_auth_challenge          = aws_lambda_function.apple_auth.arn
    verify_auth_challenge_response = aws_lambda_function.apple_auth.arn
    pre_sign_up                    = aws_lambda_function.apple_auth.arn
  }
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
  # Native Apple subjects are admin-only. Cognito requires mutable custom
  # attributes on the destination of AdminLinkProviderForUser. Public clients cannot
  # assign themselves an Apple identity, including through SignUp.
  schema {
    name                = "apple_subject"
    attribute_data_type = "String"
    required            = false
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 255
    }
  }
  # Android Credential Manager users have no user-chosen password. Admin-only,
  # like apple_subject; never add this attribute to client write_attributes.
  schema {
    name                = "google_subject"
    attribute_data_type = "String"
    required            = false
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 255
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
# auth.<public_domain> when the environment has a domain (task-528), so the iOS
# session alert and Google's consent page show Deepn's domain. The prefix
# domain exists only for an environment without one; there is never both.
# Two resources rather than one with a conditional name: replacing a single
# domain resource in place ties its destroy into a dependency cycle with the
# certificate, CloudFront and the Lambdas. The certificate is the environment's
# us-east-1 one (modules/web_certificate), and Cognito refuses the custom domain
# until its parent -- the apex record in web_hosting.tf -- resolves.
moved {
  from = aws_cognito_user_pool_domain.users
  to   = aws_cognito_user_pool_domain.prefix[0]
}
resource "aws_cognito_user_pool_domain" "prefix" {
  count        = local.public_domain_enabled ? 0 : 1
  domain       = local.cognito_prefix
  user_pool_id = aws_cognito_user_pool.users.id
}
# Managed login (version 2), not the classic hosted UI: only managed login
# forwards `prompt=select_account` to Google, which lets a person pick another
# Google account after signing out of Deepn (task-528). Every flow skips its
# pages (identity_provider is always set), but a client created through the API
# still needs a branding style before managed login serves it. The resource for
# it only exists in AWS provider v6; until this repository moves to v6, the
# owner creates Cognito's default style once per client with the CLI
# (docs/PRODUCTION_RELEASE_RUNBOOK.md, "Domain bring-up (deepn.app)").
resource "aws_cognito_user_pool_domain" "custom" {
  count                 = local.public_domain_enabled ? 1 : 0
  domain                = local.auth_domain
  certificate_arn       = var.web_certificate_arn
  managed_login_version = 2
  user_pool_id          = aws_cognito_user_pool.users.id
  depends_on            = [aws_route53_record.apex]
}
resource "aws_route53_record" "auth" {
  for_each = local.public_domain_enabled ? toset(["A", "AAAA"]) : toset([])
  zone_id  = var.public_zone_id
  name     = local.auth_domain
  type     = each.value
  alias {
    name                   = aws_cognito_user_pool_domain.custom[0].cloudfront_distribution
    zone_id                = aws_cognito_user_pool_domain.custom[0].cloudfront_distribution_zone_id
    evaluate_target_health = false
  }
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
  attribute_mapping = { email = "email", email_verified = "email_verified", username = "sub" }
  # Cognito supplies these endpoints for social providers. Keep credentials and
  # scopes managed while leaving service-owned discovery metadata alone.
  lifecycle {
    ignore_changes = [
      provider_details["attributes_url"],
      provider_details["attributes_url_add_attributes"],
      provider_details["authorize_url"],
      provider_details["oidc_issuer"],
      provider_details["token_request_method"],
      provider_details["token_url"],
    ]
  }
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
  attribute_mapping = { email = "email", email_verified = "email_verified", username = "sub" }
  lifecycle {
    ignore_changes = [
      provider_details["attributes_url_add_attributes"],
      provider_details["authorize_url"],
      provider_details["oidc_issuer"],
      provider_details["token_request_method"],
      provider_details["token_url"],
    ]
  }
  # AWS never returns private_key. Reapplying that write-only field is expected;
  # do not ignore it, or a key rotation in Secrets Manager would be discarded.
}
locals {
  # Not read from the domain resource: it waits for the web records, which wait
  # (through CloudFront and the chat stream) for the Lambda environment below.
  cognito_prefix          = "deepn-${data.aws_caller_identity.current.account_id}${local.suffix}"
  cognito_domain          = local.public_domain_enabled ? "https://${local.auth_domain}" : "https://${local.cognito_prefix}.auth.${var.aws_region}.amazoncognito.com"
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
  explicit_auth_flows                  = concat(["ALLOW_USER_PASSWORD_AUTH"], each.key == "mobile" ? ["ALLOW_CUSTOM_AUTH"] : [])
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
# restricted to the single pool. Native Apple provisioning has a separate policy.
resource "aws_iam_role_policy" "cognito_api" {
  name = "cognito-users${local.suffix}"
  role = aws_iam_role.lambda_api.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Action = ["cognito-idp:AdminGetUser", "cognito-idp:AdminDeleteUser", "cognito-idp:ListUsers",
    "cognito-idp:AdminLinkProviderForUser"],
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
