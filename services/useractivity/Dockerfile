# Build stage
FROM golang:1.25-alpine as builder
WORKDIR /workspace
ENV GO111MODULE=on
ENV GOWORK=off

# Copy minimal workspace
COPY go.work go.work.sum* ./
COPY pkg ./pkg
COPY services/useractivity ./services/useractivity

WORKDIR /workspace/services/useractivity
ARG COMMIT_SHA=local

RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w -X main.buildVersion=${COMMIT_SHA} -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -o /useractivity-service ./cmd/useractivity

# Runtime stage
FROM gcr.io/distroless/base-debian12
WORKDIR /
COPY --from=builder /useractivity-service /useractivity-service
EXPOSE 8080
ENTRYPOINT ["/useractivity-service"]

