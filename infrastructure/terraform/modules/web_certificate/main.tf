# One us-east-1 certificate for every CloudFront-fronted name of an environment:
# app. and www. (and the apex) on the two distributions, auth. on Cognito's
# managed-login distribution (task-528). api. is a regional API Gateway domain
# and takes its own eu-west-3 certificate in modules/platform/lambda_api.tf.
#
# The root supplies its us-east-1 AWS provider. Route 53 is global, so DNS
# validation uses that same account/provider without a second region alias here.
terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "domain" {
  type    = string
  default = ""
  validation {
    condition     = var.domain == "" || can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", var.domain))
    error_message = "domain must be empty or a bare lowercase DNS domain, without wildcard, scheme or path."
  }
  validation {
    condition     = (var.domain == "") == (var.zone_id == "")
    error_message = "domain and zone_id must be supplied together, or both left empty."
  }
}

variable "zone_id" {
  type    = string
  default = ""
}

resource "aws_acm_certificate" "web" {
  count                     = var.domain == "" ? 0 : 1
  domain_name               = "app.${var.domain}"
  subject_alternative_names = [var.domain, "www.${var.domain}", "auth.${var.domain}"]
  validation_method         = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "validation" {
  for_each = var.domain == "" ? {} : {
    for option in aws_acm_certificate.web[0].domain_validation_options : option.domain_name => option
  }
  zone_id = var.zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  records = [each.value.resource_record_value]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "web" {
  count                   = var.domain == "" ? 0 : 1
  certificate_arn         = aws_acm_certificate.web[0].arn
  validation_record_fqdns = [for record in aws_route53_record.validation : record.fqdn]
}

output "certificate_arn" {
  value = try(aws_acm_certificate_validation.web[0].certificate_arn, "")
}
