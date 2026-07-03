# Accessibility Audit - AIEvaluationModal Component (Updated)

**Date**: 2025-10-18  
**Component**: `apps/frontend/src/components/offers/AIEvaluationModal.tsx`  
**Status**: ⚠️ Needs Improvements  
**Recent Changes**: Added polling functionality for real-time evaluation results

---

## Summary

The AIEvaluationModal component has been updated with polling functionality to fetch real evaluation results from the backend. While the component has good baseline accessibility, several improvements are needed to meet WCAG 2.1 AA standards, particularly around live regions, loading states, and screen reader announcements for dynamic content.

---

## Critical Issues Found

### 🔴 1. Missing Import for API Client

**Issue**: `apiGet` is used but not imported  
**Impact**: TypeScript error, component will fail at runtime  
**WCAG**: N/A (Technical issue)

**Current Code** (Line 176):
```typescript
const results = await Promise.all(
  tasks.map(task => 
    apiGet<any>(`/api/v1/evaluations/${task.evaluationId}`)
      .catch(err => ({ status: 'failed', error: err.message }))
  )
);
```

**Fix**:
```typescript
// Add to imports at top of file
import { apiGet } from '~/lib/api/client';
```

---

### 🔴 2. Implicit `any` Types in Polling Function

**Issue**: Multiple parameters have implicit `any` type  
**Impact**: Type safety issues, harder to maintain  
**WCAG**: N/A (Code quality)

**Current Code** (Lines 176-178):
```typescript
apiGet<any>(`/api/v1/evaluations/${task.evaluationId}`)
  .catch(err => ({ status: 'failed', error: err.message }))
```

**Fix**:
```typescript
// Define proper types
interface EvaluationResponse {
  status: 'queued' | 'evaluating' | 'completed' | 'failed';
  aiRecommendationScore?: number;
  similarWebData?: {
    globalRank?: number;
  };
  aiReasons?: string[];
  error?: string;
}

// Use in polling function
const results = await Promise.all(
  tasks.map(task => 
    apiGet<EvaluationResponse>(`/api/v1/evaluations/${task.evaluationId}`)
      .catch((err: Error) => ({ 
        status: 'failed' as const, 
        error: err.message 
      }))
  )
);
```

---

### 🔴 3. Missing Live Region for Polling Updates

**Issue**: Polling progress not announced to screen readers  
**Impact**: Screen reader users don't know evaluation is progressing  
**WCAG**: 4.1.3 Status Messages (AA)

**Current Code**: No live region for polling updates

**Recommended Fix**:
```typescript
export function AIEvaluationModal({ ... }: AIEvaluationModalProps) {
  const [pollingStatus, setPollingStatus] = useState<string>('');
  
  // In pollEvaluationResults function
  const pollEvaluationResults = async (tasks: EvaluationTask[], maxAttempts = 30) => {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      attempts++;
      setPollingStatus(
        t('offers.aiEvaluation.polling', 'Checking evaluation progress, attempt {{attempt}} of {{max}}', {
          attempt: attempts,
          max: maxAttempts
        })
      );
      
      // ... rest of polling logic
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Live region for polling updates */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {pollingStatus}
      </div>
      
      {/* Rest of component */}
    </Dialog>
  );
}
```

---

### 🟡 4. Progress Bars Missing Accessible Labels

**Issue**: Dimension progress bars use `role="progressbar"` but lack proper labeling  
**Impact**: Screen readers announce progress but context is unclear  
**WCAG**: 4.1.2 Name, Role, Value (A)

**Current Code** (Lines 437-449):
```typescript
<div 
  key={index} 
  className="p-3 border rounded-lg" 
  role="progressbar" 
  aria-valuenow={dimension.score} 
  aria-valuemin={0} 
  aria-valuemax={100} 
  aria-label={`${dimension.name}: ${dimension.score}%`}
>
```

**Issue**: The entire container has `role="progressbar"`, but it contains multiple elements

