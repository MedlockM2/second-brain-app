#!/usr/bin/env bash
# Shared helpers for .github/workflows/deploy-lambda.yml (dev jobs). Source it:
#
#   source .github/scripts/lib/lambda-deploy.sh
#
# Expects AWS credentials and AWS_DEFAULT_REGION in the environment.

# existing_image_digest REPOSITORY TAG
#
# Prints the digest of REPOSITORY:TAG if that tag is already in ECR, nothing
# otherwise. A rerun of a deploy whose image was already pushed must reuse it:
# the repository is IMMUTABLE_WITH_EXCLUSION (only *-latest may move), so pushing
# <kind>-<sha> a second time is refused and the rerun could never finish.
#
# batch-get-image rather than describe-images because the dev deploy role holds
# ecr:BatchGetImage (it pulls) and not ecr:DescribeImages. The accepted media
# types make ECR return the manifest as stored, so the digest is the one the
# build pushed and the one Lambda resolves -- not a down-converted schema-1 copy.
existing_image_digest() {
  local repository="$1" tag="$2" digest
  digest=$(aws ecr batch-get-image \
    --repository-name "$repository" \
    --image-ids "imageTag=${tag}" \
    --accepted-media-types \
      application/vnd.docker.distribution.manifest.v2+json \
      application/vnd.oci.image.manifest.v1+json \
      application/vnd.docker.distribution.manifest.list.v2+json \
      application/vnd.oci.image.index.v1+json \
    --query 'images[0].imageId.imageDigest' \
    --output text) || return 1
  if [ -n "$digest" ] && [ "$digest" != "None" ]; then
    echo "$digest"
  fi
}

# update_function_image FUNCTION IMAGE_URI
#
# Points FUNCTION at IMAGE_URI and waits until the update has landed, returning
# non-zero only if it never could.
#
# Why the wait and the retry: Terraform Dev and this workflow are triggered by the
# same push whenever it touches both infrastructure/terraform/** and backend code,
# and they run in separate concurrency groups. While Terraform is updating a
# function's configuration (env vars, memory, timeout), Lambda rejects
# update-function-code with ResourceConflictException. On 2026-11-08 that killed
# the workers' loop midway and left 5 of 19 functions on the previous image with
# the new environment. So: wait for any in-flight update to finish first, and if
# another one slips in between the wait and the call, wait again and retry.
#
# Waiting on the function itself rather than ordering this workflow after
# Terraform Dev: the conflict is per function and short-lived, the wait covers
# every source of it (a manual apply from the owner's machine as well as the CI
# one), and it keeps the two workflows independent.
update_function_image() {
  local function_name="$1" image_uri="$2"
  local attempt max_attempts=10 output state update
  for attempt in $(seq 1 "$max_attempts"); do
    # function-updated-v2 returns once LastUpdateStatus is no longer InProgress.
    # It errors out if the previous update had Failed; that is not our concern
    # here -- the update-function-code below is what replaces it.
    aws lambda wait function-updated-v2 --function-name "$function_name" || true
    if output=$(aws lambda update-function-code \
        --function-name "$function_name" \
        --image-uri "$image_uri" \
        --no-cli-pager 2>&1 >/dev/null); then
      break
    fi
    if ! grep -q ResourceConflictException <<<"$output"; then
      echo "$function_name: update-function-code failed: $output" >&2
      return 1
    fi
    if [ "$attempt" -eq "$max_attempts" ]; then
      echo "$function_name: still conflicting after $max_attempts attempts: $output" >&2
      return 1
    fi
    echo "$function_name: an update is in progress (attempt $attempt/$max_attempts), retrying"
    sleep $((attempt * 5))
  done
  aws lambda wait function-updated-v2 --function-name "$function_name" || true
  state=$(aws lambda get-function-configuration --function-name "$function_name" --query State --output text)
  update=$(aws lambda get-function-configuration --function-name "$function_name" --query LastUpdateStatus --output text)
  if [ "$state" != "Active" ] || [ "$update" != "Successful" ]; then
    echo "$function_name: State=$state LastUpdateStatus=$update after deploying $image_uri" >&2
    return 1
  fi
  echo "$function_name -> $image_uri"
}
