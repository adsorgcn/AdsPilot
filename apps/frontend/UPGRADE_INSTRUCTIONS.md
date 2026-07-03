# 🚀 Google-Monetize Frontend Upgrade Instructions

## ⚠️ Important: Read Before Proceeding

This upgrade includes major version changes:
- Next.js 14 → 15
- React 18 → 19
- Enhanced TypeScript configuration
- New dependencies (Tremor, Motion)

## 📋 Pre-Upgrade Checklist

- [ ] Backup current code (already on feature branch)
- [ ] Ensure all changes are committed
- [ ] Note current bundle size: `npm run analyze`
- [ ] Run current tests: `npm run test` (if available)

## 🔧 Installation Steps

### Step 1: Clean Install

```bash
# Navigate to frontend directory
cd apps/frontend

# Remove old dependencies
rm -rf node_modules package-lock.json

# Install new dependencies
npm install

# This may take 2-3 minutes
```

### Step 2: Verify Installation

```bash
# Check for any peer dependency warnings
npm list

# Verify Next.js version
npx next --version
# Should show: 15.1.3

# Verify React version
npm list react
# Should show: 19.0.0
```

### Step 3: Start Development Server

```bash
# Start with Turbopack (new in Next.js 15)
npm run dev

# You should see:
# ✓ Ready in Xms (Turbopack)
# ○ Local: http://localhost:3000
```

**Expected**: Server starts 5x faster than before!

### Step 4: Test Key Pages

Visit and verify these pages work:
- [ ] http://localhost:3000 (Landing page)
- [ ] http://localhost:3000/dashboard
- [ ] http://localhost:3000/offers
- [ ] http://localhost:3000/tasks
- [ ] http://localhost:3000/adscenter

### Step 5: Run Type Check

```bash
npm run typecheck
```

**Expected Issues**: You may see errors related to:
1. React 19 children prop (need to add explicit types)
2. Unused imports (due to verbatimModuleSyntax)

### Step 6: Build for Production

```bash
npm run build
```

**Expected**: Build should complete successfully. Note the bundle sizes.

## 🐛 Common Issues and Solutions

### Issue 1: React 19 Children Prop Error

**Error**: `Property 'children' does not exist on type 'Props'`

**Solution**: Add explicit children type:
```typescript
// ❌ Before
interface Props {
  title: string;
}

// ✅ After
interface Props {
  title: string;
  children?: React.ReactNode;
}
```

### Issue 2: Turbopack Compatibility

**Error**: `Turbopack doesn't support [some webpack feature]`

**Solution**: Temporarily disable Turbopack in next.config.js:
```javascript
experimental: {
  // turbo: { ... }, // Comment out
}
```

### Issue 3: Type Import Errors

**Error**: `Cannot use import statement outside a module`

**Solution**: Add `type` modifier to imports:
```typescript
// ❌ Before
import { SomeType } from './types';

// ✅ After
import type { SomeType } from './types';
```

### Issue 4: SWR Not Found

**Error**: `Cannot find module 'swr'`

**Solution**: This is expected - SWR has been removed. Migrate to TanStack Query:
```typescript
// ❌ Old (SWR)
const { data } = useSWR('/api/offers', fetcher);

// ✅ New (TanStack Query)
const { data } = useQuery({
  queryKey: ['offers'],
  queryFn: () => fetch('/api/offers').then(r => r.json()),
});
```

## 📊 Performance Verification

### Before Upgrade (Baseline)
- Dev server start: ~5-10 seconds
- HMR: ~1-2 seconds
- Build time: ~60-90 seconds
- Bundle size: ~280KB

### After Upgrade (Expected)
- Dev server start: ~1-2 seconds (5x faster) ✅
- HMR: ~100-200ms (10x faster) ✅
- Build time: ~45-60 seconds (30% faster) ✅
- Bundle size: ~280KB (will reduce after full migration)

### Measure Your Results

```bash
# Measure dev server start time
time npm run dev

# Measure build time
time npm run build

# Analyze bundle size
npm run analyze
```

## ✅ Success Criteria

Your upgrade is successful if:
- [ ] Dev server starts without errors
- [ ] All pages render correctly
- [ ] Type check passes (or only expected React 19 errors)
- [ ] Build completes successfully
- [ ] Dev server is noticeably faster
- [ ] HMR is instant

## 🔄 Rollback Plan

If you encounter critical issues:

```bash
# 1. Checkout previous commit
git checkout HEAD~1

# 2. Reinstall old dependencies
rm -rf node_modules package-lock.json
npm install

# 3. Verify old version works
npm run dev
```

## 📝 Next Steps

After successful upgrade:

1. **Day 2**: Prepare for Tailwind v4 (keep v3 for now)
2. **Day 3**: Introduce shadcn/ui components
3. **Day 4**: Migrate SWR hooks to TanStack Query
4. **Day 5**: Upgrade charts to Tremor and animations to Motion

## 🆘 Getting Help

If you encounter issues:

1. Check `MIGRATION_LOG.md` for known issues
2. Review the error message carefully
3. Search Next.js 15 or React 19 upgrade guides
4. Check the console for detailed error stack traces

## 📚 Additional Resources

- [Next.js 15 Release Notes](https://nextjs.org/blog/next-15)
- [React 19 Release Notes](https://react.dev/blog/2024/04/25/react-19)
- [Turbopack Documentation](https://nextjs.org/docs/architecture/turbopack)
- [TanStack Query v5 Docs](https://tanstack.com/query/latest)

---

**Good luck with the upgrade! 🚀**

The improvements in development speed alone make this upgrade worthwhile.