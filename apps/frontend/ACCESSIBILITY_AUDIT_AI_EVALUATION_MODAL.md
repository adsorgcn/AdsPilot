# Accessibility Audit - AIEvaluationModal Component

**Date**: 2025-10-18  
**Component**: `apps/frontend/src/components/offers/AIEvaluationModal.tsx`  
**Status**: ⚠️ Needs Improvements  
**Last Modified**: 2025-10-18 (Added React hooks imports - currently unused)

---

## Summary

The AIEvaluationModal component provides a dialog for initiating AI evaluation of offers. While it has good baseline structure using Dialog components, it requires several accessibility improvements to meet WCAG 2.1 AA standards, particularly around ARIA labels, live regions for dynamic content, and screen reader announcements.

**Recent Changes**: Added `useMemo`, `useCallback`, `useEvaluateOffer` hook, and `toast` imports but they are currently unused. These should either be implemented or removed to maintain code quality.

---

## Code Quality Issues (TypeScript/React)

### 🔴 Critical Code Issues

#### 1. Unused Imports
**Issue**: Multiple imports are declared but never used  
**Impact**: Code bloat, potential confusion, build warnings  
**TypeScript Errors**: 7 unused import warnings

**Unused Imports**:
- `useEffect` - imported but never used
- `useMemo` - imported but never used  
- `useCallback` - imported but never used
- `useEvaluateOffer` - imported but never used
- `toast` - imported but never used
- `Target` icon - imported but never used
- `Shield` icon - imported but never used

**Current Code**:
```typescript
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useEvaluateOffer } from '~/lib/offers/hooks';
import { toast } from 'sonner';
import { Zap, AlertTriangle, CheckCircle, Loader, TrendingUp, Target, Shield, Award } from 'lucide-react';
```

**Recommended Fix**:
```typescript
// Option 1: Remove unused imports (if not needed)
import React, { useState } from 'react';
import { Zap, AlertTriangle, CheckCircle, Loader, TrendingUp, Award } from 'lucide-react';

// Option 2: Implement the hooks if they were intended to be used
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useEvaluateOffer } from '~/lib/offers/hooks';
import { toast } from 'sonner';

// Then use them in the component:
const { mutate: evaluateOffer, isLoading } = useEvaluateOffer();

const memoizedCost = useMemo(() => {
  return selectedOfferIds.length * COST_PER_OFFER;
}, [selectedOfferIds]);

const handleEvaluate = useCallback(async () => {
  if (!hasEnoughTokens) return;
  try {
    await evaluateOffer(selectedOfferIds);
    toast.success(t('offers.aiEvaluation.success', 'Evaluation completed'));
  } catch (error) {
    toast.error(t('offers.aiEvaluation.error', 'Evaluation failed'));
  }
}, [hasEnoughTokens, evaluateOffer, selectedOfferIds, t]);
```

#### 2. Unsafe Optional Callback Invocation
**Issue**: `onEvaluate` is called without checking if it's defined  
**Impact**: Runtime error if `onEvaluate` is undefined  
**TypeScript Error**: "Cannot invoke an object which is possibly 'undefined'"  
**Location**: Line 131 in `handleEvaluate`

**Current Code**:
```typescript
const handleEvaluate = async () => {
  if (!hasEnoughTokens) return;
  try {
    await simulateEvaluation();
    await onEvaluate(selectedOfferIds); // ❌ Can throw if undefined
  } catch (error) {
    setResult(prev => ({ ...prev, stage: 'idle' }));
  }
};
```

**Recommended Fix**:
```typescript
const handleEvaluate = async () => {
  if (!hasEnoughTokens) return;
  
  try {
    await simulateEvaluation();
    
    // Safe optional call
    if (onEvaluate) {
      await onEvaluate(selectedOfferIds);
    }
    
    // Show success message
    toast.success(
      t('offers.aiEvaluation.success', 'Evaluation completed successfully')
    );
  } catch (error) {
    setResult(prev => ({ ...prev, stage: 'idle' }));
    
    // Show error message
    toast.error(
      t('offers.aiEvaluation.error', 'Evaluation failed. Please try again.')
    );
    
    console.error('Evaluation error:', error);
  }
};
```

