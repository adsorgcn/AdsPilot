module github.com/ScientificInternet/Google-Monetize/pkg/metrics

go 1.23

require (
	github.com/prometheus/client_golang v1.20.5
	github.com/stretchr/testify v1.9.0
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/klauspost/compress v1.17.9 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/kylelemons/godebug v1.1.0 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/prometheus/client_model v0.6.1 // indirect
	github.com/prometheus/common v0.55.0 // indirect
	github.com/prometheus/procfs v0.15.1 // indirect
	golang.org/x/sys v0.22.0 // indirect
	google.golang.org/protobuf v1.34.2 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/ScientificInternet/Google-Monetize/pkg/apierrors => ../../pkg/apierrors

replace github.com/ScientificInternet/Google-Monetize/pkg/cache => ../../pkg/cache

replace github.com/ScientificInternet/Google-Monetize/pkg/circuitbreaker => ../../pkg/circuitbreaker

replace github.com/ScientificInternet/Google-Monetize/pkg/config => ../../pkg/config

replace github.com/ScientificInternet/Google-Monetize/pkg/database => ../../pkg/database

replace github.com/ScientificInternet/Google-Monetize/pkg/dbadmin => ../../pkg/dbadmin

replace github.com/ScientificInternet/Google-Monetize/pkg/dburl => ../../pkg/dburl

replace github.com/ScientificInternet/Google-Monetize/pkg/errorreporting => ../../pkg/errorreporting

replace github.com/ScientificInternet/Google-Monetize/pkg/errors => ../../pkg/errors

replace github.com/ScientificInternet/Google-Monetize/pkg/events => ../../pkg/events

replace github.com/ScientificInternet/Google-Monetize/pkg/eventstore => ../../pkg/eventstore

replace github.com/ScientificInternet/Google-Monetize/pkg/http => ../../pkg/http

replace github.com/ScientificInternet/Google-Monetize/pkg/httpclient => ../../pkg/httpclient

replace github.com/ScientificInternet/Google-Monetize/pkg/idempotency => ../../pkg/idempotency

replace github.com/ScientificInternet/Google-Monetize/pkg/logger => ../../pkg/logger

replace github.com/ScientificInternet/Google-Monetize/pkg/middleware => ../../pkg/middleware

replace github.com/ScientificInternet/Google-Monetize/pkg/noop => ../../pkg/noop

replace github.com/ScientificInternet/Google-Monetize/pkg/pagination => ../../pkg/pagination

replace github.com/ScientificInternet/Google-Monetize/pkg/ratelimitredis => ../../pkg/ratelimitredis

replace github.com/ScientificInternet/Google-Monetize/pkg/redislock => ../../pkg/redislock

replace github.com/ScientificInternet/Google-Monetize/pkg/serviceclient => ../../pkg/serviceclient

replace github.com/ScientificInternet/Google-Monetize/pkg/supabaseauth => ../../pkg/supabaseauth

replace github.com/ScientificInternet/Google-Monetize/pkg/telemetry => ../../pkg/telemetry

replace github.com/ScientificInternet/Google-Monetize/pkg/testutil => ../../pkg/testutil
