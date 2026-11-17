# CloudFront viewer certificates must be requested in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = { Project = "media-summarizer", Environment = "dev", ManagedBy = "terraform" }
  }
}

# deepn.app is registered in the prod account; dev.deepn.app is a zone of this
# (dev) account, delegated by an NS record in the prod zone (task-443).
variable "public_domain" {
  description = "Base domain of this environment: apex, app., www., api. and auth. derive from it."
  type        = string
  default     = "dev.deepn.app"
}
variable "public_zone_id" {
  description = "Route 53 zone of public_domain, in this environment's account."
  type        = string
  default     = "Z03725523GTB1KBX1FVIH"
}
variable "web_connect_origins" {
  type    = list(string)
  default = []
}
module "web_certificate" {
  source    = "../../modules/web_certificate"
  providers = { aws = aws.us_east_1 }
  domain    = var.public_domain
  zone_id   = var.public_zone_id
}

# www.deepn.app is the one public address of the legal pages (task-443). While prod
# sleeps, this dev distribution serves it next to www.dev.deepn.app, with a
# certificate of its own: adding the name to module.web_certificate would replace
# that certificate, and with it Cognito's custom domain. The name's zone is in the
# prod account, which this root cannot write, so two records there are owner
# records: the certificate's validation CNAME and www.deepn.app itself
# (docs/PRODUCTION_RELEASE_RUNBOOK.md, "Domain bring-up"). Remove the alias before
# prod's first apply: a CloudFront alternate name belongs to one distribution only.
variable "www_public_alias" {
  description = "Public name of the legal pages, served by dev's www distribution while prod sleeps."
  type        = string
  default     = "www.deepn.app"
}
resource "aws_acm_certificate" "www_public" {
  provider                  = aws.us_east_1
  domain_name               = var.www_public_alias
  subject_alternative_names = ["www.${var.public_domain}"]
  validation_method         = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}
# Waits until both names are validated: www.dev.deepn.app by the record that
# module.web_certificate already keeps in this account's zone (ACM asks the same
# record of a name across an account's certificates), www.deepn.app by the owner
# record in the prod zone.
resource "aws_acm_certificate_validation" "www_public" {
  provider        = aws.us_east_1
  certificate_arn = aws_acm_certificate.www_public.arn
}
