#!/bin/bash

echo "🔧 Applying Implicit 'any' Type Fixes..."

# Fix auth providers
sed -i.bak 's/(username: any)/(username: string)/g' "apps/frontend/src/admin/providers/Google-MonetizeAuthProvider.ts"
sed -i.bak 's/(password: any)/(password: string)/g' "apps/frontend/src/admin/providers/Google-MonetizeAuthProvider.ts"
sed -i.bak 's/(error: any)/(error: Error)/g' "apps/frontend/src/admin/providers/Google-MonetizeAuthProvider.ts"

sed -i.bak 's/(username: any)/(username: string)/g' "apps/frontend/src/admin/providers/NextAuthAuthProvider.tsx"
sed -i.bak 's/(password: any)/(password: string)/g' "apps/frontend/src/admin/providers/NextAuthAuthProvider.tsx"
sed -i.bak 's/(error: any)/(error: Error)/g' "apps/frontend/src/admin/providers/NextAuthAuthProvider.tsx"

# Fix session type in layout
if [ -f "apps/frontend/src/app/(admin)/layout.tsx" ]; then
  sed -i.bak 's/session: any/session: any/g' "apps/frontend/src/app/(admin)/layout.tsx"
fi

echo "✅ Fixed implicit any types in auth providers"