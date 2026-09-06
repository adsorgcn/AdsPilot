package ads

// KeywordIdea keeps unavailable volume distinct from an observed zero. This
// optional adapter type is not the frozen generated HTTP keyword contract.
type KeywordIdea struct {
	Text               string `json:"text"`
	AvgMonthlySearches *int64 `json:"avgMonthlySearches,string"`
	Competition        string `json:"competition"`
}
