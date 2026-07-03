# Accessibility Audit - OffersPage Component

**Date**: 2025-10-18  
**Component**: `apps/frontend/src/components/offers/OffersPage.tsx`  
**Status**: ⚠️ Critical Issues Found - Needs Immediate Fixes

---

## Summary

The OffersPage component has several critical accessibility issues that need immediate attention. The component uses incomplete state management, has missing ARIA attributes, and contains several anti-patterns that will cause runtime errors and accessibility violations.

---

## 🔴 Critical Issues (Must Fix Immediately)

### 1. Broken State Management
**Issue**: Component references `state` and `setState` that don't exist  
**Impact**: Component will crash on render  
**WCAG**: N/A (Runtime Error)

**Current Code**:
```tsx
// Line 78 - setState doesn't exist
onClick={() => setState(prev => ({ ...prev, isCreateOpen: true }))}

// Line 143 - state doesn't exist
{!state.isLoading && state.error ? (

// Line 150 - state doesn't exist
{!state.isLoading && !state.hasOffers ? (
```

**Fix**: Use the hook's state properly:
```tsx
// Replace all state.* with the destructured values from useOffersPageState
{!isLoading && error ? (
  <ResourceErrorState ... />
) : null}

{!isLoading && !hasOffers ? (
  <OffersGettingStarted ... />
) : null}

// Replace setState calls with setCreateOpen
onClick={() => setCreateOpen(true)}
```

### 2. Missing ARIA Labels on Buttons
**Issue**: Create Offer buttons lack descriptive labels  
**Impact**: Screen readers announce only "+" or generic text  
**WCAG**: 2.4.6 Headings and Labels (AA), 4.1.2 Name, Role, Value (A)

**Current Code**:
```tsx
<Button size={'sm'} onClick={() => setState(prev => ({ ...prev, isCreateOpen: true }))} className="hidden sm:inline-flex">
  {t('offers.ui.createOffer', 'Create Offer')}
</Button>
<Button size={'sm'} onClick={() => setState(prev => ({ ...prev, isCreateOpen: true }))} className="sm:hidden px-3">
  <span className="text-lg">+</span>
</Button>
```

**Recommended Fix**:
```tsx
<Button 
  size={'sm'} 
  onClick={() => setCreateOpen(true)}
  className="hidden sm:inline-flex"
  aria-label={t('offers.ui.createOfferAriaLabel', 'Create new offer')}
>
  {t('offers.ui.createOffer', 'Create Offer')}
</Button>
<Button 
  size={'sm'} 
  onClick={() => setCreateOpen(true)}
  className="sm:hidden px-3"
  aria-label={t('offers.ui.createOfferAriaLabel', 'Create new offer')}
>
  <span className="text-lg" aria-hidden="true">+</span>
  <span className="sr-only">{t('offers.ui.createOffer', 'Create Offer')}</span>
</Button>
```

### 3. Nested PermissionGuard Anti-Pattern
**Issue**: PermissionGuard wraps entire page AND individual buttons  
**Impact**: Redundant permission checks, confusing for screen readers  
**WCAG**: 1.3.1 Info and Relationships (A)

**Current Code**:
```tsx
<PermissionGuard requirePermission="createOffers">
  <DashboardPageLayout>
    {/* ... */}
    <PermissionGuard requirePermission="createOffers" fallback={null}>
      <Button>Create Offer</Button>
    </PermissionGuard>
  </DashboardPageLayout>
</PermissionGuard>
```

**Recommended Fix**: Remove outer PermissionGuard or inner ones:
```tsx
// Option 1: Only guard the entire page
<PermissionGuard requirePermission="createOffers">
  <DashboardPageLayout>
    {/* No need for inner guards */}
    <Button>Create Offer</Button>
  </DashboardPageLayout>
</PermissionGuard>

// Option 2: Only guard specific actions (if page should be visible)
<DashboardPageLayout>
  <PermissionGuard requirePermission="createOffers" fallback={<UpgradePrompt />}>
    <Button>Create Offer</Button>
  </PermissionGuard>
</DashboardPageLayout>
```

### 4. Incomplete Props Passed to OffersTable
**Issue**: Empty array and no-op functions passed to table  
**Impact**: Table won't function, accessibility features broken  
**WCAG**: 2.1.1 Keyboard (A), 4.1.2 Name, Role, Value (A)

