module github.com/ScientificInternet/Google-Monetize/pkg/serviceclient

go 1.25.1

require github.com/sony/gobreaker v1.0.0

require (
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/stretchr/testify v1.11.1 // indirect
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

replace github.com/ScientificInternet/Google-Monetize/pkg/metrics => ../../pkg/metrics

replace github.com/ScientificInternet/Google-Monetize/pkg/middleware => ../../pkg/middleware

replace github.com/ScientificInternet/Google-Monetize/pkg/noop => ../../pkg/noop

replace github.com/ScientificInternet/Google-Monetize/pkg/pagination => ../../pkg/pagination

replace github.com/ScientificInternet/Google-Monetize/pkg/ratelimitredis => ../../pkg/ratelimitredis

replace github.com/ScientificInternet/Google-Monetize/pkg/redislock => ../../pkg/redislock

replace github.com/ScientificInternet/Google-Monetize/pkg/supabaseauth => ../../pkg/supabaseauth

replace github.com/ScientificInternet/Google-Monetize/pkg/telemetry => ../../pkg/telemetry

replace github.com/ScientificInternet/Google-Monetize/pkg/testutil => ../../pkg/testutil
