package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// AISiterankAnalysis represents the structure of the AI-powered analysis.
// This structure must match the Zod schema defined in the Genkit flow.
type AISiterankAnalysis struct {
	OpportunityScore float64  `json:"opportunityScore"`
	KeyInsights      []string `json:"keyInsights"`
	SuggestedActions []string `json:"suggestedActions"`
}

// AnalyzeURLWithAI makes a real HTTP call to the Genkit Flow service.
func AnalyzeURLWithAI(url string) (*AISiterankAnalysis, error) {
	genkitEndpoint := os.Getenv("GENKIT_API_URL")
	if genkitEndpoint == "" {
		genkitEndpoint = "http://localhost:3400/flows/siterankAnalysisFlow" // Default for local dev
	}

	// The input for the Genkit flow is a simple string, but the API expects a JSON object
	// with a key named "input".
	requestBody, err := json.Marshal(map[string]string{
		"input": url,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	// Make the POST request to the Genkit flow server
	resp, err := http.Post(genkitEndpoint, "application/json", bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to call Genkit service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("genkit service returned non-OK status: %d, body: %s", resp.StatusCode, string(bodyBytes))
	}

	// The response from the Genkit flow is nested under a "output" key.
	var genkitResponse struct {
		Output AISiterankAnalysis `json:"output"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&genkitResponse); err != nil {
		return nil, fmt.Errorf("failed to decode Genkit response: %w", err)
	}

	return &genkitResponse.Output, nil
}
