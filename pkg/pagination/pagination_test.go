package pagination

import (
	"encoding/json"
	"testing"
)

func TestNewPaginationMetadata(t *testing.T) {
	tests := []struct {
		name               string
		total              int
		limit              int
		offset             int
		expectedHasMore    bool
		expectedNextOffset *int
	}{
		{
			name:               "First page with more data",
			total:              100,
			limit:              50,
			offset:             0,
			expectedHasMore:    true,
			expectedNextOffset: intPtr(50),
		},
		{
			name:               "Last page",
			total:              100,
			limit:              50,
			offset:             50,
			expectedHasMore:    false,
			expectedNextOffset: nil,
		},
		{
			name:               "Middle page",
			total:              150,
			limit:              50,
			offset:             50,
			expectedHasMore:    true,
			expectedNextOffset: intPtr(100),
		},
		{
			name:               "Single page",
			total:              30,
			limit:              50,
			offset:             0,
			expectedHasMore:    false,
			expectedNextOffset: nil,
		},
		{
			name:               "Empty result",
			total:              0,
			limit:              50,
			offset:             0,
			expectedHasMore:    false,
			expectedNextOffset: nil,
		},
		{
			name:               "Exact fit last page",
			total:              100,
			limit:              25,
			offset:             75,
			expectedHasMore:    false,
			expectedNextOffset: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			meta := NewPaginationMetadata(tt.total, tt.limit, tt.offset)

			if meta.Total != tt.total {
				t.Errorf("Expected total %d, got %d", tt.total, meta.Total)
			}
			if meta.Limit != tt.limit {
				t.Errorf("Expected limit %d, got %d", tt.limit, meta.Limit)
			}
			if meta.Offset != tt.offset {
				t.Errorf("Expected offset %d, got %d", tt.offset, meta.Offset)
			}
			if meta.HasMore != tt.expectedHasMore {
				t.Errorf("Expected hasMore %v, got %v", tt.expectedHasMore, meta.HasMore)
			}

			if tt.expectedNextOffset == nil {
				if meta.NextOffset != nil {
					t.Errorf("Expected nextOffset to be nil, got %d", *meta.NextOffset)
				}
			} else {
				if meta.NextOffset == nil {
					t.Errorf("Expected nextOffset %d, got nil", *tt.expectedNextOffset)
				} else if *meta.NextOffset != *tt.expectedNextOffset {
					t.Errorf("Expected nextOffset %d, got %d", *tt.expectedNextOffset, *meta.NextOffset)
				}
			}
		})
	}
}

func TestNewPaginatedResponse(t *testing.T) {
	type TestItem struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}

	tests := []struct {
		name   string
		data   []TestItem
		total  int
		limit  int
		offset int
	}{
		{
			name: "With data",
			data: []TestItem{
				{ID: 1, Name: "Item 1"},
				{ID: 2, Name: "Item 2"},
			},
			total:  100,
			limit:  50,
			offset: 0,
		},
		{
			name:   "Empty data",
			data:   []TestItem{},
			total:  0,
			limit:  50,
			offset: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response := NewPaginatedResponse(tt.data, tt.total, tt.limit, tt.offset)

			if len(response.Data) != len(tt.data) {
				t.Errorf("Expected %d items, got %d", len(tt.data), len(response.Data))
			}

			for i, item := range tt.data {
				if response.Data[i] != item {
					t.Errorf("Expected item %d to be %v, got %v", i, item, response.Data[i])
				}
			}

			if response.Pagination.Total != tt.total {
				t.Errorf("Expected total %d, got %d", tt.total, response.Pagination.Total)
			}
			if response.Pagination.Limit != tt.limit {
				t.Errorf("Expected limit %d, got %d", tt.limit, response.Pagination.Limit)
			}
			if response.Pagination.Offset != tt.offset {
				t.Errorf("Expected offset %d, got %d", tt.offset, response.Pagination.Offset)
			}
		})
	}
}

