# =============================================================================
# www: the static pages (privacy policy), on S3 behind CloudFront
# =============================================================================
#
# The `www` half of task-471, built ahead of the domain (owner amendment of
# 2026-10-30 in docs/research/task-357-legal-pages-hosting/README.md): the
# pre-beta store review needs a public privacy policy URL, and no store rule
# requires an owned domain. Until task-443 buys one, the page is served on the
# distribution's default `*.cloudfront.net` name with CloudFront's own
# certificate. task-471 later adds the `www.<domaine>` alias, its us-east-1
# certificate and the Route 53 record to this same distribution, so the
# provisional URL keeps working after the switch.
#
# The bucket stays private: CloudFront reads it through Origin Access Control,
# and nothing else can. Content is uploaded by scripts/publish_legal_site.sh,
# not by Terraform -- the page is generated from docs/compliance/privacy-policy.md.

resource "aws_s3_bucket" "www" {
  bucket = "${var.project_name}-www-${data.aws_caller_identity.current.account_id}-${var.environment}"
  tags = {
    Name = "${var.project_name}-www${local.suffix}"
  }
}

resource "aws_s3_bucket_public_access_block" "www" {
  bucket = aws_s3_bucket.www.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "www" {
  bucket = aws_s3_bucket.www.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "www" {
  bucket = aws_s3_bucket.www.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "www" {
  name                              = "${var.project_name}-www${local.suffix}"
  description                       = "CloudFront read access to the www bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "www" {
  name = "${var.project_name}-www${local.suffix}"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    # The pages carry one inline <style> block and no script.
    content_security_policy {
      content_security_policy = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
      override                = true
    }
  }
}

# AWS managed "CachingOptimized" policy. A page update is made visible by the
# invalidation scripts/publish_legal_site.sh issues after its upload.
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

resource "aws_cloudfront_distribution" "www" {
  enabled         = true
  comment         = "${var.project_name}-www${local.suffix}"
  is_ipv6_enabled = true
  http_version    = "http2and3"
  price_class     = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.www.bucket_regional_domain_name
    origin_id                = "www-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.www.id
  }

  default_cache_behavior {
    target_origin_id           = "www-s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.www.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.project_name}-www${local.suffix}"
  }
}

data "aws_iam_policy_document" "www_bucket" {
  statement {
    sid       = "CloudFrontReadOnly"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.www.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.www.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "www" {
  bucket = aws_s3_bucket.www.id
  policy = data.aws_iam_policy_document.www_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.www]
}

output "www_bucket_name" {
  description = "Bucket holding the static pages served by the www distribution."
  value       = aws_s3_bucket.www.bucket
}

output "www_distribution_id" {
  description = "CloudFront distribution of the static pages (invalidated after each upload)."
  value       = aws_cloudfront_distribution.www.id
}

output "www_base_url" {
  description = "Public base URL of the static pages until task-471 adds the www.<domaine> alias."
  value       = "https://${aws_cloudfront_distribution.www.domain_name}"
}
