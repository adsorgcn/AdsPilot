#!/usr/bin/env python3
"""Merge service OpenAPI 3 specs into a unified gateway spec (OpenAPI 3)."""

import argparse
import copy
import os
import re
import sys
from typing import Dict, List, Tuple

import yaml


HTTP_METHODS = {"get", "put", "post", "delete", "patch", "options", "head"}


def parse_service_arg(entry: str) -> Tuple[str, str, str]:
    try:
        spec_path, service_name, service_url = entry.split("::", 2)
    except ValueError as exc:
        raise ValueError(f"Invalid --service entry '{entry}', expected format '<spec>::<name>::<url>'") from exc
    return spec_path, service_name, service_url


def combine_paths(base: str, path: str) -> str:
    base = base or ""
    path = path or ""
    if base.startswith("http://") or base.startswith("https://"):
        # Only keep sub-path part if server URL is absolute
        base = "/" + base.split("//", 1)[-1].split("/", 1)[-1]
    if not base.startswith("/"):
        base = "/" + base
    if base != "/" and base.endswith("/"):
        base = base[:-1]
    if path.startswith("/"):
        joined = base + path
    else:
        joined = base + "/" + path
    if not joined.startswith("/"):
        joined = "/" + joined
    # Collapse duplicate slashes (but keep double // after scheme removal already handled)
    while "//" in joined:
        joined = joined.replace("//", "/")
    if joined != "/" and joined.endswith("/"):
        joined = joined[:-1]
    return joined


def ensure_nested_dict(target: Dict, key: str) -> Dict:
    if key not in target or target[key] is None:
        target[key] = {}
    return target[key]


def merge_components(target: Dict, source: Dict) -> None:
    if not source:
        return
    for section, value in source.items():
        if not value:
            continue
        if section not in target or target[section] is None:
            target[section] = copy.deepcopy(value)
            continue
        if isinstance(value, dict):
            dest = ensure_nested_dict(target, section)
            for key, sub_value in value.items():
                dest[key] = copy.deepcopy(sub_value)
        elif isinstance(value, list):
            dest_list = target.setdefault(section, [])
            for item in value:
                if item not in dest_list:
                    dest_list.append(copy.deepcopy(item))
        else:
            target[section] = copy.deepcopy(value)


def should_keep_security(value, default_security):
    if not default_security:
        return True
    if value is None:
        return False
    if isinstance(value, list):
        if len(value) == 0:
            return True
        if all((not isinstance(item, dict)) or len(item) == 0 for item in value):
            return True
    return False


def generate_operation_id(service_name: str, method: str, path: str) -> str:
    tokens = [service_name.title()]
    tokens.append(method.capitalize())
    for segment in path.strip("/").split("/"):
        if not segment:
            continue
        if segment in {"*", "**"}:
            tokens.append("All")
            continue
        cleaned = re.sub(r"[^0-9A-Za-z]+", " ", segment.replace("{", "").replace("}", ""))
        cleaned = cleaned.strip()
        if not cleaned:
            continue
        tokens.append("".join(word.capitalize() for word in cleaned.split()))
    return "".join(tokens)


def add_operation_defaults(operation: Dict, backend_url: str, default_security: List[Dict[str, List]], service_name: str, path: str, method: str) -> None:
    operation.setdefault("x-google-backend", {
        "address": backend_url,
        "path_translation": "APPEND_PATH_TO_ADDRESS",
    })
    if default_security:
        sec = operation.get("security")
        if not should_keep_security(sec, default_security):
            operation["security"] = default_security
    if not operation.get("operationId"):
        operation["operationId"] = generate_operation_id(service_name, method, path)


def merge_path(doc_paths: Dict, path: str, path_item: Dict, backend_url: str, default_security: List[Dict[str, List]], service_name: str) -> None:
    target = doc_paths.setdefault(path, {})

    # Copy path-level extensions and params
    for key, value in path_item.items():
        if key in HTTP_METHODS:
            continue
        if key == "parameters":
            target[key] = copy.deepcopy(value)
        elif key == "security":
            if default_security and not should_keep_security(value, default_security):
                target[key] = copy.deepcopy(default_security)
            else:
                target[key] = copy.deepcopy(value)
        elif key.startswith("x-"):
            target[key] = copy.deepcopy(value)

    for method, details in path_item.items():
        method_lower = method.lower()
        if method_lower not in HTTP_METHODS:
            continue
        cloned = copy.deepcopy(details)
        add_operation_defaults(cloned, backend_url, default_security, service_name, path, method_lower)
        target[method_lower] = cloned


def add_health_endpoint(doc_paths: Dict, path: str, backend_url: str, operation_id: str, description: str, secured: bool) -> None:
    operation = {
        "operationId": operation_id,
        "responses": {
            "200": {"description": description},
        },
        "x-google-backend": {
            "address": backend_url,
            "path_translation": "CONSTANT_ADDRESS",
        },
    }
    if not secured:
        operation["security"] = []
    doc_paths[path] = {
        "get": operation,
    }


