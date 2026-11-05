# CloudFront viewer certificates must be requested in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = { Project = "media-summarizer", Environment = "dev", ManagedBy = "terraform" }
  }
}

variable "web_public_domain" {
  description = "Owner's domain; empty keeps existing hosting unchanged."
  type        = string
  default     = ""
}
variable "web_public_zone_id" {
  description = "Route 53 zone in this environment's account; paired with web_public_domain."
  type        = string
  default     = ""
}
variable "web_connect_origins" {
  type    = list(string)
  default = []
}
module "web_certificate" {
  source    = "../../modules/web_certificate"
  providers = { aws = aws.us_east_1 }
  domain    = var.web_public_domain
  zone_id   = var.web_public_zone_id
}
