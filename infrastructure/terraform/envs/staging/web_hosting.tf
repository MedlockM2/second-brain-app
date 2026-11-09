# CloudFront viewer certificates must be requested in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = { Project = "media-summarizer", Environment = "staging", ManagedBy = "terraform" }
  }
}

variable "public_domain" {
  description = "Owner's domain; empty keeps existing hosting unchanged."
  type        = string
  default     = ""
}
variable "public_zone_id" {
  description = "Route 53 zone in this environment's account; paired with public_domain."
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
  domain    = var.public_domain
  zone_id   = var.public_zone_id
}
