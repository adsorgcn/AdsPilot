# Stage 1: Build the Go application
# Build triggered: 2025-10-15 backend test
# Full deployment trigger: 2025-10-15-full-deploy-test
FROM golang:1.25 as builder
WORKDIR /workspace
ENV GO111MODULE=on
ENV GOWORK=off
# Prime minimal workspace
COPY go.work ./go.work
COPY pkg ./pkg
COPY services/console ./services/console
WORKDIR /workspace/services/console
RUN go version && \
    go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /console-api ./main.go

FROM gcr.io/distroless/base-debian12
WORKDIR /app
COPY --from=builder /console-api /app/console-api
COPY services/console/static /app/static
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/console-api"]
