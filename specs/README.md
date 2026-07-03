# Google-Monetize API Specifications

This directory contains the canonical source of truth for all API specifications.

## Directory Structure

```
specs/
├── openapi/          # OpenAPI 3.0 specifications (canonical source)
│   ├── adscenter.yaml
│   ├── batchopen.yaml
│   ├── billing.yaml
│   ├── browser-exec.yaml
│   ├── console.yaml
│   ├── identity.yaml
│   ├── notifications.yaml
│   ├── offer.yaml
│   ├── recommendations.yaml
│   └── siterank.yaml
└── README.md
```

## Single Source of Truth

**DO NOT** edit `services/*/openapi.yaml` files directly. They are auto-generated mirrors.

### Editing API Specs

1. Edit the canonical spec in `specs/openapi/<service>.yaml`
2. Run `bash scripts/openapi/generate.sh` to:
   - Generate TypeScript types → `packages/shared-types/src/`
   - Generate Go server stubs → `services/*/gen/`
   - Sync mirror files → `services/*/openapi.yaml`
3. Commit both the canonical spec and generated files

### Validation

```bash
# Validate OpenAPI specs
bash scripts/openapi/validate.sh

# Check mirrors are in sync
bash scripts/openapi/check-mirrors.sh

# Full CI check
bash scripts/openapi/ci-check.sh
```

## Tools

- **Validation**: Redocly CLI (`@redocly/cli`)
- **TypeScript Generation**: openapi-typescript
- **Go Generation**: oapi-codegen
- **Documentation**: Redoc, Swagger UI

## CI/CD

The OpenAPI CI workflow (`.github/workflows/openapi-ci.yml`) enforces:
1. Single-source rule (no direct edits to service mirrors)
2. Spec validation (OpenAPI 3.0 compliance)
3. Successful code generation
4. Mirror synchronization

## Related Documentation

- [OpenAPI Contract Testing](../docs/testing/openapi-contract-tests.md)
- [API Gateway Configuration](../deployments/gateway/README.md)
- [Shared Types Package](../packages/shared-types/README.md)