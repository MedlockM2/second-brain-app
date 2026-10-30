#!/usr/bin/env bash
# publish_legal_site.sh — Render the static pages and publish them on the www distribution.
#
# Renders docs/compliance/privacy-policy.md with scripts/build_legal_site.py,
# uploads the result to the www bucket of the environment and invalidates the
# CloudFront cache, so the public page matches the Markdown in the repository.
# Bucket and distribution are read from the environment's Terraform outputs
# (infrastructure/terraform/modules/platform/www.tf).
#
# Prerequisites:
#   - uv, AWS CLI v2, terraform (the environment root already initialised)
#   - The environment's credentials: AWS_PROFILE=prod for prod (README of
#     infrastructure/terraform, "Two accounts, one set of keys")
#
# Usage:
#   ./scripts/publish_legal_site.sh <dev|prod>
#
# Example:
#   AWS_PROFILE=prod ./scripts/publish_legal_site.sh prod

set -euo pipefail

ENV="${1:-}"
if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "usage: $0 <dev|prod>" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$REPO_ROOT/infrastructure/terraform/envs/$ENV"
OUT_DIR="$(mktemp -d)"
trap 'rm -rf "$OUT_DIR"' EXIT

BUCKET="$(terraform -chdir="$TF_DIR" output -raw www_bucket_name)"
DISTRIBUTION="$(terraform -chdir="$TF_DIR" output -raw www_distribution_id)"
BASE_URL="$(terraform -chdir="$TF_DIR" output -raw www_base_url)"

uv run --no-project --with markdown==3.7 python "$REPO_ROOT/scripts/build_legal_site.py" "$OUT_DIR"

# One object per page, without extension: the URL is /privacy, not /privacy.html.
for page in "$OUT_DIR"/*; do
  aws s3 cp "$page" "s3://$BUCKET/$(basename "$page")" \
    --region eu-west-3 \
    --content-type "text/html; charset=utf-8" \
    --cache-control "max-age=300"
done

aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" \
  --query 'Invalidation.Id' --output text

echo "Published: $BASE_URL/privacy"
echo "Account deletion (Play Console): $BASE_URL/privacy#delete-account"
