# =============================================================================
# Platform module inputs
# =============================================================================

variable "environment" {
  description = "Environment name. Drives local.suffix, which is appended to every physical resource name."
  type        = string

  # No default on purpose: an apply without an explicit environment used to
  # target the token "production", which no resource has ever used.
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod (note: 'prod', not 'production' — the Lambda name budget is 64 chars)."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-3"
}

variable "project_name" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "media-summarizer"
}

variable "web_app_origin" {
  description = "Origin of the web app allowed by the HTTP API's CORS, e.g. https://app.<domain>. Empty for no browser origin."
  type        = string

  # No default on purpose: every environment states which browser origin may
  # call it with the session cookie (task-473). Never "*": a cookie is not sent
  # to a wildcard origin, and a wildcard would hand the session to any site.
  validation {
    condition     = var.web_app_origin == "" || can(regex("^https?://[a-z0-9.-]+(:[0-9]+)?$", var.web_app_origin))
    error_message = "web_app_origin must be empty or a bare origin (scheme://host[:port], no path, no trailing slash, never \"*\")."
  }

  # A local dev server is a development origin only. Outside dev it would let any
  # page served on that port of a user's machine read the API's answers, and in
  # plain http: staging and prod name their https app origin or nothing.
  validation {
    condition     = var.environment == "dev" || !can(regex("^http://|://(localhost|127\\.0\\.0\\.1)(:|$)", var.web_app_origin))
    error_message = "web_app_origin may be http:// or localhost only in dev; staging and prod take https://app.<domain> or nothing."
  }
}

variable "enable_alarms" {
  description = "Provision CloudWatch alarms + SNS topics. Measured cost when on: ~$3.30/mo (43 alarms × $0.10 - free tier). Enable for an environment that is actually being watched."
  type        = bool
  default     = false
}

variable "enable_dashboard" {
  description = "Provision the CloudWatch dashboard. Billed per dashboard beyond the 3-dashboard free tier: measured at ~$3.00/mo, which is the single largest line item of an idle environment. Independent of enable_alarms on purpose — an environment can be worth a dashboard without being worth 43 alarms, and vice versa."
  type        = bool
  default     = true
}

variable "enable_worker_polling" {
  description = "Whether the SQS event source mappings are enabled. When false the mappings still exist but the workers stop long-polling their queues. An idle environment's 14 mappings bill ~$0.90/mo in Tier-1 SQS requests polling queues that are always empty. Set false to mothball an environment without destroying anything."
  type        = bool
  default     = true
}

variable "ecr_repository_url" {
  description = "URL of the shared Lambda ECR repository, owned by ../../shared and passed in from the environment root."
  type        = string
}

variable "processing_jobs_ttl_days" {
  description = "TTL window for processing_jobs table in days. Phase 4 (task-242): once nothing user-facing reads processing_jobs, the TTL is re-enabled to clean up stale job records. Recommend 90 days to preserve job debugging trails. Range: 30-90. Settable by the owner via -var processing_jobs_ttl_days=NN."
  type        = number
  default     = 90

  validation {
    condition     = var.processing_jobs_ttl_days >= 30 && var.processing_jobs_ttl_days <= 90
    error_message = "processing_jobs_ttl_days must be between 30 and 90 days."
  }
}