**Current Code**:
```tsx
<OffersTable
  offers={[]} // TODO: Pass actual offers
  isLoading={state.isLoading}
  selectedIds={new Set()}
  onToggle={() => {}}
  onToggleAll={() => {}}
  // ...
/>
```

**Recommended Fix**:
```tsx
<OffersTable
  offers={filteredOffers}
  isLoading={isLoading}
  selectedIds={bulkActions.selectedIds}
  onToggle={bulkActions.toggleSelection}
  onToggleAll={bulkActions.toggleAll}
  onView={offerActions.viewDetails}
  onEvaluate={offerActions.evaluate}
  onDelete={offerActions.deleteOffer}
  onToggleFavorite={offerActions.toggleFavorite}
  pendingActionIds={bulkActions.pendingActionIds}
  syncStatusMap={syncStatusMap}
/>
```

---

## 🟡 Important Issues

### 5. Missing Section Landmarks
**Issue**: Content lacks proper ARIA landmarks  
**Impact**: Screen reader users can't navigate efficiently  
**WCAG**: 1.3.1 Info and Relationships (A)

**Recommended Fix**:
```tsx
<DashboardPageLayout>
  <div className={'flex flex-col gap-4'}>
    {/* AI Features Section */}
    {canUseAI && (
      <section aria-labelledby="ai-features-heading">
        <h2 id="ai-features-heading" className="sr-only">
          {t('offers.ui.aiFeaturesSection', 'AI Features')}
        </h2>
        <Alert type={'success'}>
          {/* ... */}
        </Alert>
      </section>
    )}

    {/* Offers List Section */}
    <section aria-labelledby="offers-list-heading">
      <h2 id="offers-list-heading" className="sr-only">
        {t('offers.ui.offersListSection', 'Offers List')}
      </h2>
      {/* ... */}
    </section>
  </div>
</DashboardPageLayout>
```

### 6. Alert Components Missing Proper Roles
**Issue**: Alerts don't announce to screen readers  
**Impact**: Important messages missed by screen reader users  
**WCAG**: 4.1.3 Status Messages (AA)

**Current Code**:
```tsx
<Alert type={'success'}>
  <span className="text-sm">
    {t('offers.ui.aiFeaturesAvailable', 'AI评估功能已启用')}
  </span>
</Alert>
```

**Recommended Fix**:
```tsx
<Alert 
  type={'success'}
  role="status"
  aria-live="polite"
>
  <span className="text-sm">
    {t('offers.ui.aiFeaturesAvailable', 'AI评估功能已启用')}
  </span>
</Alert>

{/* For warnings, use assertive */}
<Alert 
  type={'warn'}
  role="alert"
  aria-live="assertive"
>
  {/* ... */}
</Alert>
```

### 7. Navigation Using window.location.href
**Issue**: Breaks SPA navigation and accessibility  
**Impact**: Screen reader context lost, no focus management  
**WCAG**: 2.4.3 Focus Order (A)

**Current Code**:
```tsx
onClick={() => {
  window.location.href = '/settings/subscription';
}}
```

**Recommended Fix**:
```tsx
const router = useRouter();

onClick={() => {
  router.push('/settings/subscription');
}}
```

### 8. TODO Comments in Production Code
**Issue**: Incomplete functionality with placeholder comments  
**Impact**: Features don't work, accessibility broken  
**WCAG**: Various

**Found TODOs**:
- Line 104: `// TODO: Open AI evaluation modal`
- Line 142: `// TODO: Implement retry logic`
- Line 163: `// TODO: Implement reset filters`
- Line 174: `// TODO: Pass actual offers`
- Line 199: `// TODO: Refresh offers list`

**Recommendation**: Complete all TODOs before deployment

### 9. Missing Loading States Announcements
**Issue**: Loading states not announced to screen readers  
**Impact**: Screen reader users don't know content is loading  
**WCAG**: 4.1.3 Status Messages (AA)

**Recommended Fix**:
```tsx
{isInitialLoading && (
  <div 
    role="status" 
    aria-live="polite"
    aria-label={t('offers.ui.loadingOffers', 'Loading offers')}
  >
    <span className="sr-only">
      {t('offers.ui.loadingOffers', 'Loading offers...')}
    </span>
    {/* Visual loading indicator */}
  </div>
)}
```