**Recommended Fix**:
```typescript
<div key={index} className="p-3 border rounded-lg">
  <div className="flex items-center justify-between mb-2">
    <div className="flex items-center gap-2">
      {dimension.status === 'completed' && (
        <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
      )}
      {dimension.status === 'evaluating' && (
        <Loader className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
      )}
      {dimension.status === 'pending' && (
        <div className="h-4 w-4 rounded-full border-2 border-gray-300" aria-hidden="true" />
      )}
      <span className="text-sm font-medium" id={`dimension-${index}-label`}>
        {dimension.name}
      </span>
    </div>
    {dimension.status === 'completed' && (
      <span 
        className={`text-lg font-bold ${getScoreColor(dimension.score)}`}
        aria-label={t('offers.aiEvaluation.scoreValue', '{{score}} out of 100', { score: dimension.score })}
      >
        {dimension.score}
      </span>
    )}
  </div>
  {dimension.status === 'completed' && (
    <div 
      role="progressbar" 
      aria-valuenow={dimension.score} 
      aria-valuemin={0} 
      aria-valuemax={100}
      aria-labelledby={`dimension-${index}-label`}
      aria-valuetext={`${dimension.score} percent`}
      className="w-full bg-gray-200 rounded-full h-2"
    >
      <div
        className={`h-2 rounded-full transition-all duration-300 ${
          dimension.score >= 80 ? 'bg-green-600' :
          dimension.score >= 60 ? 'bg-yellow-600' : 'bg-red-600'
        }`}
        style={{ width: `${dimension.score}%` }}
        aria-hidden="true"
      />
    </div>
  )}
</div>
```

---

### 🟡 5. Decorative Icons Not Hidden from Screen Readers

**Issue**: All icons are read by screen readers, causing redundant announcements  
**Impact**: Cluttered screen reader experience  
**WCAG**: 1.1.1 Non-text Content (A)

**Current Code**: Icons lack `aria-hidden="true"`

**Fix**: Add `aria-hidden="true"` to all decorative icons:
```typescript
<Zap className="h-5 w-5 text-blue-600" aria-hidden="true" />
<AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
<Loader className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
<CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
<Award className="h-6 w-6 text-blue-600" aria-hidden="true" />
<TrendingUp className="h-4 w-4 text-blue-600" aria-hidden="true" />
```

---

### 🟡 6. Missing Timeout Announcement

**Issue**: Polling timeout error not announced immediately  
**Impact**: Screen reader users may not know evaluation failed  
**WCAG**: 4.1.3 Status Messages (AA)

**Current Code** (Line 230):
```typescript
// Timeout
throw new Error(t('offers.aiEvaluation.errors.timeout', 'Evaluation timeout'));
```

**Recommended Fix**:
```typescript
// Add live region for critical errors
const [criticalError, setCriticalError] = useState<string>('');

// In pollEvaluationResults
if (attempts >= maxAttempts) {
  const timeoutMsg = t('offers.aiEvaluation.errors.timeout', 'Evaluation timeout');
  setCriticalError(timeoutMsg);
  throw new Error(timeoutMsg);
}

// In JSX
<div 
  role="alert" 
  aria-live="assertive" 
  aria-atomic="true"
  className="sr-only"
>
  {criticalError}
</div>
```

---

### 🟡 7. Loading State Not Announced During Polling

**Issue**: 2-second polling intervals have no screen reader feedback  
**Impact**: Screen reader users don't know system is working  
**WCAG**: 4.1.3 Status Messages (AA)

**Recommended Fix**:
```typescript
// Update polling status more frequently
const pollEvaluationResults = async (tasks: EvaluationTask[], maxAttempts = 30) => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Announce polling progress
    setPollingStatus(
      t('offers.aiEvaluation.pollingProgress', 'Checking evaluation status, {{completed}} of {{total}} completed', {
        completed: completedCount,
        total: tasks.length
      })
    );
    
    // ... rest of logic
  }
};
```

---

### 🟡 8. Button Disabled State Lacks Context

**Issue**: Disabled "Start Evaluation" button doesn't explain why  
**Impact**: Users don't understand why they can't proceed  
**WCAG**: 4.1.2 Name, Role, Value (A)

**Current Code** (Lines 537-548):
```typescript
<Button
  onClick={handleEvaluate}
  className="flex-1"
  disabled={!hasEnoughTokens}
  aria-label={t('offers.aiEvaluation.startEvaluationAria', '...')}
>
```

**Recommended Fix**:
```typescript
<Button
  onClick={handleEvaluate}
  className="flex-1"
  disabled={!hasEnoughTokens}
  aria-label={
    !hasEnoughTokens
      ? t('offers.aiEvaluation.insufficientTokensAria', 'Cannot start evaluation: insufficient tokens. You need {{needed}} more tokens', {
          needed: estimatedCost - tokenBalance
        })
      : t('offers.aiEvaluation.startEvaluationAria', 'Start AI evaluation for {{count}} offers using {{cost}} tokens', {
          count: offerCount,
          cost: estimatedCost
        })
  }
  aria-disabled={!hasEnoughTokens}
>
  <Zap className="h-4 w-4 mr-2" aria-hidden="true" />
  {t('offers.aiEvaluation.startEvaluation', 'Start Evaluation')}
</Button>
```

---

## Good Practices Already Implemented

