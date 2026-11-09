# App hosting can use CloudFront's own hostname before a domain is purchased.
variable "web_app_hosting_enabled" {
  type    = bool
  default = false
}

# One base domain per environment (task-443): dev.deepn.app in the dev account,
# deepn.app in the prod account. The web app is served on the domain itself
# (owner decision of 2026-11-09, replacing app.<domain> of task-424); www. holds
# the static pages, api. the API, auth. Cognito. All live in this environment's
# own zone.
variable "public_domain" {
  description = "Base domain of this environment; empty keeps the AWS default hostnames."
  type        = string
  default     = ""
}
variable "public_zone_id" {
  description = "Route 53 zone of public_domain, in this environment's account."
  type        = string
  default     = ""
}
variable "web_certificate_arn" {
  type    = string
  default = ""
  validation {
    condition = var.public_domain == "" ? var.web_certificate_arn == "" : (
      var.public_zone_id != "" && can(regex("^arn:aws:acm:us-east-1:[0-9]{12}:certificate/", var.web_certificate_arn))
    )
    error_message = "A public domain requires its Route 53 zone and a validated ACM certificate in us-east-1."
  }
}
variable "web_connect_origins" {
  description = "Additional exact HTTPS origins used by the web release (no secrets, paths or wildcards)."
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for origin in var.web_connect_origins : can(regex("^https://[a-z0-9.-]+(:[0-9]+)?$", origin))])
    error_message = "web_connect_origins contains only exact HTTPS origins."
  }
}

locals {
  public_domain_enabled = var.public_domain != ""
  api_domain            = local.public_domain_enabled ? "api.${var.public_domain}" : ""
  auth_domain           = local.public_domain_enabled ? "auth.${var.public_domain}" : ""
  web_app_enabled       = var.web_app_hosting_enabled || local.public_domain_enabled
  web_connect_sources = distinct(concat([
    aws_apigatewayv2_api.main.api_endpoint,
    "https://${aws_api_gateway_rest_api.chat_stream.id}.execute-api.${var.aws_region}.amazonaws.com",
    "https://${aws_s3_bucket.documents.bucket_regional_domain_name}",
    "https://${aws_s3_bucket.audio.bucket_regional_domain_name}",
    "https://${aws_s3_bucket.bug_reports.bucket_regional_domain_name}",
    "https://${aws_s3_bucket.documents.bucket}.s3.amazonaws.com",
    "https://${aws_s3_bucket.audio.bucket}.s3.amazonaws.com",
    "https://${aws_s3_bucket.bug_reports.bucket}.s3.amazonaws.com",
  ], local.api_domain == "" ? [] : ["https://${local.api_domain}"], var.web_connect_origins))
}

resource "aws_s3_bucket" "app" {
  count  = local.web_app_enabled ? 1 : 0
  bucket = "${var.project_name}-app-${data.aws_caller_identity.current.account_id}-${var.environment}"
  tags   = { Name = "${var.project_name}-app${local.suffix}" }
}
resource "aws_s3_bucket_public_access_block" "app" {
  count                   = local.web_app_enabled ? 1 : 0
  bucket                  = aws_s3_bucket.app[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_ownership_controls" "app" {
  count  = local.web_app_enabled ? 1 : 0
  bucket = aws_s3_bucket.app[0].id
  rule { object_ownership = "BucketOwnerEnforced" }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "app" {
  count  = local.web_app_enabled ? 1 : 0
  bucket = aws_s3_bucket.app[0].id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_cloudfront_origin_access_control" "app" {
  count                             = local.web_app_enabled ? 1 : 0
  name                              = "${var.project_name}-app${local.suffix}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
resource "aws_cloudfront_cache_policy" "app" {
  count       = local.web_app_enabled ? 1 : 0
  name        = "${var.project_name}-app${local.suffix}"
  min_ttl     = 0
  default_ttl = 0
  max_ttl     = 31536000
  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
    cookies_config { cookie_behavior = "none" }
    headers_config { header_behavior = "none" }
    query_strings_config { query_string_behavior = "none" }
  }
}
resource "aws_cloudfront_response_headers_policy" "app" {
  count = local.web_app_enabled ? 1 : 0
  name  = "${var.project_name}-app${local.suffix}"
  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
    }
    content_type_options { override = true }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    content_security_policy {
      # React uses inline styles; covers come from publishers' HTTPS CDNs.
      content_security_policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' ${join(" ", local.web_connect_sources)}; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
      override                = true
    }
  }
}
data "aws_cloudfront_cache_policy" "app_api" {
  count = local.web_app_enabled ? 1 : 0
  name  = "Managed-CachingDisabled"
}