#### 3. Unused Interface
**Issue**: `EvaluationTask` interface is defined but never used  
**Impact**: Dead code, maintenance burden  
**Location**: Lines 23-28

**Current Code**:
```typescript
interface EvaluationTask {
  offerId: string;
  evaluationId: string;
  status: 'queued' | 'evaluating' | 'completed' | 'failed';
  tokenCost: number;
}
```

**Recommended Fix**:
```typescript
// Option 1: Remove if not needed
// Delete the interface

// Option 2: Use it if task tracking is needed
interface EvaluationTask {
  offerId: string;
  evaluationId: string;
  status: 'queued' | 'evaluating' | 'completed' | 'failed';
  tokenCost: number;
}

// Then use it in state:
const [tasks, setTasks] = useState<EvaluationTask[]>([]);
```

#### 4. Missing Props Validation
**Issue**: `onEvaluate` is optional in props but used as required  
**Impact**: Type safety issue, potential runtime errors

**Current Props**:
```typescript
interface AIEvaluationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOfferIds: string[];
  onEvaluate?: (offerIds: string[]) => Promise<void>; // Optional
  tokenBalance: number;
  estimatedCost: number;
  onSuccess?: () => void;
}
```

**Recommended Fix**:
```typescript
// Option 1: Make it required if it's always needed
interface AIEvaluationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOfferIds: string[];
  onEvaluate: (offerIds: string[]) => Promise<void>; // Required
  tokenBalance: number;
  estimatedCost: number;
  onSuccess?: () => void;
}

// Option 2: Handle optional case properly
interface AIEvaluationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOfferIds: string[];
  onEvaluate?: (offerIds: string[]) => Promise<void>; // Optional
  tokenBalance: number;
  estimatedCost: number;
  onSuccess?: () => void;
}

// Then in component:
const handleEvaluate = async () => {
  if (!hasEnoughTokens || !onEvaluate) return; // Check if defined
  // ...
};
```

---

## Accessibility Issues Found

### 🔴 Critical Issues

#### 1. Missing ARIA Labels on Buttons
**Issue**: Buttons lack descriptive `aria-label` attributes  
**Impact**: Screen reader users don't get sufficient context about button actions  
**WCAG**: 2.4.6 Headings and Labels (AA), 4.1.2 Name, Role, Value (A)

**Current Code**:
```tsx
<Button
  onClick={handleEvaluate}
  className="flex-1"
  disabled={!hasEnoughTokens || isEvaluating}
>
  {isEvaluating
    ? t('offers.aiEvaluation.evaluating', 'Evaluating...')
    : t('offers.aiEvaluation.startEvaluation', 'Start Evaluation')
  }
</Button>
```

**Recommended Fix**:
```tsx
<Button
  onClick={handleEvaluate}
  className="flex-1"
  disabled={!hasEnoughTokens || isEvaluating}
  aria-label={
    isEvaluating
      ? t('offers.aiEvaluation.evaluatingAriaLabel', `Evaluating ${offerCount} offers`)
      : t('offers.aiEvaluation.startEvaluationAriaLabel', `Start AI evaluation for ${offerCount} offers, cost ${estimatedCost} tokens`)
  }
  aria-busy={isEvaluating}
>
  {isEvaluating
    ? t('offers.aiEvaluation.evaluating', 'Evaluating...')
    : t('offers.aiEvaluation.startEvaluation', 'Start Evaluation')
  }
</Button>
```

#### 2. Decorative Icons Not Hidden from Screen Readers
**Issue**: All icons (Zap, AlertTriangle) are read by screen readers  
**Impact**: Redundant announcements, cluttered screen reader experience  
**WCAG**: 1.1.1 Non-text Content (A)

**Fix**: Add `aria-hidden="true"` to all decorative icons:
```tsx
<Zap className="h-5 w-5 text-blue-600" aria-hidden="true" />
<AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
```

#### 3. Missing Live Region for Dynamic Content
**Issue**: Token balance changes and evaluation status not announced to screen readers  
**Impact**: Screen reader users miss important state updates  
**WCAG**: 4.1.3 Status Messages (AA)

