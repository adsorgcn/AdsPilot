# Use the official Golang image to create a build artifact.
# Build triggered: 2025-10-15 backend test
# Full deployment trigger: 2025-10-15-full-deploy-test
FROM golang:1.25 as builder
WORKDIR /workspace
ENV GO111MODULE=on
ENV GOWORK=off

# Copy minimal workspace
COPY go.work ./go.work
COPY pkg ./pkg
COPY services/adscenter ./services/adscenter

WORKDIR /workspace/services/adscenter
ARG COMMIT_SHA=local

RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w -X main.buildVersion=${COMMIT_SHA}" \
    -o /adscenter-service .
# Start a new stage from scratch for a smaller image
FROM gcr.io/distroless/base-debian12
WORKDIR /
COPY --from=builder /adscenter-service /adscenter-service
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/adscenter-service"]
