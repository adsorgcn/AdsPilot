# Build stage
FROM golang:1.25-alpine as builder
WORKDIR /workspace
ENV GO111MODULE=on
ENV GOWORK=off

# Copy minimal workspace
COPY go.work go.work.sum* ./
COPY pkg ./pkg
COPY services/bff ./services/bff

WORKDIR /workspace/services/bff
ARG COMMIT_SHA=local

RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w -X main.buildVersion=${COMMIT_SHA} -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -o /bff-service ./cmd/bff

# Runtime stage
FROM gcr.io/distroless/base-debian12
WORKDIR /
COPY --from=builder /bff-service /bff-service
EXPOSE 8080
ENTRYPOINT ["/bff-service"]