**Recommended Fix**:
```tsx
export function AIEvaluationModal({
  open,
  onOpenChange,
  selectedOfferIds,
  onEvaluate,
  tokenBalance,
  estimatedCost,
}: AIEvaluationModalProps) {
  const { t } = useTranslation('common');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const hasEnoughTokens = tokenBalance >= estimatedCost;
  const offerCount = selectedOfferIds.length;

  // Update status message for screen readers
  useEffect(() => {
    if (isEvaluating) {
      setStatusMessage(t('offers.aiEvaluation.statusEvaluating', `Evaluating ${offerCount} offers`));
    } else if (!hasEnoughTokens) {
      setStatusMessage(t('offers.aiEvaluation.statusInsufficientTokens', 'Insufficient tokens for evaluation'));
    } else {
      setStatusMessage('');
    }
  }, [isEvaluating, hasEnoughTokens, offerCount, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* Live region for status updates */}
        <div 
          role="status" 
          aria-live="polite" 
          aria-atomic="true"
          className="sr-only"
        >
          {statusMessage}
        </div>
        
        {/* Rest of component */}
      </DialogContent>
    </Dialog>
  );
}
```

#### 4. Disabled Button Without Proper State Communication
**Issue**: Disabled button doesn't communicate why it's unavailable  
**Impact**: Users don't understand why the button is disabled  
**WCAG**: 4.1.2 Name, Role, Value (A)

**Recommended Fix**:
```tsx
<Button
  onClick={handleEvaluate}
  className="flex-1"
  disabled={!hasEnoughTokens || isEvaluating}
  aria-label={
    !hasEnoughTokens
      ? t('offers.aiEvaluation.disabledInsufficientTokens', 'Cannot start evaluation - insufficient tokens')
      : isEvaluating
      ? t('offers.aiEvaluation.disabledEvaluating', 'Evaluation in progress')
      : t('offers.aiEvaluation.startEvaluationAriaLabel', `Start AI evaluation for ${offerCount} offers`)
  }
  aria-disabled={!hasEnoughTokens || isEvaluating}
>
  {isEvaluating
    ? t('offers.aiEvaluation.evaluating', 'Evaluating...')
    : t('offers.aiEvaluation.startEvaluation', 'Start Evaluation')
  }
</Button>
```

---

### 🟡 Important Issues

#### 5. Missing Section Labels
**Issue**: Content sections lack proper ARIA landmarks  
**Impact**: Screen reader users can't efficiently navigate between sections  
**WCAG**: 1.3.1 Info and Relationships (A)

**Recommended Fix**:
```tsx
<div className="space-y-4">
  {/* Summary Section */}
  <section aria-labelledby="evaluation-summary-heading">
    <h3 id="evaluation-summary-heading" className="sr-only">
      {t('offers.aiEvaluation.summaryHeading', 'Evaluation Summary')}
    </h3>
    <div className="p-4 bg-blue-50 rounded-lg">
      {/* Summary content */}
    </div>
  </section>

  {/* Token Balance Section */}
  <section aria-labelledby="token-balance-heading">
    <h3 id="token-balance-heading" className="sr-only">
      {t('offers.aiEvaluation.tokenBalanceHeading', 'Token Balance')}
    </h3>
    <div className="p-4 border rounded-lg">
      {/* Token balance content */}
    </div>
  </section>

  {/* Warning Section */}
  {!hasEnoughTokens && (
    <section aria-labelledby="warning-heading">
      <h3 id="warning-heading" className="sr-only">
        {t('offers.aiEvaluation.warningHeading', 'Warning')}
      </h3>
      <Alert type="warn" role="alert" aria-live="assertive">
        {/* Warning content */}
      </Alert>
    </section>
  )}
</div>
```

#### 6. Color-Only Information
**Issue**: Token balance status uses only color (green/red) to convey information  
**Impact**: Users with color blindness can't distinguish status  
**WCAG**: 1.4.1 Use of Color (A)

**Current Code**:
```tsx
<span className={`text-sm font-medium ${hasEnoughTokens ? 'text-green-600' : 'text-red-600'}`}>
  {tokenBalance - estimatedCost} tokens
</span>
```

