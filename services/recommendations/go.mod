module github.com/ScientificInternet/Google-Monetize/services/recommendations

go 1.25.1

require (
	cloud.google.com/go/bigquery v1.71.0
	cloud.google.com/go/firestore v1.18.0
	github.com/go-chi/chi/v5 v5.2.3
	github.com/lib/pq v1.10.9
	github.com/oapi-codegen/runtime v1.1.2
	github.com/ScientificInternet/Google-Monetize/pkg/database v0.0.0-00010101000000-000000000000
	github.com/ScientificInternet/Google-Monetize/pkg/errorreporting v0.0.0-00010101000000-000000000000
	github.com/ScientificInternet/Google-Monetize/pkg/errors v0.0.0-00010101000000-000000000000
	github.com/ScientificInternet/Google-Monetize/pkg/events v0.0.0-00010101000000-000000000000
	github.com/ScientificInternet/Google-Monetize/pkg/http v0.0.0-00010101000000-000000000000
	github.com/ScientificInternet/Google-Monetize/pkg/middleware v0.0.0-00010101000000-000000000000
	github.com/ScientificInternet/Google-Monetize/pkg/serviceclient v0.0.0-00010101000000-000000000000
	github.com/ScientificInternet/Google-Monetize/pkg/telemetry v0.0.0-00010101000000-000000000000
	google.golang.org/api v0.251.0
)

require (
	cloud.google.com/go v0.121.6 // indirect
	cloud.google.com/go/auth v0.16.5 // indirect
	cloud.google.com/go/auth/oauth2adapt v0.2.8 // indirect
	cloud.google.com/go/compute/metadata v0.9.0 // indirect
	cloud.google.com/go/errorreporting v0.3.2 // indirect
	cloud.google.com/go/iam v1.5.2 // indirect
	cloud.google.com/go/longrunning v0.6.7 // indirect
	cloud.google.com/go/pubsub v1.50.1 // indirect
	cloud.google.com/go/pubsub/v2 v2.0.0 // indirect
	github.com/apache/arrow/go/v15 v15.0.2 // indirect
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cenkalti/backoff/v5 v5.0.2 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/go-logr/logr v1.4.3 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/go-redis/redis/v8 v8.11.5 // indirect
	github.com/goccy/go-json v0.10.5 // indirect
	github.com/golang-jwt/jwt/v5 v5.2.1 // indirect
	github.com/google/flatbuffers v23.5.26+incompatible // indirect
	github.com/google/s2a-go v0.1.9 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.3.6 // indirect
	github.com/googleapis/gax-go/v2 v2.15.0 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.26.3 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/pgx/v5 v5.7.6 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/klauspost/compress v1.18.0 // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/pierrec/lz4/v4 v4.1.18 // indirect
	github.com/prometheus/client_golang v1.23.2 // indirect
	github.com/prometheus/client_model v0.6.2 // indirect
	github.com/prometheus/common v0.66.1 // indirect
	github.com/prometheus/procfs v0.16.1 // indirect
	github.com/redis/go-redis/v9 v9.14.0 // indirect
	github.com/rs/zerolog v1.34.0 // indirect
	github.com/sony/gobreaker v1.0.0 // indirect
	github.com/ScientificInternet/Google-Monetize/pkg/cache v0.0.0-00010101000000-000000000000 // indirect
	github.com/ScientificInternet/Google-Monetize/pkg/httpclient v0.0.0-00010101000000-000000000000 // indirect
	github.com/ScientificInternet/Google-Monetize/pkg/idempotency v0.0.0-00010101000000-000000000000 // indirect
	github.com/ScientificInternet/Google-Monetize/pkg/logger v0.0.0-00010101000000-000000000000 // indirect
	github.com/ScientificInternet/Google-Monetize/pkg/supabaseauth v0.0.0-00010101000000-000000000000 // indirect
	github.com/zeebo/xxh3 v1.0.2 // indirect
	go.opencensus.io v0.24.0 // indirect
	go.opentelemetry.io/auto/sdk v1.1.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.61.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0 // indirect
	go.opentelemetry.io/otel v1.37.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.36.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.36.0 // indirect
	go.opentelemetry.io/otel/metric v1.37.0 // indirect
	go.opentelemetry.io/otel/sdk v1.37.0 // indirect
	go.opentelemetry.io/otel/trace v1.37.0 // indirect
	go.opentelemetry.io/proto/otlp v1.6.0 // indirect
	go.yaml.in/yaml/v2 v2.4.2 // indirect
	golang.org/x/crypto v0.42.0 // indirect
	golang.org/x/exp v0.0.0-20240719175910-8a7402abbf56 // indirect
	golang.org/x/mod v0.27.0 // indirect
	golang.org/x/net v0.44.0 // indirect
	golang.org/x/oauth2 v0.31.0 // indirect
	golang.org/x/sync v0.17.0 // indirect
	golang.org/x/sys v0.36.0 // indirect
	golang.org/x/text v0.29.0 // indirect
	golang.org/x/time v0.13.0 // indirect
	golang.org/x/tools v0.36.0 // indirect
	golang.org/x/xerrors v0.0.0-20240903120638-7835f813f4da // indirect
	google.golang.org/genproto v0.0.0-20250603155806-513f23925822 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20250818200422-3122310a409c // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250929231259-57b25ae835d4 // indirect
	google.golang.org/grpc v1.75.1 // indirect
	google.golang.org/protobuf v1.36.9 // indirect
)

