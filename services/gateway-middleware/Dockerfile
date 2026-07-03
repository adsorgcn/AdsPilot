# Gateway Middleware Dockerfile
FROM golang:1.25 as builder

WORKDIR /workspace

ENV GO111MODULE=on
ENV GOWORK=off

# Copy workspace files
COPY go.work ./go.work
COPY pkg ./pkg
COPY services/gateway-middleware ./services/gateway-middleware

WORKDIR /workspace/services/gateway-middleware

ARG COMMIT_SHA=local

RUN go version && \
    go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build \
      -trimpath \
      -ldflags="-s -w -X main.buildVersion=${COMMIT_SHA} -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      -o /gateway-middleware \
      ./cmd/server

# Runtime image
FROM gcr.io/distroless/base-debian12

WORKDIR /

COPY --from=builder /gateway-middleware /gateway-middleware
COPY --from=builder /workspace/services/gateway-middleware/config /config

EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/gateway-middleware"]