**Recommended Fix**:
```tsx
<span 
  className={`text-sm font-medium ${hasEnoughTokens ? 'text-green-600' : 'text-red-600'}`}
  aria-label={
    hasEnoughTokens
      ? t('offers.aiEvaluation.sufficientTokensLabel', `${tokenBalance - estimatedCost} tokens remaining - sufficient`)
      : t('offers.aiEvaluation.insufficientTokensLabel', `${tokenBalance - estimatedCost} tokens - insufficient`)
  }
>
  {hasEnoughTokens ? '✓ ' : '⚠ '}
  {tokenBalance - estimatedCost} tokens
</span>
```

#### 7. Missing Focus Management
**Issue**: Focus not managed when modal opens or closes  
**Impact**: Keyboard users lose focus context  
**WCAG**: 2.4.3 Focus Order (A)

**Recommended Fix**:
```tsx
import { useRef, useEffect } from 'react';

export function AIEvaluationModal({
  open,
  onOpenChange,
  selectedOfferIds,
  onEvaluate,
  tokenBalance,
  estimatedCost,
}: AIEvaluationModalProps) {
  const { t } = useTranslation('common');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const evaluateButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management
  useEffect(() => {
    if (open && evaluateButtonRef.current) {
      // Focus the primary action button when modal opens
      setTimeout(() => {
        evaluateButtonRef.current?.focus();
      }, 100);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* ... */}
        <Button
          ref={evaluateButtonRef}
          onClick={handleEvaluate}
          className="flex-1"
          disabled={!hasEnoughTokens || isEvaluating}
        >
          {/* Button content */}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

#### 8. Alert Component Missing Proper Role
**Issue**: Warning alert may not be announced immediately  
**Impact**: Screen reader users may miss critical warnings  
**WCAG**: 4.1.3 Status Messages (AA)

**Recommended Fix**:
```tsx
{!hasEnoughTokens && (
  <Alert 
    type="warn" 
    role="alert" 
    aria-live="assertive"
    className="flex items-start gap-2"
  >
    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
    <div className="text-sm">
      {t('offers.aiEvaluation.insufficientTokens', 'Insufficient tokens. Please top up your balance or reduce the number of offers.')}
    </div>
  </Alert>
)}
```

#### 9. Unused Imports and Interfaces
**Issue**: Multiple unused imports and interfaces (TypeScript warnings)  
**Impact**: Code maintainability and bundle size  
**Best Practice**: Clean code standards

**Fix**: Remove unused imports:
```tsx
// Remove these unused imports
import { CheckCircle, Loader, TrendingUp, Target, Shield, Award } from 'lucide-react';

// Remove unused interfaces
interface EvaluationDimension { ... }
interface EvaluationResult { ... }