func TestParseParams(t *testing.T) {
	tests := []struct {
		name           string
		inputLimit     int
		inputOffset    int
		expectedLimit  int
		expectedOffset int
	}{
		{
			name:           "Valid params",
			inputLimit:     20,
			inputOffset:    10,
			expectedLimit:  20,
			expectedOffset: 10,
		},
		{
			name:           "Zero limit - use default",
			inputLimit:     0,
			inputOffset:    10,
			expectedLimit:  50,
			expectedOffset: 10,
		},
		{
			name:           "Negative limit - use default",
			inputLimit:     -5,
			inputOffset:    10,
			expectedLimit:  50,
			expectedOffset: 10,
		},
		{
			name:           "Limit exceeds max - cap at 100",
			inputLimit:     200,
			inputOffset:    10,
			expectedLimit:  100,
			expectedOffset: 10,
		},
		{
			name:           "Negative offset - set to 0",
			inputLimit:     50,
			inputOffset:    -10,
			expectedLimit:  50,
			expectedOffset: 0,
		},
		{
			name:           "Both invalid - use defaults",
			inputLimit:     -1,
			inputOffset:    -1,
			expectedLimit:  50,
			expectedOffset: 0,
		},
		{
			name:           "Limit at boundary (100)",
			inputLimit:     100,
			inputOffset:    0,
			expectedLimit:  100,
			expectedOffset: 0,
		},
		{
			name:           "Limit at boundary (101) - cap at 100",
			inputLimit:     101,
			inputOffset:    0,
			expectedLimit:  100,
			expectedOffset: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			limit, offset := ParseParams(tt.inputLimit, tt.inputOffset)

			if limit != tt.expectedLimit {
				t.Errorf("Expected limit %d, got %d", tt.expectedLimit, limit)
			}
			if offset != tt.expectedOffset {
				t.Errorf("Expected offset %d, got %d", tt.expectedOffset, offset)
			}
		})
	}
}

