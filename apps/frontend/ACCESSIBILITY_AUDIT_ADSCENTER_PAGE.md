# Accessibility Audit - AdsCenterPage Component

**Date**: 2025-10-18  
**Component**: `apps/frontend/src/components/ads-center/AdsCenterPage.tsx`  
**Status**: ⚠️ Needs Critical Improvements

---

## Summary

The AdsCenterPage component has several critical accessibility issues that need immediate attention. The recent modifications improved error handling and user feedback but introduced new accessibility concerns with the `confirm()` dialog and missing toast imports.

---

## 🔴 Critical Issues

### 1. Missing Import for Toast Notifications
**Issue**: `toast` is used but not imported  
**Impact**: Code will fail at runtime  
**WCAG**: N/A (Code Error)

**Current Code** (Lines 58, 61, 76, 79, 81):
```typescript
toast.success(t('adsCenter.success.accountRefreshed', 'Account refreshed successfully'));
toast.error(t('adsCenter.errors.refreshFailed', 'Failed to refresh account'));
```

**Fix Required**:
```typescript
import { toast } from 'sonner'; // or your toast library
// OR
import { useToast } from '~/core/hooks/use-toast';
```

### 2. Missing Import for Router
**Issue**: `router` is used but not imported  
**Impact**: Code will fail at runtime  
**WCAG**: N/A (Code Error)

**Current Code** (Line 87):
```typescript
router.push(`/adscenter/accounts/${accountId}/settings`);
```

**Fix Required**:
```typescript
import { useRouter } from 'next/navigation';

// In component:
const router = useRouter();
```

### 3. Native `confirm()` Dialog - Not Accessible
**Issue**: Using browser's native `confirm()` dialog  
**Impact**: Not keyboard accessible, poor screen reader support, no customization  
**WCAG**: 2.1.1 Keyboard (A), 4.1.2 Name, Role, Value (A)

**Current Code** (Line 68):
```typescript
if (!confirm(t('adsCenter.confirmations.deleteAccount', 'Are you sure...'))) {
  return;
}
```

**Recommended Fix**:
```typescript
// Use a custom accessible dialog component
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const [accountToDelete, setAccountToDelete] = useState<string | null>(null);

const handleDeleteAccount = async (accountId: string) => {
  setAccountToDelete(accountId);
  setDeleteDialogOpen(true);
};

const confirmDelete = async () => {
  if (!accountToDelete) return;
  
  try {
    // Delete logic
    setConnectedAccounts((prev) => prev.filter((acc) => acc.id !== accountToDelete));
    toast.success(t('adsCenter.success.accountDeleted'));
  } catch (error) {
    toast.error(t('adsCenter.errors.deleteFailed'));
  } finally {
    setDeleteDialogOpen(false);
    setAccountToDelete(null);
  }
};

// In JSX:
<ConfirmDialog
  open={deleteDialogOpen}
  onOpenChange={setDeleteDialogOpen}
  onConfirm={confirmDelete}
  title={t('adsCenter.confirmations.deleteTitle', 'Disconnect Account')}
  description={t('adsCenter.confirmations.deleteAccount')}
  confirmText={t('common.disconnect', 'Disconnect')}
  cancelText={t('common.cancel', 'Cancel')}
/>
```


### 4. Missing ARIA Labels on Platform Cards
**Issue**: Platform connection cards lack descriptive ARIA labels  
**Impact**: Screen reader users don't get sufficient context  
**WCAG**: 2.4.6 Headings and Labels (AA), 4.1.2 Name, Role, Value (A)

**Current Code** (Lines 136-160):
```typescript
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
        <span className="text-blue-600 font-bold text-sm">G</span>
      </div>
      Google Ads
    </CardTitle>
  </CardHeader>
  <CardContent>
    <Button onClick={() => setShowOAuthFlow('google')}>
      {t('adsCenter.ui.connectGoogleAds')}
    </Button>
  </CardContent>
</Card>
```