def build_base_document(project_id: str) -> Dict:
    firebase_security = {
        "type": "oauth2",
        "flows": {
            "implicit": {
        "authorizationUrl": "https://auth.firebase.google.com/authorize",
                "scopes": {},
            },
        },
        "x-google-issuer": f"https://securetoken.google.com/{project_id}",
        "x-google-jwks_uri": "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
        "x-google-audiences": project_id,
    }

    return_doc = {
        "openapi": "3.0.3",
        "info": {
            "title": "Google-Monetize API Gateway",
            "version": "1.0.0",
            "description": "Unified API Gateway for Google-Monetize microservices",
        },
        "paths": {},
        "components": {
            "schemas": {},
            "parameters": {},
            "responses": {},
            "requestBodies": {},
            "securitySchemes": {
                "firebase": firebase_security,
            },
        },
        "security": [{"firebase": []}],
        "x-google-management": {
            "cors": {
                "allowOrigins": [
                    "https://www.urlchecker.dev",
                    "https://www.autoads.dev",
                    "http://localhost:3000",
                    "http://localhost:3001",
                ],
                "allowMethods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allowHeaders": [
                    "Authorization",
                    "Content-Type",
                    "X-Requested-With",
                    "X-Firebase-ID-Token",
                    "Accept",
                    "Origin",
                ],
                "exposeHeaders": [
                    "X-RateLimit-Limit",
                    "X-RateLimit-Remaining",
                    "X-RateLimit-Reset",
                    "Content-Length",
                    "Content-Type",
                ],
                "maxAge": 3600,
                "allowCredentials": True,
            },
        },
        "x-google-endpoints": [
            {
                "name": f"gm-gateway.endpoints.{project_id}.cloud.goog",
                "allowCors": True,
            }
        ],
        "tags": [],
    }

    return return_doc


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description="Merge service OpenAPI specs into gateway spec")
    parser.add_argument("--output", required=True, help="Path to write merged OpenAPI 3 spec")
    parser.add_argument("--project", required=True, help="GCP project id")
    parser.add_argument("--service", action="append", default=[], help="Service entry: <spec>::<name>::<url>")
    parser.add_argument("--default-security", action="store_true", default=True)
    parser.add_argument("--gateway-middleware-url", help="Use Gateway Middleware as unified backend (URL of gateway-middleware service)")

    args = parser.parse_args(argv)

    default_security = [{"firebase": []}] if args.default_security else []

    doc = build_base_document(args.project)

    service_urls: Dict[str, str] = {}

    # Determine backend URL strategy
    use_gateway_middleware = bool(args.gateway_middleware_url)
    if use_gateway_middleware:
        print(f"ℹ️  Using Gateway Middleware as unified backend: {args.gateway_middleware_url}", file=sys.stderr)

    for entry in args.service:
        spec_path, service_name, service_url = parse_service_arg(entry)
        if not service_url:
            continue
        service_urls[service_name] = service_url
        if not os.path.exists(spec_path):
            print(f"⚠️  Spec '{spec_path}' not found, skipping", file=sys.stderr)
            continue
        with open(spec_path, "r", encoding="utf-8") as handle:
            spec = yaml.safe_load(handle)
        if not spec:
            continue

        servers = spec.get("servers") or []
        base_path = "/"
        if servers:
            base_path = servers[0].get("url", "/") or "/"

        paths = spec.get("paths") or {}
        for raw_path, path_item in paths.items():
            normalized_path = combine_paths(base_path, raw_path)
            # Use gateway-middleware URL if specified, otherwise use direct service URL
            backend_url = args.gateway_middleware_url if use_gateway_middleware else service_url
            merge_path(doc["paths"], normalized_path, path_item, backend_url, default_security, service_name)

        merge_components(doc["components"], spec.get("components"))

        tags = spec.get("tags") or []
        for tag in tags:
            if tag not in doc["tags"]:
                doc["tags"].append(copy.deepcopy(tag))

    # Add manual health endpoints where possible
    console_url = service_urls.get("console") or next(iter(service_urls.values()), "")
    if console_url:
        add_health_endpoint(doc["paths"], "/readyz", f"{console_url}/health", "readyz", "Ready", secured=False)
        add_health_endpoint(doc["paths"], "/api/health", f"{console_url}/health", "healthAggregate", "OK", secured=False)

    if adscenter_url := service_urls.get("adscenter"):
        add_health_endpoint(doc["paths"], "/api/health/adscenter", f"{adscenter_url}/health", "healthAdscenter", "OK", secured=False)

    if console_url:
        add_health_endpoint(doc["paths"], "/api/health/console", f"{console_url}/health", "healthConsole", "OK", secured=False)

    if billing_url := service_urls.get("billing"):
        add_health_endpoint(doc["paths"], "/api/health/billing", f"{billing_url}/health", "healthBilling", "OK", secured=False)

    doc_components = doc.setdefault("components", {})
    security_schemes = doc_components.get("securitySchemes", {})
    security_schemes.pop("bearerAuth", None)

    with open(args.output, "w", encoding="utf-8") as handle:
        yaml.safe_dump(doc, handle, sort_keys=False)

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
