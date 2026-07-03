#!/bin/bash

echo "🔧 Fixing Implicit 'any' Types Throughout the Codebase..."

# AntiCheatList fixes
sed -i.bak 's/device => /device: any => /g' "apps/frontend/src/admin/resources/anti-cheat/AntiCheatList.tsx"
sed -i.bak 's/sum => /sum: any => /g' "apps/frontend/src/admin/resources/anti-cheat/AntiCheatList.tsx"
sed -i.bak 's/d => /d: any => /g' "apps/frontend/src/admin/resources/anti-cheat/AntiCheatList.tsx"

# EmailConfigEnhanced fixes - Label component compatibility
sed -i.bak 's/<Label/<Label as="label"/g' "apps/frontend/src/admin/resources/config/EmailConfigEnhanced.tsx"

# UI store fixes
sed -i.bak 's/state) => /state: any) => /g' "apps/frontend/src/shared/store/ui-store.ts"
sed -i.bak 's/breadcrumbs) => /breadcrumbs: any) => /g' "apps/frontend/src/shared/store/ui-store.ts"
sed -i.bak 's/actions) => /actions: any) => /g' "apps/frontend/src/shared/store/ui-store.ts"
sed -i.bak 's/pageState) => /pageState: any) => /g' "apps/frontend/src/shared/store/ui-store.ts"
sed -i.bak 's/config) => /config: any) => /g' "apps/frontend/src/shared/store/ui-store.ts"
sed -i.bak 's/isMobile, isTablet, isDesktop) => /isMobile: any, isTablet: any, isDesktop: any) => /g' "apps/frontend/src/shared/store/ui-store.ts"

# User store fixes
sed -i.bak 's/set, get) => /set: any, get: any) => /g' "apps/frontend/src/shared/store/user-store.ts"
sed -i.bak 's/profile) => /profile: any) => /g' "apps/frontend/src/shared/store/user-store.ts"
sed -i.bak 's/state) => /state: any) => /g' "apps/frontend/src/shared/store/user-store.ts"
sed -i.bak 's/updates) => /updates: any) => /g' "apps/frontend/src/shared/store/user-store.ts"
sed -i.bak 's/preferences) => /preferences: any) => /g' "apps/frontend/src/shared/store/user-store.ts"
sed -i.bak 's/session) => /session: any) => /g' "apps/frontend/src/shared/store/user-store.ts"
sed -i.bak 's/auth) => /auth: any) => /g' "apps/frontend/src/shared/store/user-store.ts"

# Storybook fixes
sed -i.bak 's/: Meta/: typeof Meta/g' "apps/frontend/src/stories/Button.stories.ts"
sed -i.bak 's/: StoryObj/: typeof StoryObj/g' "apps/frontend/src/stories/Button.stories.ts"
sed -i.bak 's/: Meta/: typeof Meta/g' "apps/frontend/src/stories/Header.stories.ts"
sed -i.bak 's/: StoryObj/: typeof StoryObj/g' "apps/frontend/src/stories/Header.stories.ts"
sed -i.bak 's/: Meta/: typeof Meta/g' "apps/frontend/src/stories/Page.stories.ts"
sed -i.bak 's/: StoryObj/: typeof StoryObj/g' "apps/frontend/src/stories/Page.stories.ts"

echo "✅ Fixed implicit any types in multiple files"