# Forwards Authorization, X-Session-Transport, cookies and query strings, but
# replaces Host with the API Gateway hostname required by that origin.
data "aws_cloudfront_origin_request_policy" "app_api" {
  count = local.web_app_enabled ? 1 : 0
  name  = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_function" "app_routes" {
  count   = local.web_app_enabled ? 1 : 0
  name    = "${var.project_name}-app-routes${local.suffix}"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      var filename = request.uri.split('/').pop();
      if (filename.indexOf('.') === -1) request.uri = '/index.html';
      return request;
    }
  JS
}

resource "aws_cloudfront_distribution" "app" {
  count = local.web_app_enabled ? 1 : 0
  # An alternate name belongs to one distribution at a time: when the apex moves
  # from www to the app (2026-11-09), www must release it first.
  depends_on          = [aws_cloudfront_distribution.www]
  enabled             = true
  comment             = "${var.project_name}-app${local.suffix}"
  aliases             = local.public_domain_enabled ? [var.public_domain] : []
  default_root_object = "index.html"
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_100"
  origin {
    domain_name              = aws_s3_bucket.app[0].bucket_regional_domain_name
    origin_id                = "app-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.app[0].id
  }
  origin {
    domain_name = trimprefix(aws_apigatewayv2_api.main.api_endpoint, "https://")
    origin_id   = "app-api"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  default_cache_behavior {
    target_origin_id           = "app-s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.app[0].id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.app[0].id
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.app_routes[0].arn
    }
  }
  dynamic "ordered_cache_behavior" {
    for_each = ["/api", "/api/*"]
    content {
      path_pattern             = ordered_cache_behavior.value
      target_origin_id         = "app-api"
      viewer_protocol_policy   = "https-only"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = data.aws_cloudfront_cache_policy.app_api[0].id
      origin_request_policy_id = data.aws_cloudfront_origin_request_policy.app_api[0].id
    }
  }
  # SPA rewriting is attached only to the S3 behavior above. API errors retain
  # their status/body, and error responses must not be cached between sessions.
  dynamic "custom_error_response" {
    for_each = toset([403, 404, 500, 502, 503, 504])
    content {
      error_code            = custom_error_response.value
      error_caching_min_ttl = 0
    }
  }
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate {
    cloudfront_default_certificate = !local.public_domain_enabled
    acm_certificate_arn            = local.public_domain_enabled ? var.web_certificate_arn : null
    ssl_support_method             = local.public_domain_enabled ? "sni-only" : null
    minimum_protocol_version       = local.public_domain_enabled ? "TLSv1.2_2021" : "TLSv1"
  }
  tags = { Name = "${var.project_name}-app${local.suffix}" }
}

data "aws_iam_policy_document" "app_bucket" {
  count = local.web_app_enabled ? 1 : 0
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.app[0].arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.app[0].arn]
    }
  }
}
resource "aws_s3_bucket_policy" "app" {
  count      = local.web_app_enabled ? 1 : 0
  bucket     = aws_s3_bucket.app[0].id
  policy     = data.aws_iam_policy_document.app_bucket[0].json
  depends_on = [aws_s3_bucket_public_access_block.app]
}

moved {
  from = aws_route53_record.web["www_a"]
  to   = aws_route53_record.www["A"]
}
moved {
  from = aws_route53_record.web["www_aaaa"]
  to   = aws_route53_record.www["AAAA"]
}
resource "aws_route53_record" "www" {
  for_each = local.public_domain_enabled ? toset(["A", "AAAA"]) : toset([])
  zone_id  = var.public_zone_id
  name     = "www.${var.public_domain}"
  type     = each.value
  alias {
    name                   = aws_cloudfront_distribution.www.domain_name
    zone_id                = aws_cloudfront_distribution.www.hosted_zone_id
    evaluate_target_health = false
  }
}
# The apex is the web app. Cognito also requires it -- the parent of
# auth.<domain> -- to resolve before it accepts the custom domain.
resource "aws_route53_record" "apex" {
  for_each = local.public_domain_enabled ? toset(["A", "AAAA"]) : toset([])
  zone_id  = var.public_zone_id
  name     = var.public_domain
  type     = each.value
  alias {
    name                   = aws_cloudfront_distribution.app[0].domain_name
    zone_id                = aws_cloudfront_distribution.app[0].hosted_zone_id
    evaluate_target_health = false
  }
}
output "app_bucket_name" { value = try(aws_s3_bucket.app[0].bucket, null) }
output "app_distribution_id" { value = try(aws_cloudfront_distribution.app[0].id, null) }
output "app_bucket_arn" { value = try(aws_s3_bucket.app[0].arn, null) }
output "app_distribution_arn" { value = try(aws_cloudfront_distribution.app[0].arn, null) }
output "app_base_url" {
  value = local.web_app_enabled ? (local.public_domain_enabled ? "https://${var.public_domain}" : "https://${aws_cloudfront_distribution.app[0].domain_name}") : null
}