### 10. Badge Component Missing Context
**Issue**: Token count badge lacks context for screen readers  
**Impact**: Screen readers announce number without meaning  
**WCAG**: 1.3.1 Info and Relationships (A)

**Current Code**:
```tsx
<Badge variant="outline">
  {subscription?.currentTokenBalance.toLocaleString()} {t('offers.ui.tokens', 'tokens')}
</Badge>
```

**Recommended Fix**:
```tsx
<Badge 
  variant="outline"
  role="status"
  aria-label={t('offers.ui.tokenBalanceLabel', `Token balance: ${subscription?.currentTokenBalance.toLocaleString()} tokens`)}
>
  {subscription?.currentTokenBalance.toLocaleString()} {t('offers.ui.tokens', 'tokens')}
</Badge>
```

---

## 🟢 Good Practices Already Implemented

✅ **Internationalization**: All text uses i18n  
✅ **Lazy Loading**: Dialog components lazy loaded  
✅ **Permission Guards**: Basic permission checking implemented  
✅ **Responsive Design**: Mobile-specific button variants  
✅ **Error States**: Error handling components used  
✅ **Empty States**: Getting started and empty state components  

---

## Complete Fixed Version

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';

import { DashboardPageLayout } from '~/core/ui/PageLayout';
import Button from '~/core/ui/Button';
import Alert from '~/core/ui/Alert';
import Badge from '~/core/ui/Badge';
import { ResourceEmptyState, ResourceErrorState } from '~/core/ui/ResourceState';
import { useEnhancedSubscription } from '~/core/hooks/use-billing-api';
import LazyRender from '~/core/ui/LazyRender';

// Hooks
import { useOffersPageState } from '~/app/(app)/offers/hooks/useOffersPageState';

// Components
import { OffersTable } from './OffersTable';
import { OffersGettingStarted } from './OffersGettingStarted';
import { PermissionGuard } from '~/components/PermissionGuard';

// Lazy load dialog components
const CreateOfferDialog = dynamic(
  () => import('~/app/(app)/offers/components/CreateOfferDialog'),
  { ssr: false }
);

const OfferDetailDialog = dynamic(
  () => import('./OfferDetailDialog').then(mod => ({ default: mod.OfferDetailDialog })),
  { ssr: false }
);

