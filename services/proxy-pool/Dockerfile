# Project number verification test: 2025-10-15
FROM golang:1.25-alpine as builder
WORKDIR /workspace
ENV GO111MODULE=on
ENV GOWORK=off

# Copy minimal workspace
COPY go.work ./go.work
COPY pkg ./pkg
COPY services/proxy-pool ./services/proxy-pool

WORKDIR /workspace/services/proxy-pool
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /proxy-pool ./cmd/server

# Runtime stage
FROM gcr.io/distroless/base-debian12

WORKDIR /

# Copy the binary from the builder stage
COPY --from=builder /proxy-pool /proxy-pool

# Expose port 8080 to the outside world
EXPOSE 8080

# Run the binary
ENTRYPOINT ["/proxy-pool"]