// Remove unused useEffect import if not needed after fixes
```

---

### 🟢 Good Practices Already Implemented

✅ **Dialog Component**: Uses proper Dialog component with DialogContent, DialogHeader, DialogTitle  
✅ **Internationalization**: All text uses i18n  
✅ **Loading States**: Implements loading state with disabled buttons  
✅ **Error Handling**: Proper try-catch in async handler  
✅ **Conditional Rendering**: Shows warning only when relevant  
✅ **Semantic HTML**: Uses appropriate HTML elements  
✅ **Button States**: Properly disables buttons during evaluation  

---

## Recommended Improvements

### 1. Complete Implementation with All Fixes

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import { Alert } from '~/core/ui/Alert';
import { Zap, AlertTriangle } from 'lucide-react';

interface AIEvaluationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOfferIds: string[];
  onEvaluate: (offerIds: string[]) => Promise<void>;
  tokenBalance: number;
  estimatedCost: number;
}

export function AIEvaluationModal({
  open,
  onOpenChange,
  selectedOfferIds,
  onEvaluate,
  tokenBalance,
  estimatedCost,
}: AIEvaluationModalProps) {
  const { t } = useTranslation('common');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const evaluateButtonRef = useRef<HTMLButtonElement>(null);

  const hasEnoughTokens = tokenBalance >= estimatedCost;
  const offerCount = selectedOfferIds.length;
  const remainingTokens = tokenBalance - estimatedCost;

  // Update status message for screen readers
  useEffect(() => {
    if (isEvaluating) {
      setStatusMessage(
        t('offers.aiEvaluation.statusEvaluating', `Evaluating ${offerCount} offers`)
      );
    } else if (!hasEnoughTokens) {
      setStatusMessage(
        t('offers.aiEvaluation.statusInsufficientTokens', 'Insufficient tokens for evaluation')
      );
    } else {
      setStatusMessage('');
    }
  }, [isEvaluating, hasEnoughTokens, offerCount, t]);

  // Focus management
  useEffect(() => {
    if (open && evaluateButtonRef.current) {
      setTimeout(() => {
        evaluateButtonRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleEvaluate = async () => {
    if (!hasEnoughTokens) return;

    setIsEvaluating(true);
    try {
      await onEvaluate(selectedOfferIds);
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* Live region for status updates */}
        <div 
          role="status" 
          aria-live="polite" 
          aria-atomic="true"
          className="sr-only"
        >
          {statusMessage}
        </div>

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" aria-hidden="true" />
            {t('offers.aiEvaluation.title', 'AI Evaluation')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Section */}
          <section aria-labelledby="evaluation-summary-heading">
            <h3 id="evaluation-summary-heading" className="sr-only">
              {t('offers.aiEvaluation.summaryHeading', 'Evaluation Summary')}
            </h3>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {t('offers.aiEvaluation.offersToEvaluate', 'Offers to evaluate')}
                </span>
                <span 
                  className="text-lg font-bold"
                  aria-label={t('offers.aiEvaluation.offerCountLabel', `${offerCount} offers selected`)}
                >
                  {offerCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t('offers.aiEvaluation.estimatedCost', 'Estimated cost')}
                </span>
                <span 
                  className="text-lg font-bold"
                  aria-label={t('offers.aiEvaluation.costLabel', `${estimatedCost} tokens required`)}
                >
                  {estimatedCost} tokens
                </span>
              </div>
            </div>
          </section>

          {/* Token Balance Section */}
          <section aria-labelledby="token-balance-heading">
            <h3 id="token-balance-heading" className="sr-only">
              {t('offers.aiEvaluation.tokenBalanceHeading', 'Token Balance')}
            </h3>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {t('offers.aiEvaluation.currentBalance', 'Current balance')}
                </span>
                <span 
                  className="text-sm font-medium"
                  aria-label={t('offers.aiEvaluation.currentBalanceLabel', `${tokenBalance} tokens available`)}
                >
                  {tokenBalance} tokens
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('offers.aiEvaluation.afterEvaluation', 'After evaluation')}
                </span>
                <span 
                  className={`text-sm font-medium ${hasEnoughTokens ? 'text-green-600' : 'text-red-600'}`}
                  aria-label={
                    hasEnoughTokens
                      ? t('offers.aiEvaluation.sufficientTokensLabel', `${remainingTokens} tokens remaining - sufficient`)
                      : t('offers.aiEvaluation.insufficientTokensLabel', `${remainingTokens} tokens - insufficient`)
                  }
                >
                  {hasEnoughTokens ? '✓ ' : '⚠ '}
                  {remainingTokens} tokens
                </span>
              </div>
            </div>
          </section>

          {/* Warning Section */}
          {!hasEnoughTokens && (
            <section aria-labelledby="warning-heading">
              <h3 id="warning-heading" className="sr-only">
                {t('offers.aiEvaluation.warningHeading', 'Warning')}
              </h3>
              <Alert 
                type="warn" 
                role="alert" 
                aria-live="assertive"
                className="flex items-start gap-2"
              >
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-sm">
                  {t('offers.aiEvaluation.insufficientTokens', 'Insufficient tokens. Please top up your balance or reduce the number of offers.')}
                </div>
              </Alert>
            </section>
          )}

          {/* Info Section */}
          <div 
            className="text-xs text-muted-foreground"
            role="note"
          >
            {t('offers.aiEvaluation.info', 'AI evaluation will analyze offer quality, traffic potential, and provide optimization suggestions.')}
          </div>

          {/* Actions */}
          <div 
            className="flex gap-2 pt-2"
            role="group"
            aria-label={t('offers.aiEvaluation.actionsLabel', 'Evaluation actions')}
          >
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isEvaluating}
              aria-label={t('offers.aiEvaluation.cancelAriaLabel', 'Cancel evaluation and close dialog')}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              ref={evaluateButtonRef}
              onClick={handleEvaluate}
              className="flex-1"
              disabled={!hasEnoughTokens || isEvaluating}
              aria-label={
                !hasEnoughTokens
                  ? t('offers.aiEvaluation.disabledInsufficientTokens', 'Cannot start evaluation - insufficient tokens')
                  : isEvaluating
                  ? t('offers.aiEvaluation.disabledEvaluating', 'Evaluation in progress')
                  : t('offers.aiEvaluation.startEvaluationAriaLabel', `Start AI evaluation for ${offerCount} offers, cost ${estimatedCost} tokens`)
              }
              aria-busy={isEvaluating}
              aria-disabled={!hasEnoughTokens || isEvaluating}
            >
              {isEvaluating
                ? t('offers.aiEvaluation.evaluating', 'Evaluating...')
                : t('offers.aiEvaluation.startEvaluation', 'Start Evaluation')
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 2. Add Missing i18n Keys

Add to `apps/frontend/src/i18n/locales/en/common.json`:
```json
{
  "offers": {
    "aiEvaluation": {
      "title": "AI Evaluation",
      "summaryHeading": "Evaluation Summary",
      "tokenBalanceHeading": "Token Balance",
      "warningHeading": "Warning",
      "offersToEvaluate": "Offers to evaluate",
      "offerCountLabel": "{{count}} offers selected",
      "estimatedCost": "Estimated cost",
      "costLabel": "{{cost}} tokens required",
      "currentBalance": "Current balance",
      "currentBalanceLabel": "{{balance}} tokens available",
      "afterEvaluation": "After evaluation",
      "sufficientTokensLabel": "{{remaining}} tokens remaining - sufficient",
      "insufficientTokensLabel": "{{remaining}} tokens - insufficient",
      "insufficientTokens": "Insufficient tokens. Please top up your balance or reduce the number of offers.",
      "info": "AI evaluation will analyze offer quality, traffic potential, and provide optimization suggestions.",
      "startEvaluation": "Start Evaluation",
      "startEvaluationAriaLabel": "Start AI evaluation for {{count}} offers, cost {{cost}} tokens",
      "evaluating": "Evaluating...",
      "evaluatingAriaLabel": "Evaluating {{count}} offers",
      "cancelAriaLabel": "Cancel evaluation and close dialog",
      "disabledInsufficientTokens": "Cannot start evaluation - insufficient tokens",
      "disabledEvaluating": "Evaluation in progress",
      "statusEvaluating": "Evaluating {{count}} offers",
      "statusInsufficientTokens": "Insufficient tokens for evaluation",
      "actionsLabel": "Evaluation actions"
    }
  }
}
```

### 3. Add Screen Reader Only Utility Class

Ensure this utility class exists in your global CSS:
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## Testing Checklist

### Manual Testing

- [ ] **Keyboard Navigation**
  - Tab through all interactive elements
  - Verify focus indicators are visible
  - Test Enter/Space to activate buttons
  - Test Escape to close dialog
  - Ensure no keyboard traps

- [ ] **Screen Reader Testing**
  - VoiceOver (macOS): Cmd+F5
  - NVDA (Windows): Free download
  - JAWS (Windows): Commercial
  
  Test scenarios:
  - Navigate through dialog sections
  - Verify all content is announced
  - Check status updates are announced
  - Verify button states are clear
  - Test warning announcement
  - Verify focus management

- [ ] **Focus Management**
  - Dialog opens with focus on primary button
  - Focus returns to trigger element on close
  - Focus trapped within dialog when open

- [ ] **Dynamic Content**
  - Status changes are announced
  - Token balance updates are announced
  - Warning appears/disappears correctly

### Automated Testing

```typescript
// Example test with @testing-library/react
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

