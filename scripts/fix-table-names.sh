#!/bin/bash

# Simple table name replacement script
echo "🔄 Fixing table names in Go files..."

# Replace UserToken -> user_tokens
find services/billing -name "*.go" -type f -exec sed -i 's/UserToken/user_tokens/g' {} \;

# Replace TokenTransaction -> token_transactions
find services/billing -name "*.go" -type f -exec sed -i 's/TokenTransaction/token_transactions/g' {} \;

# Replace Subscription -> subscriptions
find services/billing -name "*.go" -type f -exec sed -i 's/Subscription/subscriptions/g' {} \;

# Replace with quoted versions
find services/billing -name "*.go" -type f -exec sed -i 's/"UserToken"/"user_tokens"/g' {} \;
find services/billing -name "*.go" -type f -exec sed -i 's/"TokenTransaction"/"token_transactions"/g' {} \;
find services/billing -name "*.go" -type f -exec sed -i 's/"Subscription"/"subscriptions"/g' {} \;

echo "✅ Table names fixed!"