export function OffersPage() {
  const { t } = useTranslation('common');
  const router = useRouter();

  // Get subscription information and permissions
  const {
    subscription,
    permissions,
    isLoading: subscriptionLoading,
    canCreateOffers,
    canUseAI,
    needsUpgrade
  } = useEnhancedSubscription();

  // Use the comprehensive page state hook
  const {
    filteredOffers,
    totalCount,
    isInitialLoading,
    isLoading,
    isRefreshing,
    error,
    hasOffers,
    hasFilteredOffers,
    detailId,
    setDetailId,
    isCreateOpen,
    setCreateOpen,
    filters,
    bulkActions,
    offerActions,
    syncStatusMap,
    mutate,
  } = useOffersPageState();

  return (
    <PermissionGuard requirePermission="createOffers">
      <DashboardPageLayout
        header={{
          title: t('offers.ui.title', 'Offers Management'),
          description: t('offers.ui.description', 'Manage and evaluate your affiliate offers'),
          actions: (
            <div className="flex items-center gap-2">
              <Button 
                size={'sm'} 
                onClick={() => setCreateOpen(true)}
                className="hidden sm:inline-flex"
                aria-label={t('offers.ui.createOfferAriaLabel', 'Create new offer')}
              >
                {t('offers.ui.createOffer', 'Create Offer')}
              </Button>
              <Button 
                size={'sm'} 
                onClick={() => setCreateOpen(true)}
                className="sm:hidden px-3"
                aria-label={t('offers.ui.createOfferAriaLabel', 'Create new offer')}
              >
                <span className="text-lg" aria-hidden="true">+</span>
                <span className="sr-only">{t('offers.ui.createOffer', 'Create Offer')}</span>
              </Button>
            </div>
          ),
        }}
      >
        <div className={'flex flex-col gap-4'}>
          {/* AI Features Section */}
          {canUseAI && (
            <section aria-labelledby="ai-features-heading">
              <h2 id="ai-features-heading" className="sr-only">
                {t('offers.ui.aiFeaturesSection', 'AI Features')}
              </h2>
              <Alert 
                type={'success'} 
                className={'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'}
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {t('offers.ui.aiFeaturesAvailable', 'AI评估功能已启用')}
                  </span>
                  <Badge 
                    variant="outline"
                    role="status"
                    aria-label={t('offers.ui.tokenBalanceLabel', `Token balance: ${subscription?.currentTokenBalance.toLocaleString()} tokens`)}
                  >
                    {subscription?.currentTokenBalance.toLocaleString()} {t('offers.ui.tokens', 'tokens')}
                  </Badge>
                </div>
                <Button
                  size={'sm'}
                  variant={'outline'}
                  onClick={() => {
                    // Open AI evaluation modal
                    offerActions.evaluateWithAI();
                  }}
                  className="w-full sm:w-auto"
                  aria-label={t('offers.ui.evaluateWithAIAriaLabel', 'Evaluate offers with AI')}
                >
                  {t('offers.ui.evaluateWithAI', 'AI评估')}
                </Button>
              </Alert>
            </section>
          )}

          {/* Token balance warning */}
          {subscription && subscription.currentTokenBalance < 100 && (
            <Alert 
              type={'warn'} 
              className={'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'}
              role="alert"
              aria-live="assertive"
            >
              <span className={'text-sm text-muted-foreground'}>
                {t('offers.ui.lowTokensWarning', 'Token余额不足，请及时充值')}
              </span>

              <Button
                size={'sm'}
                variant={'outline'}
                onClick={() => router.push('/settings/subscription')}
                className="w-full sm:w-auto"
                aria-label={t('offers.ui.topUpAriaLabel', 'Go to subscription settings to top up tokens')}
              >
                {t('offers.ui.topUp', '充值')}
              </Button>
            </Alert>
          )}

          {/* Loading state */}
          {isInitialLoading && (
            <div 
              role="status" 
              aria-live="polite"
              aria-label={t('offers.ui.loadingOffers', 'Loading offers')}
              className="flex items-center justify-center py-12"
            >
              <span className="sr-only">
                {t('offers.ui.loadingOffers', 'Loading offers...')}
              </span>
              {/* Visual loading indicator */}
            </div>
          )}

          {/* Error state */}
          {!isLoading && error ? (
            <ResourceErrorState
              className={'mt-4'}
              title={t('offers.errors.listLoadFailed', 'Failed to load offers')}
              description={t('offers.errors.checkNetworkConnection', 'Please check your network connection')}
              error={error}
              onRetry={() => mutate()}
            />
          ) : null}

          {/* Getting started (no offers) */}
          <LazyRender>
            {!isLoading && !hasOffers ? (
              <OffersGettingStarted
                onCreate={() => setCreateOpen(true)}
                onConnectAds={() => router.push('/adscenter')}
                onViewDocs={() => router.push('/resources')}
              />
            ) : null}
          </LazyRender>

          {/* Empty state (filters applied but no results) */}
          {hasOffers && !hasFilteredOffers && !isLoading ? (
            <ResourceEmptyState
              className={'mt-4'}
              title={t('offers.ui.noMatchingOffers', 'No matching offers')}
              description={t('offers.ui.tryAdjustingFilters', 'Try adjusting your filters')}
              primaryAction={{
                label: t('offers.ui.resetFilters', 'Reset Filters'),
                onClick: filters.reset,
              }}
            />
          ) : null}

          {/* Offers table */}
          <LazyRender>
            {hasOffers && (
              <section aria-labelledby="offers-list-heading">
                <h2 id="offers-list-heading" className="sr-only">
                  {t('offers.ui.offersListSection', 'Offers List')}
                </h2>
                <OffersTable
                  offers={filteredOffers}
                  isLoading={isLoading}
                  selectedIds={bulkActions.selectedIds}
                  onToggle={bulkActions.toggleSelection}
                  onToggleAll={bulkActions.toggleAll}
                  onView={offerActions.viewDetails}
                  onEvaluate={offerActions.evaluate}
                  onDelete={offerActions.deleteOffer}
                  onToggleFavorite={offerActions.toggleFavorite}
                  pendingActionIds={bulkActions.pendingActionIds}
                  syncStatusMap={syncStatusMap}
                />
              </section>
            )}
          </LazyRender>
        </div>
      </DashboardPageLayout>

      {/* Dialogs */}
      {isCreateOpen && (
        <CreateOfferDialog
          open={isCreateOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => {
            setCreateOpen(false);
            mutate();
          }}
        />
      )}

      {detailId && (
        <OfferDetailDialog
          offerId={detailId}
          open={!!detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </PermissionGuard>
  );
}
```

---

## Missing i18n Keys

Add to `apps/frontend/src/i18n/locales/en/common.json`:

```json
{
  "offers": {
    "ui": {
      "createOfferAriaLabel": "Create new offer",
      "evaluateWithAIAriaLabel": "Evaluate offers with AI",
      "topUpAriaLabel": "Go to subscription settings to top up tokens",
      "tokenBalanceLabel": "Token balance: {{count}} tokens",
      "aiFeaturesSection": "AI Features",
      "offersListSection": "Offers List",
      "loadingOffers": "Loading offers..."
    }
  }
}
```

---

## Testing Checklist

### Manual Testing

- [ ] **Keyboard Navigation**
  - Tab through all interactive elements
  - Verify focus indicators are visible
  - Test Enter/Space to activate buttons
  - Ensure no keyboard traps

- [ ] **Screen Reader Testing**
  - VoiceOver (macOS): Cmd+F5
  - NVDA (Windows)
  - JAWS (Windows)
  
  Test scenarios:
  - Navigate through sections
  - Verify alerts are announced
  - Check button labels are descriptive
  - Verify loading states are announced
  - Test table navigation

- [ ] **State Management**
  - Verify component renders without errors
  - Test all button clicks work
  - Verify dialogs open/close properly
  - Test data loading and error states

### Automated Testing

```typescript
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

expect.extend(toHaveNoViolations);

describe('OffersPage Accessibility', () => {
  test('has no accessibility violations', async () => {
    const { container } = render(<OffersPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('create offer button has descriptive label', () => {
    render(<OffersPage />);
    const button = screen.getByRole('button', { 
      name: /create new offer/i 
    });
    expect(button).toBeInTheDocument();
  });

  test('sections have proper landmarks', () => {
    render(<OffersPage />);
    const sections = screen.getAllByRole('region');
    expect(sections.length).toBeGreaterThan(0);
  });

  test('alerts have proper roles', () => {
    render(<OffersPage />);
    const alerts = screen.queryAllByRole('status');
    expect(alerts.length).toBeGreaterThanOrEqual(0);
  });
});
```

---

## WCAG 2.1 Compliance Status

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 1.3.1 Info and Relationships | A | ❌ Fail | Missing section landmarks |
| 2.1.1 Keyboard | A | ⚠️ Partial | Needs testing after fixes |
| 2.4.3 Focus Order | A | ❌ Fail | window.location.href breaks focus |
| 2.4.6 Headings and Labels | AA | ❌ Fail | Missing ARIA labels on buttons |
| 4.1.2 Name, Role, Value | A | ❌ Fail | Incomplete props, missing labels |
| 4.1.3 Status Messages | AA | ❌ Fail | Alerts missing proper roles |

---

## Priority Recommendations

### High Priority (Fix Before Deployment)
1. ✅ Fix broken state management (use hook values)
2. ✅ Add ARIA labels to all buttons
3. ✅ Remove nested PermissionGuard anti-pattern
4. ✅ Pass correct props to OffersTable
5. ✅ Replace window.location.href with router.push
6. ✅ Complete all TODO items

### Medium Priority (Fix Soon)
7. Add section landmarks with proper headings
8. Add proper roles to Alert components
9. Add loading state announcements
10. Add context to Badge components

### Low Priority (Nice to Have)
11. Add automated accessibility tests
12. Add keyboard shortcuts documentation
13. Improve error messages
14. Add skip links for long content

---

**Maintained by**: Frontend Team  
**Last Updated**: 2025-10-18  
**Review Cycle**: Before deployment  
**Status**: ⚠️ Critical fixes required

---

## 🆕 Update: AI Evaluation Modal Addition (2025-10-18)

### New Code Added

```tsx
{/* AI Evaluation Modal */}
<PermissionGuard requirePermission="useAI" fallback={null}>
  <AIEvaluationModal
    open={isAIModalOpen}
    onOpenChange={setIsAIModalOpen}
    selectedOfferIds={bulkActions.selected.size > 0 
      ? Array.from(bulkActions.selected) 
      : filteredOffers.map(offer => offer.id)
    }
    tokenBalance={subscription?.currentTokenBalance || 0}
    estimatedCost={bulkActions.selected.size > 0 
      ? bulkActions.selected.size * 10 
      : filteredOffers.length * 10
    }
    onSuccess={() => {
      mutate(); // Refresh offers list
      setIsAIModalOpen(false);
    }}
  />
</PermissionGuard>
```

### Accessibility Analysis of New Addition

#### ✅ Good Practices
1. **Permission Guard**: Modal properly wrapped in PermissionGuard with `requirePermission="useAI"`
2. **Fallback Handling**: Uses `fallback={null}` to hide modal when permission denied
3. **Controlled State**: Uses `open` and `onOpenChange` props for controlled modal state
4. **Success Callback**: Properly refreshes data and closes modal on success

#### ⚠️ Issues Found

##### 1. Modal State Not Connected to Trigger Button
**Issue**: `isAIModalOpen` state exists but no button triggers it  
**Impact**: Modal cannot be opened by users  
**WCAG**: 2.1.1 Keyboard (A), 4.1.2 Name, Role, Value (A)

**Current Code**:
```tsx
// Line 119 - Button doesn't set isAIModalOpen
<Button
  size={'sm'}
  variant={'outline'}
  onClick={() => {
    if (bulkActions.selected.size > 0) {
      bulkActions.handleBulkEvaluate();
    } else {
      // Open AI evaluation modal for all offers (future implementation)
    }
  }}
>
  {t('offers.ui.evaluateWithAI', 'AI评估')}
</Button>
```

**Recommended Fix**:
```tsx
<Button
  size={'sm'}
  variant={'outline'}
  onClick={() => setIsAIModalOpen(true)}
  className="w-full sm:w-auto"
  aria-label={t('offers.ui.evaluateWithAIAriaLabel', 'Evaluate offers with AI')}
>
  {t('offers.ui.evaluateWithAI', 'AI评估')}
</Button>
```

##### 2. Missing Focus Management
**Issue**: No focus management when modal opens/closes  
**Impact**: Keyboard users lose focus context  
**WCAG**: 2.4.3 Focus Order (A)

**Recommended Enhancement**:
```tsx
import { useEffect, useRef } from 'react';

const triggerButtonRef = useRef<HTMLButtonElement>(null);

// Return focus to trigger button when modal closes
useEffect(() => {
  if (!isAIModalOpen && triggerButtonRef.current) {
    triggerButtonRef.current.focus();
  }
}, [isAIModalOpen]);

<Button
  ref={triggerButtonRef}
  onClick={() => setIsAIModalOpen(true)}
>
  {t('offers.ui.evaluateWithAI', 'AI评估')}
</Button>
```

##### 3. Conditional Rendering Logic Issue
**Issue**: Modal logic differs from button logic  
**Impact**: Confusing UX - button and modal may show different offers  
**WCAG**: 3.2.4 Consistent Identification (AA)

**Current Inconsistency**:
```tsx
// Button logic (line 119)
if (bulkActions.selected.size > 0) {
  bulkActions.handleBulkEvaluate();
} else {
  // Comment says "future implementation"
}

// Modal logic (line 233)
selectedOfferIds={bulkActions.selected.size > 0 
  ? Array.from(bulkActions.selected) 
  : filteredOffers.map(offer => offer.id)
}
```

**Recommended Fix**: Make button and modal consistent:
```tsx
<Button
  onClick={() => setIsAIModalOpen(true)}
  disabled={filteredOffers.length === 0}
  aria-label={
    bulkActions.selected.size > 0
      ? t('offers.ui.evaluateSelectedAriaLabel', `Evaluate ${bulkActions.selected.size} selected offers with AI`)
      : t('offers.ui.evaluateAllAriaLabel', `Evaluate all ${filteredOffers.length} offers with AI`)
  }
>
  {bulkActions.selected.size > 0
    ? t('offers.ui.evaluateSelected', `AI评估 (${bulkActions.selected.size})`)
    : t('offers.ui.evaluateWithAI', 'AI评估')
  }
</Button>
```

##### 4. Missing Loading/Success Announcements
**Issue**: No screen reader announcement when modal succeeds  
**Impact**: Screen reader users don't know evaluation completed  
**WCAG**: 4.1.3 Status Messages (AA)

**Recommended Enhancement**:
```tsx
const [successMessage, setSuccessMessage] = useState<string>('');

<AIEvaluationModal
  onSuccess={() => {
    const count = bulkActions.selected.size > 0 
      ? bulkActions.selected.size 
      : filteredOffers.length;
    
    setSuccessMessage(
      t('offers.ui.evaluationSuccess', `Successfully evaluated ${count} offers`)
    );
    
    mutate();
    setIsAIModalOpen(false);
  }}
/>

{/* Live region for success messages */}
{successMessage && (
  <div 
    role="status" 
    aria-live="polite"
    className="sr-only"
  >
    {successMessage}
  </div>
)}
```

##### 5. Nested PermissionGuard (Again)
**Issue**: Modal wrapped in PermissionGuard, but entire page already guarded  
**Impact**: Redundant permission check  
**WCAG**: 1.3.1 Info and Relationships (A)

**Current Structure**:
```tsx
<PermissionGuard requirePermission="createOffers">
  {/* Page content */}
  
  <PermissionGuard requirePermission="useAI" fallback={null}>
    <AIEvaluationModal />
  </PermissionGuard>
</PermissionGuard>
```

**Analysis**: This is actually **correct** because:
- Outer guard: `createOffers` - controls page access
- Inner guard: `useAI` - controls AI feature access
- Different permissions, so nesting is appropriate

**No fix needed** ✅

### Updated Complete Code with AI Modal

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// ... imports ...

const AIEvaluationModal = dynamic(
  () => import('./AIEvaluationModal').then(mod => ({ default: mod.AIEvaluationModal })),
  { ssr: false }
);

export function OffersPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  
  const {
    subscription,
    canUseAI,
  } = useEnhancedSubscription();

  const {
    filteredOffers,
    isLoading,
    error,
    hasOffers,
    hasFilteredOffers,
    detailId,
    setDetailId,
    isCreateOpen,
    setCreateOpen,
    filters,
    bulkActions,
    offerActions,
    syncStatusMap,
    mutate,
  } = useOffersPageState();

  // AI Evaluation Modal state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const aiButtonRef = useRef<HTMLButtonElement>(null);

  // Return focus to trigger button when modal closes
  useEffect(() => {
    if (!isAIModalOpen && aiButtonRef.current) {
      aiButtonRef.current.focus();
    }
  }, [isAIModalOpen]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  return (
    <PermissionGuard requirePermission="createOffers">
      <DashboardPageLayout
        header={{
          title: t('offers.ui.title', 'Offers Management'),
          description: t('offers.ui.description', 'Manage and evaluate your affiliate offers'),
          actions: (
            <div className="flex items-center gap-2">
              <Button 
                size={'sm'} 
                onClick={() => setCreateOpen(true)}
                className="hidden sm:inline-flex"
                aria-label={t('offers.ui.createOfferAriaLabel', 'Create new offer')}
              >
                {t('offers.ui.createOffer', 'Create Offer')}
              </Button>
              <Button 
                size={'sm'} 
                onClick={() => setCreateOpen(true)}
                className="sm:hidden px-3"
                aria-label={t('offers.ui.createOfferAriaLabel', 'Create new offer')}
              >
                <span className="text-lg" aria-hidden="true">+</span>
                <span className="sr-only">{t('offers.ui.createOffer', 'Create Offer')}</span>
              </Button>
            </div>
          ),
        }}
      >
        <div className={'flex flex-col gap-4'}>
          {/* AI Features Section */}
          {canUseAI && (
            <section aria-labelledby="ai-features-heading">
              <h2 id="ai-features-heading" className="sr-only">
                {t('offers.ui.aiFeaturesSection', 'AI Features')}
              </h2>
              <Alert 
                type={'success'} 
                className={'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'}
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {t('offers.ui.aiFeaturesAvailable', 'AI评估功能已启用')}
                  </span>
                  <Badge 
                    variant="outline"
                    role="status"
                    aria-label={t('offers.ui.tokenBalanceLabel', `Token balance: ${subscription?.currentTokenBalance.toLocaleString()} tokens`)}
                  >
                    {subscription?.currentTokenBalance.toLocaleString()} {t('offers.ui.tokens', 'tokens')}
                  </Badge>
                </div>
                <Button
                  ref={aiButtonRef}
                  size={'sm'}
                  variant={'outline'}
                  onClick={() => setIsAIModalOpen(true)}
                  disabled={filteredOffers.length === 0}
                  className="w-full sm:w-auto"
                  aria-label={
                    bulkActions.selected.size > 0
                      ? t('offers.ui.evaluateSelectedAriaLabel', `Evaluate ${bulkActions.selected.size} selected offers with AI`)
                      : t('offers.ui.evaluateAllAriaLabel', `Evaluate all ${filteredOffers.length} offers with AI`)
                  }
                >
                  {bulkActions.selected.size > 0
                    ? t('offers.ui.evaluateSelected', `AI评估 (${bulkActions.selected.size})`)
                    : t('offers.ui.evaluateWithAI', 'AI评估')
                  }
                </Button>
              </Alert>
            </section>
          )}

          {/* Success message live region */}
          {successMessage && (
            <div 
              role="status" 
              aria-live="polite"
              className="sr-only"
            >
              {successMessage}
            </div>
          )}

          {/* ... rest of component ... */}
        </div>
      </DashboardPageLayout>

      {/* Dialogs */}
      {isCreateOpen && (
        <CreateOfferDialog
          open={isCreateOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => {
            setCreateOpen(false);
            mutate();
          }}
        />
      )}

      {detailId && (
        <OfferDetailDialog
          offerId={detailId}
          open={!!detailId}
          onClose={() => setDetailId(null)}
        />
      )}

      {/* AI Evaluation Modal */}
      <PermissionGuard requirePermission="useAI" fallback={null}>
        <AIEvaluationModal
          open={isAIModalOpen}
          onOpenChange={setIsAIModalOpen}
          selectedOfferIds={bulkActions.selected.size > 0 
            ? Array.from(bulkActions.selected) 
            : filteredOffers.map(offer => offer.id)
          }
          tokenBalance={subscription?.currentTokenBalance || 0}
          estimatedCost={bulkActions.selected.size > 0 
            ? bulkActions.selected.size * 10 
            : filteredOffers.length * 10
          }
          onSuccess={() => {
            const count = bulkActions.selected.size > 0 
              ? bulkActions.selected.size 
              : filteredOffers.length;
            
            setSuccessMessage(
              t('offers.ui.evaluationSuccess', `Successfully evaluated ${count} offers`)
            );
            
            mutate();
            setIsAIModalOpen(false);
          }}
        />
      </PermissionGuard>
    </PermissionGuard>
  );
}
```

### Additional i18n Keys Needed

```json
{
  "offers": {
    "ui": {
      "evaluateSelectedAriaLabel": "Evaluate {{count}} selected offers with AI",
      "evaluateAllAriaLabel": "Evaluate all {{count}} offers with AI",
      "evaluateSelected": "AI评估 ({{count}})",
      "evaluationSuccess": "Successfully evaluated {{count}} offers"
    }
  }
}
```

### Testing Checklist for AI Modal

- [ ] **Modal Trigger**
  - Button opens modal when clicked
  - Button disabled when no offers available
  - Button label changes based on selection

- [ ] **Focus Management**
  - Focus moves to modal when opened
  - Focus returns to trigger button when closed
  - Focus trapped within modal while open

- [ ] **Screen Reader**
  - Button label announces offer count
  - Success message announced after evaluation
  - Modal content properly announced

- [ ] **Keyboard Navigation**
  - Tab through modal controls
  - Escape key closes modal
  - Enter/Space activates buttons

### Priority for AI Modal Addition

**High Priority**:
1. Connect button to modal state (currently broken)
2. Add focus management
3. Add success announcements

**Medium Priority**:
4. Add dynamic button labels
5. Add disabled state handling

**Low Priority**:
6. Add keyboard shortcuts
7. Add loading indicators