func TestPaginationMetadata_JSONSerialization(t *testing.T) {
	tests := []struct {
		name         string
		meta         PaginationMetadata
		expectedJSON string
	}{
		{
			name: "With nextOffset",
			meta: PaginationMetadata{
				Total:      100,
				Limit:      50,
				Offset:     0,
				HasMore:    true,
				NextOffset: intPtr(50),
			},
			expectedJSON: `{"total":100,"limit":50,"offset":0,"hasMore":true,"nextOffset":50}`,
		},
		{
			name: "Without nextOffset",
			meta: PaginationMetadata{
				Total:      100,
				Limit:      50,
				Offset:     50,
				HasMore:    false,
				NextOffset: nil,
			},
			expectedJSON: `{"total":100,"limit":50,"offset":50,"hasMore":false}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jsonBytes, err := json.Marshal(tt.meta)
			if err != nil {
				t.Fatalf("Failed to marshal JSON: %v", err)
			}

			if string(jsonBytes) != tt.expectedJSON {
				t.Errorf("Expected JSON:\n%s\nGot:\n%s", tt.expectedJSON, string(jsonBytes))
			}

			// Test deserialization
			var decoded PaginationMetadata
			err = json.Unmarshal(jsonBytes, &decoded)
			if err != nil {
				t.Fatalf("Failed to unmarshal JSON: %v", err)
			}

			if decoded.Total != tt.meta.Total {
				t.Errorf("Expected total %d, got %d", tt.meta.Total, decoded.Total)
			}
			if decoded.HasMore != tt.meta.HasMore {
				t.Errorf("Expected hasMore %v, got %v", tt.meta.HasMore, decoded.HasMore)
			}
		})
	}
}

func TestPaginatedResponse_JSONSerialization(t *testing.T) {
	type TestItem struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}

	response := NewPaginatedResponse(
		[]TestItem{
			{ID: 1, Name: "Item 1"},
			{ID: 2, Name: "Item 2"},
		},
		100,
		50,
		0,
	)

	jsonBytes, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("Failed to marshal JSON: %v", err)
	}

	var decoded PaginatedResponse[TestItem]
	err = json.Unmarshal(jsonBytes, &decoded)
	if err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	if len(decoded.Data) != 2 {
		t.Errorf("Expected 2 items, got %d", len(decoded.Data))
	}
	if decoded.Data[0].ID != 1 {
		t.Errorf("Expected first item ID 1, got %d", decoded.Data[0].ID)
	}
	if decoded.Pagination.Total != 100 {
		t.Errorf("Expected total 100, got %d", decoded.Pagination.Total)
	}
	if decoded.Pagination.HasMore != true {
		t.Errorf("Expected hasMore true, got %v", decoded.Pagination.HasMore)
	}
}

func TestToPageInfo(t *testing.T) {
	meta := PaginationMetadata{
		Total:      100,
		Limit:      50,
		Offset:     0,
		HasMore:    true,
		NextOffset: intPtr(50),
	}

	pageInfo := meta.ToPageInfo()

	if pageInfo.Total != meta.Total {
		t.Errorf("Expected total %d, got %d", meta.Total, pageInfo.Total)
	}
	if pageInfo.Limit != meta.Limit {
		t.Errorf("Expected limit %d, got %d", meta.Limit, pageInfo.Limit)
	}
	if pageInfo.Offset != meta.Offset {
		t.Errorf("Expected offset %d, got %d", meta.Offset, pageInfo.Offset)
	}
	if pageInfo.HasMore != meta.HasMore {
		t.Errorf("Expected hasMore %v, got %v", meta.HasMore, pageInfo.HasMore)
	}
	if *pageInfo.NextOffset != *meta.NextOffset {
		t.Errorf("Expected nextOffset %d, got %d", *meta.NextOffset, *pageInfo.NextOffset)
	}
}

func TestPaginationEdgeCases(t *testing.T) {
	t.Run("Large numbers", func(t *testing.T) {
		meta := NewPaginationMetadata(1000000, 100, 999900)
		if meta.HasMore != false {
			t.Error("Expected hasMore to be false for last page with large numbers")
		}
	})

	t.Run("Offset beyond total", func(t *testing.T) {
		meta := NewPaginationMetadata(50, 50, 100)
		if meta.HasMore != false {
			t.Error("Expected hasMore to be false when offset > total")
		}
	})

	t.Run("Total less than limit", func(t *testing.T) {
		meta := NewPaginationMetadata(30, 50, 0)
		if meta.HasMore != false {
			t.Error("Expected hasMore to be false when total < limit")
		}
		if meta.NextOffset != nil {
			t.Error("Expected nextOffset to be nil when total < limit")
		}
	})
}

func TestGenericTypes(t *testing.T) {
	t.Run("String slice", func(t *testing.T) {
		response := NewPaginatedResponse([]string{"a", "b", "c"}, 100, 50, 0)
		if len(response.Data) != 3 {
			t.Errorf("Expected 3 strings, got %d", len(response.Data))
		}
		if response.Data[0] != "a" {
			t.Errorf("Expected first item to be 'a', got %s", response.Data[0])
		}
	})

	t.Run("Integer slice", func(t *testing.T) {
		response := NewPaginatedResponse([]int{1, 2, 3, 4, 5}, 10, 5, 0)
		if len(response.Data) != 5 {
			t.Errorf("Expected 5 integers, got %d", len(response.Data))
		}
		if response.Data[0] != 1 {
			t.Errorf("Expected first item to be 1, got %d", response.Data[0])
		}
	})

	t.Run("Pointer slice", func(t *testing.T) {
		type Item struct{ ID int }
		items := []*Item{{ID: 1}, {ID: 2}}
		response := NewPaginatedResponse(items, 100, 50, 0)
		if len(response.Data) != 2 {
			t.Errorf("Expected 2 items, got %d", len(response.Data))
		}
		if response.Data[0].ID != 1 {
			t.Errorf("Expected first item ID to be 1, got %d", response.Data[0].ID)
		}
	})
}

// Helper function to create int pointer
func intPtr(i int) *int {
	return &i
}