✅ **Semantic HTML**: Uses Dialog component with proper structure  
✅ **ARIA Roles**: Uses `role="region"`, `role="progressbar"`, `role="alert"`  
✅ **Keyboard Accessible**: All buttons are keyboard accessible  
✅ **Internationalization**: All text uses i18n  
✅ **Loading States**: Implements loading indicators  
✅ **Error Handling**: Provides error messages  
✅ **Focus Management**: Dialog handles focus properly  
✅ **Button Labels**: Most buttons have descriptive `aria-label`  

---

## Recommended Improvements

### 1. Add Comprehensive Type Definitions

```typescript
// Add to top of file
interface EvaluationResponse {
  status: 'queued' | 'evaluating' | 'completed' | 'failed';
  aiRecommendationScore?: number;
  similarWebData?: {
    globalRank?: number;
    [key: string]: any;
  };
  aiReasons?: string[];
  error?: string;
}

interface PollingState {
  attempts: number;
  maxAttempts: number;
  completedCount: number;
  totalCount: number;
  status: string;
}
```

### 2. Add Live Regions for Dynamic Updates

```typescript
export function AIEvaluationModal({ ... }: AIEvaluationModalProps) {
  const [pollingStatus, setPollingStatus] = useState<string>('');
  const [criticalError, setCriticalError] = useState<string>('');
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Live region for polling updates */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {pollingStatus}
      </div>
      
      {/* Live region for critical errors */}
      <div 
        role="alert" 
        aria-live="assertive" 
        aria-atomic="true"
        className="sr-only"
      >
        {criticalError}
      </div>
      
      <DialogContent className="max-w-md">
        {/* Rest of component */}
      </DialogContent>
    </Dialog>
  );
}
```

### 3. Improve Progress Bar Accessibility

```typescript
{result.dimensions.map((dimension, index) => (
  <div key={index} className="p-3 border rounded-lg">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        {/* Status icons with aria-hidden */}
        {dimension.status === 'completed' && (
          <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
        )}
        {dimension.status === 'evaluating' && (
          <>
            <Loader className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
            <span className="sr-only">
              {t('offers.aiEvaluation.evaluating', 'Evaluating {{name}}', { name: dimension.name })}
            </span>
          </>
        )}
        {dimension.status === 'pending' && (
          <>
            <div className="h-4 w-4 rounded-full border-2 border-gray-300" aria-hidden="true" />
            <span className="sr-only">
              {t('offers.aiEvaluation.pending', '{{name}} pending', { name: dimension.name })}
            </span>
          </>
        )}
        <span className="text-sm font-medium" id={`dimension-${index}-label`}>
          {dimension.name}
        </span>
      </div>
      {dimension.status === 'completed' && (
        <span 
          className={`text-lg font-bold ${getScoreColor(dimension.score)}`}
          aria-label={t('offers.aiEvaluation.scoreValue', '{{score}} out of 100', { score: dimension.score })}
        >
          {dimension.score}
        </span>
      )}
    </div>
    {dimension.status === 'completed' && (
      <div 
        role="progressbar" 
        aria-valuenow={dimension.score} 
        aria-valuemin={0} 
        aria-valuemax={100}
        aria-labelledby={`dimension-${index}-label`}
        aria-valuetext={`${dimension.score} percent`}
        className="w-full bg-gray-200 rounded-full h-2"
      >
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            dimension.score >= 80 ? 'bg-green-600' :
            dimension.score >= 60 ? 'bg-yellow-600' : 'bg-red-600'
          }`}
          style={{ width: `${dimension.score}%` }}
          aria-hidden="true"
        />
      </div>
    )}
  </div>
))}
```

### 4. Add Missing i18n Keys

```json
{
  "offers": {
    "aiEvaluation": {
      "polling": "Checking evaluation progress, attempt {{attempt}} of {{max}}",
      "pollingProgress": "Checking evaluation status, {{completed}} of {{total}} completed",
      "evaluating": "Evaluating {{name}}",
      "pending": "{{name}} pending",
      "scoreValue": "{{score}} out of 100",
      "insufficientTokensAria": "Cannot start evaluation: insufficient tokens. You need {{needed}} more tokens",
      "dimensionsRegion": "Evaluation dimensions progress",
      "closeDialog": "Close evaluation results",
      "cancelEvaluation": "Cancel AI evaluation"
    }
  }
}
```

### 5. Clean Up Unused Imports

```typescript
// Remove unused imports
import { useState, useCallback, useMemo } from 'react'; // Remove useEffect
import { Zap, AlertTriangle, CheckCircle, Loader, TrendingUp, Award } from 'lucide-react'; // Remove Target, Shield
```

### 6. Remove Unused State

```typescript
// Remove if not used elsewhere
// const [evaluationTasks, setEvaluationTasks] = useState<EvaluationTask[]>([]);
```

---

## Testing Checklist

### Manual Testing

- [ ] **Keyboard Navigation**
  - Tab through all interactive elements
  - Verify focus indicators are visible
  - Test Enter/Space to activate buttons
  - Ensure dialog can be closed with Escape
  - Verify no keyboard traps

- [ ] **Screen Reader Testing**
  - VoiceOver (macOS): Cmd+F5
  - NVDA (Windows): Free download
  - JAWS (Windows): Commercial
  
  Test scenarios:
  - Start evaluation and verify polling announcements
  - Check dimension progress announcements
  - Verify error messages are announced immediately
  - Test timeout scenario
  - Verify completion announcement
  - Check recommendations are read correctly

- [ ] **Loading States**
  - Verify polling status is announced
  - Check progress updates are announced
  - Verify timeout is announced
  - Test error recovery

- [ ] **Dynamic Content**
  - Verify dimension scores are announced when completed
  - Check overall score announcement
  - Verify recommendations are accessible

### Automated Testing

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

expect.extend(toHaveNoViolations);

describe('AIEvaluationModal Accessibility', () => {
  test('has no accessibility violations', async () => {
    const { container } = render(
      <AIEvaluationModal 
        open={true}
        onOpenChange={() => {}}
        selectedOfferIds={['offer-1']}
        tokenBalance={100}
        estimatedCost={50}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('announces polling progress', async () => {
    render(
      <AIEvaluationModal 
        open={true}
        onOpenChange={() => {}}
        selectedOfferIds={['offer-1']}
        tokenBalance={100}
        estimatedCost={50}
      />
    );
    
    const startButton = screen.getByRole('button', { name: /start evaluation/i });
    await userEvent.click(startButton);
    
    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent(/checking evaluation/i);
    });
  });

  test('progress bars have proper labels', () => {
    render(
      <AIEvaluationModal 
        open={true}
        onOpenChange={() => {}}
        selectedOfferIds={['offer-1']}
        tokenBalance={100}
        estimatedCost={50}
      />
    );
    
    // After evaluation completes
    const progressBars = screen.getAllByRole('progressbar');
    progressBars.forEach(bar => {
      expect(bar).toHaveAttribute('aria-labelledby');
      expect(bar).toHaveAttribute('aria-valuenow');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  test('decorative icons are hidden from screen readers', () => {
    const { container } = render(
      <AIEvaluationModal 
        open={true}
        onOpenChange={() => {}}
        selectedOfferIds={['offer-1']}
        tokenBalance={100}
        estimatedCost={50}
      />
    );
    
    const icons = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThan(0);
  });

  test('disabled button explains why', () => {
    render(
      <AIEvaluationModal 
        open={true}
        onOpenChange={() => {}}
        selectedOfferIds={['offer-1']}
        tokenBalance={10}
        estimatedCost={50}
      />
    );
    
    const startButton = screen.getByRole('button', { name: /insufficient tokens/i });
    expect(startButton).toBeDisabled();
    expect(startButton).toHaveAttribute('aria-disabled', 'true');
  });
});
```