replace github.com/ScientificInternet/Google-Monetize/pkg/telemetry => ../../pkg/telemetry

replace github.com/ScientificInternet/Google-Monetize/pkg/middleware => ../../pkg/middleware

replace github.com/ScientificInternet/Google-Monetize/pkg/errors => ../../pkg/errors

replace github.com/ScientificInternet/Google-Monetize/pkg/events => ../../pkg/events

replace github.com/ScientificInternet/Google-Monetize/pkg/idempotency => ../../pkg/idempotency

replace github.com/ScientificInternet/Google-Monetize/pkg/cache => ../../pkg/cache

replace github.com/ScientificInternet/Google-Monetize/pkg/http => ../../pkg/http

replace github.com/ScientificInternet/Google-Monetize/pkg/httpclient => ../../pkg/httpclient


replace github.com/ScientificInternet/Google-Monetize/pkg/logger => ../../pkg/logger

replace github.com/ScientificInternet/Google-Monetize/pkg/errorreporting => ../../pkg/errorreporting

replace github.com/ScientificInternet/Google-Monetize/pkg/supabaseauth => ../../pkg/supabaseauth

replace github.com/ScientificInternet/Google-Monetize/services/recommendations/internal/oapi => ./internal/oapi

replace github.com/ScientificInternet/Google-Monetize/pkg/serviceclient => ../../pkg/serviceclient

replace github.com/ScientificInternet/Google-Monetize/pkg/database => ../../pkg/database

replace github.com/ScientificInternet/Google-Monetize/pkg/apierrors => ../../pkg/apierrors

replace github.com/ScientificInternet/Google-Monetize/pkg/circuitbreaker => ../../pkg/circuitbreaker

replace github.com/ScientificInternet/Google-Monetize/pkg/config => ../../pkg/config

replace github.com/ScientificInternet/Google-Monetize/pkg/dbadmin => ../../pkg/dbadmin

replace github.com/ScientificInternet/Google-Monetize/pkg/dburl => ../../pkg/dburl

replace github.com/ScientificInternet/Google-Monetize/pkg/eventstore => ../../pkg/eventstore

replace github.com/ScientificInternet/Google-Monetize/pkg/metrics => ../../pkg/metrics

replace github.com/ScientificInternet/Google-Monetize/pkg/noop => ../../pkg/noop

replace github.com/ScientificInternet/Google-Monetize/pkg/pagination => ../../pkg/pagination

replace github.com/ScientificInternet/Google-Monetize/pkg/ratelimitredis => ../../pkg/ratelimitredis

replace github.com/ScientificInternet/Google-Monetize/pkg/redislock => ../../pkg/redislock

replace github.com/ScientificInternet/Google-Monetize/pkg/testutil => ../../pkg/testutil