**Recommended Fix**:
```typescript
<Card role="article" aria-labelledby="google-ads-title">
  <CardHeader>
    <CardTitle id="google-ads-title" className="flex items-center gap-2">
      <div 
        className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="text-blue-600 font-bold text-sm">G</span>
      </div>
      Google Ads
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground mb-4">
      {t('adsCenter.ui.googleAdsDesc')}
    </p>
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={() => setShowOAuthFlow('google')}
      aria-label={t('adsCenter.ui.connectGoogleAdsAriaLabel', 'Connect Google Ads account')}
    >
      {t('adsCenter.ui.connectGoogleAds')}
    </Button>
  </CardContent>
</Card>
```

### 5. Decorative Icons Not Hidden from Screen Readers
**Issue**: Platform logo divs are decorative but announced by screen readers  
**Impact**: Redundant announcements  
**WCAG**: 1.1.1 Non-text Content (A)

**Current Code** (Lines 140-142, 165-167, 190-192):
```typescript
<div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
  <span className="text-blue-600 font-bold text-sm">G</span>
</div>
```

**Fix**: Add `aria-hidden="true"` to all decorative icon containers (shown in fix #4 above)

### 6. Feature List Bullets - Decorative Elements
**Issue**: Green dot indicators are decorative but not hidden  
**Impact**: Screen readers may announce them unnecessarily  
**WCAG**: 1.1.1 Non-text Content (A)

**Current Code** (Lines 248-251):
```typescript
<div className="flex items-start gap-3">
  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
  <div>
    <div className="font-medium">{t('adsCenter.ui.realTimeSync')}</div>
```

**Recommended Fix**:
```typescript
<div className="flex items-start gap-3">
  <div 
    className="w-2 h-2 bg-green-500 rounded-full mt-2" 
    aria-hidden="true"
  ></div>
  <div>
    <div className="font-medium">{t('adsCenter.ui.realTimeSync')}</div>
```

---

## 🟡 Important Issues

### 7. Missing Section Landmarks
**Issue**: Major content sections lack proper ARIA landmarks  
**Impact**: Screen reader users can't efficiently navigate  
**WCAG**: 1.3.1 Info and Relationships (A)

**Recommended Fix**:
```typescript
<DashboardPageLayout>
  <div className={'flex flex-col gap-6'}>
    {/* Subscription status */}
    <section aria-labelledby="subscription-status-heading">
      <h2 id="subscription-status-heading" className="sr-only">
        {t('adsCenter.ui.subscriptionStatus', 'Subscription Status')}
      </h2>
      {subscription && canManageAds && (
        <Alert type={'success'}>
          {/* ... */}
        </Alert>
      )}
    </section>

    {/* Platform connections */}
    <section aria-labelledby="platform-connections-heading">
      <h2 id="platform-connections-heading" className="sr-only">
        {t('adsCenter.ui.platformConnections', 'Platform Connections')}
      </h2>
      <LazyRender>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Platform cards */}
        </div>
      </LazyRender>
    </section>

    {/* Connected accounts */}
    <section aria-labelledby="connected-accounts-heading">
      <h2 id="connected-accounts-heading" className="sr-only">
        {t('adsCenter.ui.connectedAccounts', 'Connected Accounts')}
      </h2>
      <AdsAccountsList />
    </section>

    {/* Features */}
    <section aria-labelledby="features-heading">
      {/* Features card already has CardTitle */}
    </section>
  </div>
</DashboardPageLayout>
```


### 8. Missing Loading State Announcements
**Issue**: Loading states not announced to screen readers  
**Impact**: Screen reader users don't know when operations are in progress  
**WCAG**: 4.1.3 Status Messages (AA)

**Current Code** (Lines 54-62):
```typescript
const handleRefreshAccount = async (accountId: string) => {
  setIsLoading(true);
  try {
    await mutate();
    toast.success(t('adsCenter.success.accountRefreshed'));
  } finally {
    setIsLoading(false);
  }
};
```

**Recommended Fix**:
```typescript
// Add live region for status updates
<div 
  role="status" 
  aria-live="polite" 
  aria-atomic="true"
  className="sr-only"
>
  {isLoading && t('adsCenter.ui.loading', 'Loading...')}
</div>

// Or use aria-busy on the component being updated
<AdsAccountsList
  accounts={connectedAccounts}
  isLoading={isLoading}
  aria-busy={isLoading}
  aria-label={t('adsCenter.ui.accountsList', 'Advertising accounts list')}
  onRefresh={handleRefreshAccount}
  onDelete={handleDeleteAccount}
  onConfigure={handleConfigureAccount}
/>
```

### 9. Missing Focus Management After Actions
**Issue**: Focus not managed after delete/refresh actions  
**Impact**: Keyboard users lose context after actions  
**WCAG**: 2.4.3 Focus Order (A)

**Recommended Fix**:
```typescript
import { useRef } from 'react';

const accountsListRef = useRef<HTMLDivElement>(null);

const handleDeleteAccount = async (accountId: string) => {
  // ... delete logic ...
  
  // Return focus to accounts list after deletion
  setTimeout(() => {
    accountsListRef.current?.focus();
  }, 100);
};

// In JSX:
<div ref={accountsListRef} tabIndex={-1}>
  <AdsAccountsList />
</div>
```

### 10. Alert Component Accessibility
**Issue**: Success alert may not be announced properly  
**Impact**: Screen reader users may miss important status information  
**WCAG**: 4.1.3 Status Messages (AA)

**Current Code** (Lines 107-120):
```typescript
<Alert type={'success'}>
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div className="text-sm">
      <strong>{t('adsCenter.ui.premiumFeatures')}</strong>
      <p className="text-muted-foreground mt-1">
        {t('adsCenter.ui.unlimitedAccounts')}
      </p>
    </div>
    <Badge variant="outline">
      {subscription.tier} {t('adsCenter.ui.plan')}
    </Badge>
  </div>
</Alert>
```

**Recommended Fix**:
```typescript
<Alert 
  type={'success'}
  role="status"
  aria-live="polite"
  aria-label={t('adsCenter.ui.subscriptionStatusLabel', 'Subscription status information')}
>
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div className="text-sm">
      <strong>{t('adsCenter.ui.premiumFeatures')}</strong>
      <p className="text-muted-foreground mt-1">
        {t('adsCenter.ui.unlimitedAccounts')}
      </p>
    </div>
    <Badge variant="outline" aria-label={`${subscription.tier} ${t('adsCenter.ui.plan')}`}>
      {subscription.tier} {t('adsCenter.ui.plan')}
    </Badge>
  </div>
</Alert>
```

---

## 🟢 Good Practices Already Implemented

✅ **Internationalization**: All text uses i18n  
✅ **Permission Guards**: Proper permission checking  
✅ **Semantic Components**: Uses Card, Button, Alert components  
✅ **Error Handling**: Try-catch blocks for async operations  
✅ **User Feedback**: Toast notifications for success/error  
✅ **Lazy Loading**: Uses LazyRender for performance  
✅ **Responsive Design**: Grid layouts with responsive breakpoints  

---

## 📋 Recommended Improvements

### 1. Add Missing Imports

```typescript
'use client';

import { useTranslation } from 'react-i18next';
import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation'; // ✅ Add this
import { toast } from 'sonner'; // ✅ Add this (or your toast library)

// ... rest of imports
```

### 2. Replace Native Confirm with Accessible Dialog

```typescript
import { ConfirmDialog } from '~/core/ui/ConfirmDialog';

export function AdsCenterPage() {
  // ... existing state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const router = useRouter();

  const handleDeleteAccount = async (accountId: string) => {
    setAccountToDelete(accountId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!accountToDelete) return;
    
    try {
      setConnectedAccounts((prev) => 
        prev.filter((acc) => acc.id !== accountToDelete)
      );
      toast.success(t('adsCenter.success.accountDeleted'));
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error(t('adsCenter.errors.deleteFailed'));
    } finally {
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    }
  };

  return (
    <>
      {/* Main content */}
      <PermissionGuard requirePermission="manageAds">
        {/* ... */}
      </PermissionGuard>

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title={t('adsCenter.confirmations.deleteTitle', 'Disconnect Account')}
        description={t('adsCenter.confirmations.deleteAccount')}
        confirmText={t('common.disconnect', 'Disconnect')}
        cancelText={t('common.cancel', 'Cancel')}
        variant="destructive"
      />
    </>
  );
}
```


### 3. Add Comprehensive ARIA Labels

```typescript
// Add to i18n files
{
  "adsCenter": {
    "ui": {
      "subscriptionStatus": "Subscription Status",
      "platformConnections": "Platform Connections",
      "connectedAccounts": "Connected Accounts",
      "accountsList": "Advertising accounts list",
      "loading": "Loading...",
      "connectGoogleAdsAriaLabel": "Connect Google Ads account",
      "connectFacebookAdsAriaLabel": "Connect Facebook Ads account",
      "connectTikTokAdsAriaLabel": "Connect TikTok Ads account",
      "subscriptionStatusLabel": "Subscription status information"
    },
    "confirmations": {
      "deleteTitle": "Disconnect Account",
      "deleteAccount": "Are you sure you want to disconnect this account? This action cannot be undone."
    }
  }
}
```

### 4. Add Live Region for Status Updates

```typescript
export function AdsCenterPage() {
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleRefreshAccount = async (accountId: string) => {
    setIsLoading(true);
    setStatusMessage(t('adsCenter.ui.refreshing', 'Refreshing account...'));
    
    try {
      await mutate();
      setStatusMessage(t('adsCenter.success.accountRefreshed'));
      toast.success(t('adsCenter.success.accountRefreshed'));
    } catch (error) {
      setStatusMessage(t('adsCenter.errors.refreshFailed'));
      toast.error(t('adsCenter.errors.refreshFailed'));
    } finally {
      setIsLoading(false);
      // Clear message after announcement
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  return (
    <PermissionGuard requirePermission="manageAds">
      {/* Live region for status announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage}
      </div>

      <DashboardPageLayout>
        {/* ... rest of content */}
      </DashboardPageLayout>
    </PermissionGuard>
  );
}
```

### 5. Improve Platform Cards Accessibility

```typescript
{/* Google Ads Card */}
<Card role="article" aria-labelledby="google-ads-title">
  <CardHeader>
    <CardTitle id="google-ads-title" className="flex items-center gap-2">
      <div 
        className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="text-blue-600 font-bold text-sm">G</span>
      </div>
      Google Ads
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground mb-4">
      {t('adsCenter.ui.googleAdsDesc')}
    </p>
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={() => setShowOAuthFlow('google')}
      aria-label={t('adsCenter.ui.connectGoogleAdsAriaLabel')}
    >
      {t('adsCenter.ui.connectGoogleAds')}
    </Button>
  </CardContent>
</Card>
```

---

## 🧪 Testing Checklist

### Manual Testing

- [ ] **Fix Runtime Errors**
  - Import `toast` from toast library
  - Import `useRouter` from next/navigation
  - Verify no console errors

- [ ] **Keyboard Navigation**
  - Tab through all interactive elements
  - Verify focus indicators are visible
  - Test Enter/Space to activate buttons
  - Ensure no keyboard traps
  - Test Escape to close dialogs

- [ ] **Screen Reader Testing**
  - VoiceOver (macOS): Cmd+F5
  - NVDA (Windows): Free download
  - JAWS (Windows): Commercial
  
  Test scenarios:
  - Navigate through platform cards
  - Verify card titles are announced
  - Check button labels are descriptive
  - Verify loading states are announced
  - Test confirmation dialog
  - Check toast notifications are announced

- [ ] **Confirmation Dialog**
  - Replace native `confirm()` with accessible dialog
  - Test keyboard navigation (Tab, Escape, Enter)
  - Verify focus trap within dialog
  - Test focus return after close
  - Verify ARIA attributes

- [ ] **Focus Management**
  - Test focus after delete action
  - Test focus after refresh action
  - Verify focus visible at all times

### Automated Testing

```typescript
// Example test with @testing-library/react
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

expect.extend(toHaveNoViolations);

describe('AdsCenterPage Accessibility', () => {
  test('has no accessibility violations', async () => {
    const { container } = render(<AdsCenterPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('platform cards have proper labels', () => {
    render(<AdsCenterPage />);
    
    const googleCard = screen.getByRole('article', { 
      name: /google ads/i 
    });
    expect(googleCard).toBeInTheDocument();
  });

  test('connect buttons have descriptive labels', () => {
    render(<AdsCenterPage />);
    
    const googleButton = screen.getByRole('button', { 
      name: /connect google ads account/i 
    });
    expect(googleButton).toBeInTheDocument();
  });

  test('decorative icons are hidden from screen readers', () => {
    const { container } = render(<AdsCenterPage />);
    const decorativeIcons = container.querySelectorAll('[aria-hidden="true"]');
    expect(decorativeIcons.length).toBeGreaterThan(0);
  });

  test('loading state is announced', async () => {
    render(<AdsCenterPage />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await userEvent.click(refreshButton);
    
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/loading/i);
  });

  test('confirmation dialog is accessible', async () => {
    render(<AdsCenterPage />);
    
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(deleteButton);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
  });
});
```

---

## 📊 WCAG 2.1 Compliance Status

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 1.1.1 Non-text Content | A | ⚠️ Partial | Need aria-hidden on decorative icons |
| 1.3.1 Info and Relationships | A | ⚠️ Partial | Need section landmarks |
| 2.1.1 Keyboard | A | ❌ Fail | Native confirm() not keyboard accessible |
| 2.4.3 Focus Order | A | ⚠️ Partial | Need focus management after actions |
| 2.4.6 Headings and Labels | AA | ⚠️ Partial | Need descriptive button labels |
| 4.1.2 Name, Role, Value | A | ❌ Fail | Native confirm() lacks proper ARIA |
| 4.1.3 Status Messages | AA | ❌ Fail | Missing live regions for updates |

---

## 🎯 Priority Recommendations

### High Priority (Fix Immediately)
1. ✅ Add missing imports (`toast`, `useRouter`)
2. ✅ Replace native `confirm()` with accessible dialog
3. ✅ Add `aria-hidden="true"` to decorative icons
4. ✅ Add live region for status announcements
5. ✅ Add ARIA labels to platform connection buttons

### Medium Priority (Fix Soon)
6. Add section landmarks with proper headings
7. Implement focus management after actions
8. Add `role="status"` to Alert component
9. Add comprehensive i18n keys for ARIA labels
10. Test with screen readers

### Low Priority (Nice to Have)
11. Add keyboard shortcuts for common actions
12. Implement skip links for long content
13. Add automated accessibility tests
14. Document accessibility features
15. Create accessibility testing guide

---

## 📚 Related Issues

- See: `apps/frontend/ACCESSIBILITY_AUDIT_DASHBOARD_AGGREGATES.md`
- See: `apps/frontend/ACCESSIBILITY_AUDIT_TASKS_TABLE.md`
- See: `apps/frontend/ACCESSIBILITY_AUDIT_OFFERS_PAGE.md`
- See: `apps/frontend/ACCESSIBILITY_IMPROVEMENTS_PRICING.md`

---

## 📖 Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Accessibility Docs](https://react.dev/learn/accessibility)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)
- [Next.js Accessibility](https://nextjs.org/docs/accessibility)

---

**Maintained by**: Frontend Team  
**Last Updated**: 2025-10-18  
**Review Cycle**: Quarterly  
**Next Review**: 2026-01-18

