FROM golang:1.25 as builder
WORKDIR /workspace
ENV GO111MODULE=on
ENV GOWORK=off

# Copy minimal workspace
COPY go.work ./go.work
COPY pkg ./pkg
COPY services/aicore ./services/aicore

WORKDIR /workspace/services/aicore
ARG COMMIT_SHA=local

RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w -X main.buildVersion=${COMMIT_SHA}" \
    -o /out/aicore .

FROM gcr.io/distroless/base-debian12
WORKDIR /app
COPY --from=builder /out/aicore /app/aicore
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/aicore"]
