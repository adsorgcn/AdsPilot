# Simple Cloud Run container for Pub/Sub push projection
FROM golang:1.25-alpine AS builder
WORKDIR /workspace
ENV GO111MODULE=on
ENV GOWORK=off

# Install git (required for go mod tidy with remote dependencies)
RUN apk add --no-cache git

# Copy minimal workspace
COPY go.work ./go.work
COPY pkg ./pkg
COPY services/projector ./services/projector

WORKDIR /workspace/services/projector
ARG COMMIT_SHA=local

RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w -X main.buildVersion=${COMMIT_SHA}" \
    -o /projector-service .

FROM gcr.io/distroless/base-debian12
COPY --from=builder /projector-service /projector-service
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/projector-service"]
