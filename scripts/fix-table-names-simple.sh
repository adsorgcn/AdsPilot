#!/bin/bash

echo "🔄 Fixing table names in Go files..."

# Use perl for better regex support
find services/billing -name "*.go" -type f -exec perl -pi -e '
    s/UserToken/user_tokens/g;
    s/TokenTransaction/token_transactions/g;
    s/Subscription/subscriptions/g;
    s/"UserToken"/"user_tokens"/g;
    s/"TokenTransaction"/"token_transactions"/g;
    s/"Subscription"/"subscriptions"/g;
    s/\buserId\b/user_id/g;
    s/"userId"/"user_id"/g;
    s/\bplanName\b/plan_name/g;
    s/"planName"/"plan_name"/g;
    s/\bcreatedAt\b/created_at/g;
    s/"createdAt"/"created_at"/g;
    s/\bupdatedAt\b/updated_at/g;
    s/"updatedAt"/"updated_at"/g;
' {} \;

echo "✅ Table names fixed!"