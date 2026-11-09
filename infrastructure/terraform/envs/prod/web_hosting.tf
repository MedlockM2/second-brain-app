# CloudFront viewer certificates must be requested in us-east-1.
provider "aws" {
  alias               = "us_east_1"
  region              = "us-east-1"
  allowed_account_ids = ["866874944541"]
  default_tags {
    tags = { Project = "media-summarizer", Environment = "prod", ManagedBy = "terraform" }
  }
}

# deepn.app is registered in this (prod) account, which holds its apex zone;
# the dev.deepn.app subtree is delegated to the dev account (task-443).
variable "public_domain" {
  description = "Base domain of this environment: apex, app., www., api. and auth. derive from it."
  type        = string
  default     = "deepn.app"
}
variable "public_zone_id" {
  description = "Route 53 zone of public_domain, in this environment's account."
  type        = string
  default     = "Z06224353E6BH49KWJWHJ"
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
