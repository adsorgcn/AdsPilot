package errorreporting

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	"cloud.google.com/go/errorreporting"
)

var client *errorreporting.Client

// Setup initializes the Cloud Error Reporting client when ERROR_REPORTING_ENABLED=1/true.
// Environment variables:
// - ERROR_REPORTING_ENABLED (1/true to enable)
// - GOOGLE_CLOUD_PROJECT (GCP project ID)
// - ERROR_REPORTING_SERVICE_NAME (service name, overrides provided serviceName)
//
// Returns a close function; no-op when disabled or on init failure.
func Setup(ctx context.Context, serviceName string) func() {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("ERROR_REPORTING_ENABLED")))
	if !(v == "1" || v == "true" || v == "yes") {
		return func() {}
	}

	projectID := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
	if projectID == "" {
		log.Println("WARN: ERROR_REPORTING_ENABLED=1 but GOOGLE_CLOUD_PROJECT not set, skipping error reporting")
		return func() {}
	}

	if s := strings.TrimSpace(os.Getenv("ERROR_REPORTING_SERVICE_NAME")); s != "" {
		serviceName = s
	}

	var err error
	client, err = errorreporting.NewClient(ctx, projectID, errorreporting.Config{
		ServiceName: serviceName,
		OnError: func(err error) {
			log.Printf("Error Reporting client error: %v", err)
		},
	})
	if err != nil {
		log.Printf("WARN: Failed to create Error Reporting client: %v", err)
		return func() {}
	}

	log.Printf("Cloud Error Reporting enabled for service: %s", serviceName)
	return func() { client.Close() }
}

// Report sends an error to Cloud Error Reporting.
// No-op if the client is not initialized.
func Report(err error) {
	if client != nil {
		client.Report(errorreporting.Entry{
			Error: err,
		})
	}
}

// ReportWithContext sends an error with additional context to Cloud Error Reporting.
// No-op if the client is not initialized.
func ReportWithContext(ctx context.Context, err error, req interface{}) {
	if client != nil {
		entry := errorreporting.Entry{
			Error: err,
		}
		// If req is an *http.Request, attach it
		// This allows Error Reporting to show HTTP context
		if httpReq, ok := req.(*http.Request); ok {
			entry.Req = httpReq
		}
		client.Report(entry)
	}
}
