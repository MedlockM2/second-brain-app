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
