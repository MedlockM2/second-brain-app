#!/usr/bin/env python3
"""Run Terraform with the existing Cognito provider credentials kept in AWS.

Usage: AWS_PROFILE=second-brain-app python3 scripts/terraform_with_cognito.py dev plan -out=tfplan

Only the six provider settings enter the Terraform environment. The complete
runtime secret is never passed to Terraform, written to a file or printed.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


class ConfigurationError(Exception):
    """Safe, value-free configuration error suitable for CI logs."""


def provider_environment(environment: str) -> dict[str, str]:
    secret_name = f"media-summarizer-runtime-{environment}"
    result = subprocess.run(
        ["aws", "--region", "eu-west-3", "secretsmanager", "get-secret-value",
         "--secret-id", secret_name, "--query", "SecretString", "--output", "text"],
        capture_output=True, text=True, check=False,
    )
    if result.returncode:
        # The AWS error can contain request metadata or account identity. The
        # operator can inspect IAM/session access separately; never echo payloads.
        raise ConfigurationError(f"Cannot read {secret_name}; check AWS_PROFILE, session and Secrets Manager permissions")
    try:
        source = json.loads(result.stdout)
    except (ValueError, TypeError):
        raise ConfigurationError(f"{secret_name} must contain a JSON object") from None
    if not isinstance(source, dict):
        raise ConfigurationError(f"{secret_name} must contain a JSON object")
    fields = {
        "cognito_google": {"client_id": "GOOGLE_CLIENT_ID", "client_secret": "GOOGLE_CLIENT_SECRET"},
        "cognito_apple": {"client_id": "APPLE_CLIENT_ID", "team_id": "APPLE_TEAM_ID",
                          "key_id": "APPLE_KEY_ID", "private_key": "APPLE_PRIVATE_KEY"},
    }
    variables: dict[str, str] = {}
    for variable, mapping in fields.items():
        provider: dict[str, str] = {}
        for field, key in mapping.items():
            value = source.get(key)
            if not isinstance(value, str) or not value.strip():
                raise ConfigurationError(f"{secret_name} is missing {key}")
            provider[field] = value.strip()
        if variable == "cognito_apple":
            provider["private_key"] = provider["private_key"].replace("\\n", "\n")
            if not provider["private_key"].startswith("-----BEGIN PRIVATE KEY-----"):
                raise ConfigurationError("APPLE_PRIVATE_KEY must be an unquoted PEM private key")
        variables[f"TF_VAR_{variable}"] = json.dumps(provider)
    return variables


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("environment", choices=("dev", "staging", "prod"))
    parser.add_argument("terraform_args", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if not args.terraform_args or args.terraform_args[0] not in {"plan", "apply", "import"}:
        parser.error("provide a Terraform plan, apply or import command after the environment")
    try:
        variables = provider_environment(args.environment)
    except (ConfigurationError, OSError) as exc:
        print(f"Cognito configuration unavailable: {exc}", file=sys.stderr)
        return 1
    child_environment = os.environ.copy()
    # Terraform debug logging can expose provider configuration, including keys.
    child_environment.pop("TF_LOG", None)
    child_environment.pop("TF_LOG_PATH", None)
    child_environment.update(variables)
    root = Path(__file__).resolve().parents[1] / "infrastructure" / "terraform" / "envs" / args.environment
    os.execvpe("terraform", ["terraform", f"-chdir={root}", *args.terraform_args], child_environment)
    return 1


if __name__ == "__main__":
    sys.exit(main())