expect.extend(toHaveNoViolations);

describe('AIEvaluationModal Accessibility', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    selectedOfferIds: ['offer-1', 'offer-2'],
    onEvaluate: jest.fn(),
    tokenBalance: 100,
    estimatedCost: 50,
  };

  test('has no accessibility violations', async () => {
    const { container } = render(<AIEvaluationModal {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('dialog has proper title', () => {
    render(<AIEvaluationModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/AI Evaluation/i);
  });

  test('buttons have descriptive labels', () => {
    render(<AIEvaluationModal {...defaultProps} />);
    
    const evaluateButton = screen.getByRole('button', { 
      name: /Start AI evaluation for 2 offers/i 
    });
    const cancelButton = screen.getByRole('button', { 
      name: /Cancel evaluation/i 
    });
    
    expect(evaluateButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
  });

  test('decorative icons are hidden from screen readers', () => {
    const { container } = render(<AIEvaluationModal {...defaultProps} />);
    const icons = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThan(0);
  });

  test('warning is announced when insufficient tokens', () => {
    render(<AIEvaluationModal {...defaultProps} tokenBalance={10} estimatedCost={50} />);
    
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent(/Insufficient tokens/i);
  });

  test('status updates are announced', async () => {
    const { rerender } = render(<AIEvaluationModal {...defaultProps} />);
    
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    
    // Simulate evaluation start
    const evaluateButton = screen.getByRole('button', { name: /Start AI evaluation/i });
    await userEvent.click(evaluateButton);
    
    await waitFor(() => {
      expect(status).toHaveTextContent(/Evaluating/i);
    });
  });

  test('buttons are keyboard accessible', async () => {
    const user = userEvent.setup();
    render(<AIEvaluationModal {...defaultProps} />);
    
    const evaluateButton = screen.getByRole('button', { name: /Start AI evaluation/i });
    
    await user.tab();
    expect(evaluateButton).toHaveFocus();
    
    await user.keyboard('{Enter}');
    expect(defaultProps.onEvaluate).toHaveBeenCalled();
  });

  test('disabled button communicates state', () => {
    render(<AIEvaluationModal {...defaultProps} tokenBalance={10} estimatedCost={50} />);
    
    const evaluateButton = screen.getByRole('button', { 
      name: /Cannot start evaluation - insufficient tokens/i 
    });
    
    expect(evaluateButton).toBeDisabled();
    expect(evaluateButton).toHaveAttribute('aria-disabled', 'true');
  });
});
```

---

## WCAG 2.1 Compliance Status

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 1.1.1 Non-text Content | A | ⚠️ Partial | Need aria-hidden on decorative icons |
| 1.3.1 Info and Relationships | A | ⚠️ Partial | Need section landmarks |
| 1.4.1 Use of Color | A | ❌ Fail | Color-only status indication |
| 2.1.1 Keyboard | A | ✅ Pass | All functions keyboard accessible |
| 2.4.3 Focus Order | A | ⚠️ Partial | Need focus management |
| 2.4.6 Headings and Labels | AA | ⚠️ Partial | Need descriptive button labels |
| 3.2.4 Consistent Identification | AA | ✅ Pass | Consistent patterns |
| 4.1.2 Name, Role, Value | A | ⚠️ Partial | Need proper ARIA attributes |
| 4.1.3 Status Messages | AA | ❌ Fail | Missing live regions for updates |

---

## Priority Recommendations

### High Priority (Fix Immediately)
1. Add `aria-label` to all buttons with context
2. Add `aria-hidden="true"` to all decorative icons
3. Add live region for status updates
4. Fix color-only information with text indicators
5. Add `role="alert"` with `aria-live="assertive"` to warning

### Medium Priority (Fix Soon)
6. Add section landmarks with `aria-labelledby`
7. Implement focus management
8. Add comprehensive ARIA labels for all interactive elements
9. Remove unused imports and interfaces
10. Add missing i18n keys

### Low Priority (Nice to Have)
11. Add automated accessibility tests
12. Add keyboard shortcuts documentation
13. Implement reduced motion preferences
14. Add high contrast mode support

---

## Related Issues

- See: `apps/frontend/ACCESSIBILITY_AUDIT_OFFERS_PAGE.md`
- See: `apps/frontend/ACCESSIBILITY_AUDIT_DASHBOARD_AGGREGATES.md`
- See: `apps/frontend/ACCESSIBILITY_IMPROVEMENTS_PRICING.md`

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Accessibility Docs](https://react.dev/learn/accessibility)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [Lucide Icons Accessibility](https://lucide.dev/)

---

**Maintained by**: Frontend Team  
**Last Updated**: 2025-10-18  
**Review Cycle**: Quarterly  
**Next Review**: 2026-01-18
