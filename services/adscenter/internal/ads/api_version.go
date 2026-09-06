package ads

import "errors"

// APIVersion is shared by every legacy adapter Google Ads REST request.
// Updating it requires contract tests and credential-gated integration testing.
const APIVersion = "v25"

const APIBaseURL = "https://googleads.googleapis.com/" + APIVersion

var ErrLiveUnavailable = errors.New("Google Ads is unavailable in this build; use an authorized agent-host connector or build the optional adapter with ads_live")

var ErrLiveWriteUnavailable = errors.New("legacy Google Ads writes are unavailable until approval, validation and idempotency are implemented; use the authorized agent-host workflow")
