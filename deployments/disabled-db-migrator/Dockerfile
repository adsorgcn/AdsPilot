## Multi-stage build for DB migrator (Cloud Run Job)
FROM golang:1.22 as builder
WORKDIR /app

# Only copy minimal tree required to build the migrator
COPY scripts/db/go.mod scripts/db/go.mod
COPY scripts/db/go.sum scripts/db/go.sum
COPY scripts/db/apply-sql.go scripts/db/apply-sql.go
COPY schemas/sql schemas/sql

WORKDIR /app/scripts/db
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /app/db-migrator apply-sql.go

FROM gcr.io/distroless/base-debian12
WORKDIR /app
COPY --from=builder /app/db-migrator /app/db-migrator
COPY --from=builder /app/schemas/sql /app/schemas/sql
ENTRYPOINT ["/app/db-migrator"]
