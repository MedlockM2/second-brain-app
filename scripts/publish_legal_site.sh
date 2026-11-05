#!/usr/bin/env bash
# Owner-only publication of the existing public www site, not the web SPA.
# Usage: AWS_PROFILE=<chosen-profile> ./scripts/publish_legal_site.sh <dev|prod> [public-config.json]
set -euo pipefail

SITE_ENV="${1:-}"
PUBLIC_SITE_CONFIG="${2:-}"
if [[ "$SITE_ENV" != "dev" && "$SITE_ENV" != "prod" ]] || [[ "$#" -gt 2 ]]; then
  echo "usage: $0 <dev|prod> [public-config.json]" >&2
  exit 2
fi
if [[ -n "$PUBLIC_SITE_CONFIG" && ! -f "$PUBLIC_SITE_CONFIG" ]]; then
  echo "Public configuration file does not exist." >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$REPO_ROOT/infrastructure/terraform/envs/$SITE_ENV"
OUT_DIR="$(mktemp -d)"
trap 'rm -rf "$OUT_DIR"' EXIT

BUCKET="$(terraform -chdir="$TF_DIR" output -raw www_bucket_name)"
DISTRIBUTION="$(terraform -chdir="$TF_DIR" output -raw www_distribution_id)"
BASE_URL="$(terraform -chdir="$TF_DIR" output -raw www_base_url)"
SITE_ARGS=("$OUT_DIR" --site-url "$BASE_URL")
if [[ -n "$PUBLIC_SITE_CONFIG" ]]; then SITE_ARGS+=(--config "$PUBLIC_SITE_CONFIG"); fi
uv run --no-project --with markdown==3.7 python "$REPO_ROOT/scripts/build_legal_site.py" "${SITE_ARGS[@]}"

# The generator's allow-list supplies paths and correct MIME types, with the home
# page last. Extensionless privacy/extension are HTML; favicon is SVG. No --delete.
python3 - "$OUT_DIR/site-manifest.json" > "$OUT_DIR/publish-files.tsv" <<'PYFILES'
import json
import sys
with open(sys.argv[1]) as source:
    for path, mime in json.load(source)["files"].items():
        print(f"{path}\t{mime}")
PYFILES
while IFS=$'\t' read -r SITE_FILE SITE_TYPE; do
  aws s3 cp "$OUT_DIR/$SITE_FILE" "s3://$BUCKET/$SITE_FILE" \
    --region eu-west-3 --content-type "$SITE_TYPE" --cache-control "max-age=300"
done < "$OUT_DIR/publish-files.tsv"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" \
  --query 'Invalidation.Id' --output text

echo "Published: $BASE_URL/"
echo "Privacy: $BASE_URL/privacy"
echo "Account deletion (Play Console): $BASE_URL/privacy#delete-account"