---

## WCAG 2.1 Compliance Status

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 1.1.1 Non-text Content | A | ⚠️ Partial | Need aria-hidden on decorative icons |
| 1.3.1 Info and Relationships | A | ✅ Pass | Proper semantic structure |
| 2.1.1 Keyboard | A | ✅ Pass | All functions keyboard accessible |
| 2.4.6 Headings and Labels | AA | ⚠️ Partial | Need better button labels |
| 4.1.2 Name, Role, Value | A | ⚠️ Partial | Progress bars need improvement |
| 4.1.3 Status Messages | AA | ❌ Fail | Missing live regions for polling |

---

## Priority Recommendations

### High Priority (Fix Immediately)
1. ✅ Fix missing `apiGet` import
2. ✅ Fix implicit `any` types
3. Add live region for polling updates
4. Add `aria-hidden="true"` to all decorative icons
5. Improve progress bar accessibility

### Medium Priority (Fix Soon)
6. Add timeout announcement
7. Improve disabled button context
8. Add polling status announcements
9. Clean up unused imports and state
10. Add missing i18n keys

### Low Priority (Nice to Have)
11. Add automated accessibility tests
12. Add keyboard shortcuts for common actions
13. Improve error recovery UX
14. Add progress percentage announcements

---

## Related Issues

- See: `apps/frontend/ACCESSIBILITY_AUDIT_AI_EVALUATION_MODAL.md` (Previous audit)
- See: `docs/AI_EVALUATION_MODAL_OPTIMIZATION.md`
- Related: Polling functionality added for real-time results

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Accessibility Docs](https://react.dev/learn/accessibility)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)

---

**Maintained by**: Frontend Team  
**Last Updated**: 2025-10-18  
**Review Cycle**: After major changes  
**Next Review**: After polling implementation is complete
