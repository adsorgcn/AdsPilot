package ads

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestKeywordVolumeJSONPreservesNullZeroAndLargeInteger(t *testing.T) {
	zero, maximum := int64(0), int64(9223372036854775807)
	for _, tc := range []struct {
		name  string
		value *int64
		want  string
	}{
		{"missing", nil, `"avgMonthlySearches":null`},
		{"zero", &zero, `"avgMonthlySearches":"0"`},
		{"int64 maximum", &maximum, `"avgMonthlySearches":"9223372036854775807"`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(KeywordIdea{Text: "synthetic", AvgMonthlySearches: tc.value})
			if err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(string(data), tc.want) {
				t.Fatalf("unexpected volume serialization: %s", data)
			}
		})
	}
}
