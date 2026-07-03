package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/getkin/kin-openapi/openapi2"
	"github.com/getkin/kin-openapi/openapi2conv"
	"github.com/getkin/kin-openapi/openapi3"
	"gopkg.in/yaml.v3"
)

func main() {
	inPath := flag.String("in", "", "path to OpenAPI 3 document")
	outPath := flag.String("out", "", "path to write Swagger 2 document")
	flag.Parse()

	if *inPath == "" || *outPath == "" {
		fmt.Fprintln(os.Stderr, "--in and --out are required")
		os.Exit(1)
	}

	data, err := os.ReadFile(*inPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to read %s: %v\n", *inPath, err)
		os.Exit(1)
	}

	loader := openapi3.NewLoader()
	loader.IsExternalRefsAllowed = true

	doc, err := loader.LoadFromData(data)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load OpenAPI document: %v\n", err)
		os.Exit(1)
	}

	if err := doc.Validate(context.Background()); err != nil {
		fmt.Fprintf(os.Stderr, "OpenAPI validation error: %v\n", err)
		os.Exit(1)
	}

	doc2, err := openapi2conv.FromV3(doc)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to convert document to Swagger 2: %v\n", err)
		os.Exit(1)
	}

	copyExtensions(doc, doc2)
	copySecurityScheme(doc, doc2)

	if len(doc2.Schemes) == 0 {
		doc2.Schemes = []string{"https"}
	}
	if len(doc2.Produces) == 0 {
		doc2.Produces = []string{"application/json"}
	}
	if len(doc2.Consumes) == 0 {
		doc2.Consumes = []string{"application/json"}
	}

	jsonBytes, err := json.Marshal(doc2)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to marshal Swagger document: %v\n", err)
		os.Exit(1)
	}

	var intermediate any
	if err := json.Unmarshal(jsonBytes, &intermediate); err != nil {
		fmt.Fprintf(os.Stderr, "failed to convert Swagger JSON: %v\n", err)
		os.Exit(1)
	}

	output, err := yaml.Marshal(intermediate)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to marshal Swagger document: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(*outPath, output, 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "failed to write %s: %v\n", *outPath, err)
		os.Exit(1)
	}
}

func copyExtensions(doc3 *openapi3.T, doc2 *openapi2.T) {
	if doc3 == nil || doc2 == nil {
		return
	}
	if doc3.Paths == nil {
		return
	}
	for path, item := range doc3.Paths.Map() {
		if item == nil {
			continue
		}
		destPath, ok := doc2.Paths[path]
		if !ok || destPath == nil {
			continue
		}
		for method, operation := range item.Operations() {
			if operation == nil || len(operation.Extensions) == 0 {
				continue
			}
			destOp := getOperation(destPath, strings.ToUpper(method))
			if destOp == nil {
				continue
			}
			if destOp.Extensions == nil {
				destOp.Extensions = make(map[string]interface{})
			}
			for k, v := range operation.Extensions {
				destOp.Extensions[k] = v
			}
		}
	}
}

func getOperation(pathItem *openapi2.PathItem, method string) *openapi2.Operation {
	switch method {
	case "GET":
		return pathItem.Get
	case "PUT":
		return pathItem.Put
	case "POST":
		return pathItem.Post
	case "DELETE":
		return pathItem.Delete
	case "OPTIONS":
		return pathItem.Options
	case "HEAD":
		return pathItem.Head
	case "PATCH":
		return pathItem.Patch
	default:
		return nil
	}
}

func copySecurityScheme(doc3 *openapi3.T, doc2 *openapi2.T) {
	if doc3 == nil || doc3.Components == nil || doc3.Components.SecuritySchemes == nil {
		return
	}
	if doc2 == nil || doc2.SecurityDefinitions == nil {
		return
	}
	ref, ok := doc3.Components.SecuritySchemes["firebase"]
	if !ok || ref == nil || ref.Value == nil || ref.Value.Flows == nil || ref.Value.Flows.Implicit == nil {
		return
	}
	sec, ok := doc2.SecurityDefinitions["firebase"]
	if !ok || sec == nil {
		return
	}
	sec.Flow = "implicit"
	sec.AuthorizationURL = ref.Value.Flows.Implicit.AuthorizationURL
	if scopes := ref.Value.Flows.Implicit.Scopes; scopes != nil {
		sec.Scopes = scopes
	}
}
