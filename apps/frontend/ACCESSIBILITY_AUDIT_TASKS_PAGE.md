# Accessibility Audit - TasksPage Component

**Date**: 2025-10-18  
**Component**: `apps/frontend/src/components/tasks/TasksPage.tsx`  
**Status**: ⚠️ Needs Improvements

---

## Summary

The TasksPage component provides task management functionality with subscription-based features. While it has good baseline structure, it requires several accessibility improvements to meet WCAG 2.1 AA standards, particularly around ARIA labels, keyboard navigation, and screen reader announcements.

---

## Accessibility Issues Found

### 🔴 Critical Issues

#### 1. Missing ARIA Labels on Interactive Buttons
**Issue**: Buttons lack descriptive `aria-label` attributes  
**Impact**: Screen reader users don't get sufficient context about button actions  
**WCAG**: 2.4.6 Headings and Labels (AA), 4.1.2 Name, Role, Value (A)

**Current Code**:
```tsx
<Button size={'sm'} disabled={...} className="hidden sm:inline-flex">
  {t('tasks.ui.createTask', 'Create Task')}
</Button>

<Button size={'sm'} disabled={...} className="sm:hidden px-3">
  <span className="text-lg">+</span>
</Button>
```

**Recommended Fix**:
```tsx
<Button 
  size={'sm'} 
  disabled={taskLimits.maxTasks !== -1 && tasks.length >= taskLimits.maxTasks}
  className="hidden sm:inline-flex"
  aria-label={t('tasks.ui.createTaskAriaLabel', 'Create new task')}
>
  {t('tasks.ui.createTask', 'Create Task')}
</Button>

<Button 
  size={'sm'} 
  disabled={taskLimits.maxTasks !== -1 && tasks.length >= taskLimits.maxTasks}
  className="sm:hidden px-3"
  aria-label={t('tasks.ui.createTaskAriaLabel', 'Create new task')}
>
  <span className="text-lg" aria-hidden="true">+</span>
</Button>
```

#### 2. Task Limit Counter Missing Screen Reader Context
**Issue**: Task counter lacks semantic meaning for screen readers  
**Impact**: Screen reader users don't understand the counter's purpose  
**WCAG**: 1.3.1 Info and Relationships (A)

**Current Code**:
```tsx
{taskLimits.maxTasks !== -1 && (
  <span className="text-xs text-muted-foreground hidden sm:inline">
    {tasks.length}/{taskLimits.maxTasks}
  </span>
)}
```

**Recommended Fix**:
```tsx
{taskLimits.maxTasks !== -1 && (
  <span 
    className="text-xs text-muted-foreground hidden sm:inline"
    role="status"
    aria-label={t('tasks.ui.taskCountAriaLabel', '{{current}} of {{max}} tasks used', {
      current: tasks.length,
      max: taskLimits.maxTasks
    })}
  >
    <span aria-hidden="true">{tasks.length}/{taskLimits.maxTasks}</span>
  </span>
)}
```

#### 3. Missing Live Region for Task Statistics
**Issue**: Task statistics update without announcing changes  
**Impact**: Screen reader users miss important updates  
**WCAG**: 4.1.3 Status Messages (AA)

**Recommended Fix**:
```tsx
{/* Add live region for task stats updates */}
<div 
  role="status" 
  aria-live="polite" 
  aria-atomic="true"
  className="sr-only"
>
  {t('tasks.ui.statsUpdate', '{{running}} running, {{completed}} completed, {{pending}} pending, {{failed}} failed tasks', taskStats)}
</div>

{/* Task statistics cards */}
<div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
  {/* ... */}
</div>
```

#### 4. Disabled Buttons Without Explanation
**Issue**: Disabled buttons don't communicate why they're disabled  
**Impact**: Users don't understand why actions are unavailable  
**WCAG**: 4.1.2 Name, Role, Value (A)

**Current Code**:
```tsx
<Button
  variant="outline"
  size="sm"
  className="w-full"
  disabled={!canUseAI && subscription?.tier === 'trial'}
>
  {t('tasks.ui.scheduleEvaluation', '计划评估')}
</Button>
```

**Recommended Fix**:
```tsx
<Button
  variant="outline"
  size="sm"
  className="w-full"
  disabled={!canUseAI && subscription?.tier === 'trial'}
  aria-label={
    !canUseAI && subscription?.tier === 'trial'
      ? t('tasks.ui.scheduleEvaluationDisabled', 'Schedule evaluation - requires Professional or Elite plan')
      : t('tasks.ui.scheduleEvaluationEnabled', 'Schedule evaluation')
  }
  title={
    !canUseAI && subscription?.tier === 'trial'
      ? t('tasks.ui.upgradeRequired', 'Upgrade to Professional or Elite to use AI evaluation')
      : undefined
  }
>
  {t('tasks.ui.scheduleEvaluation', '计划评估')}
</Button>
```

---

### 🟡 Important Issues

#### 5. Missing Section Landmarks
**Issue**: Major content sections lack proper ARIA landmarks  
**Impact**: Screen reader users can't efficiently navigate between sections  
**WCAG**: 1.3.1 Info and Relationships (A)

**Recommended Fix**:
```tsx
{/* Subscription status section */}
<section aria-labelledby="subscription-status-heading">
  <h2 id="subscription-status-heading" className="sr-only">
    {t('tasks.ui.subscriptionStatus', 'Subscription Status')}
  </h2>
  {subscription && (
    <Alert type={canUseAI ? 'success' : 'info'}>
      {/* ... */}
    </Alert>
  )}
</section>

{/* Task statistics section */}
<section aria-labelledby="task-statistics-heading">
  <h2 id="task-statistics-heading" className="sr-only">
    {t('tasks.ui.taskStatistics', 'Task Statistics')}
  </h2>
  <LazyRender>
    <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {/* ... */}
    </div>
  </LazyRender>
</section>

{/* Task types section */}
<section aria-labelledby="task-types-heading">
  <h2 id="task-types-heading" className="sr-only">
    {t('tasks.ui.taskTypes', 'Available Task Types')}
  </h2>
  <LazyRender>
    <div className="grid gap-4 sm:gap-6 sm:grid-cols-1 lg:grid-cols-3">
      {/* ... */}
    </div>
  </LazyRender>
</section>
```

#### 6. Statistics Cards Missing Semantic Structure
**Issue**: Statistics cards don't use proper semantic HTML  
**Impact**: Screen readers can't identify the relationship between numbers and labels  
**WCAG**: 1.3.1 Info and Relationships (A)

**Recommended Fix**:
```tsx
<Card>
  <CardContent className="p-4 sm:p-6">
    <div role="group" aria-labelledby="running-tasks-label">
      <div 
        className="text-xl sm:text-2xl font-bold text-blue-600 mb-2"
        aria-label={t('tasks.ui.runningTasksCount', '{{count}} running tasks', { count: taskStats.running })}
      >
        {taskStats.running}
      </div>
      <div id="running-tasks-label" className="text-sm font-medium">
        {t('tasks.ui.running', '运行中')}
      </div>
      <div className="text-xs text-muted-foreground hidden sm:block">
        {t('tasks.ui.currentlyExecuting', '当前执行中')}
      </div>
    </div>
  </CardContent>
</Card>
```

#### 7. Alert Messages Missing Proper Role
**Issue**: Alert components may not use `role="alert"` for immediate announcement  
**Impact**: Screen reader users may miss critical information  
**WCAG**: 4.1.3 Status Messages (AA)

**Recommended Fix**:
```tsx
{/* Ensure Alert component uses role="alert" */}
{taskLimits.maxTasks !== -1 && tasks.length >= taskLimits.maxTasks && (
  <Alert type={'warn'} role="alert" aria-live="assertive">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <span className={'text-sm text-muted-foreground'}>
        {t('tasks.ui.taskLimitReached', '已达到任务数量限制')}
      </span>
      <Button
        size={'sm'}
        variant={'outline'}
        onClick={() => {
          window.location.href = '/settings/subscription';
        }}
        className="w-full sm:w-auto"
        aria-label={t('tasks.ui.upgradeForMoreAriaLabel', 'Upgrade subscription to increase task limit')}
      >
        {t('tasks.ui.upgradeForMore', '升级获得更多')}
      </Button>
    </div>
  </Alert>
)}
```

#### 8. Navigation Using window.location.href
**Issue**: Direct navigation breaks SPA experience and accessibility  
**Impact**: Screen reader users lose context, no focus management  
**WCAG**: 2.4.3 Focus Order (A)

**Recommended Fix**:
```tsx
import { useRouter } from 'next/navigation';

export function TasksPage() {
  const router = useRouter();
  // ...

  <Button
    size={'sm'}
    variant={'outline'}
    onClick={() => router.push('/settings/subscription')}
    className="w-full sm:w-auto"
    aria-label={t('tasks.ui.upgradeForMoreAriaLabel', 'Upgrade subscription to increase task limit')}
  >
    {t('tasks.ui.upgradeForMore', '升级获得更多')}
  </Button>
}
```

#### 9. Badge Elements Missing Semantic Context
**Issue**: Badges lack proper ARIA attributes  
**Impact**: Screen readers may not convey badge meaning clearly  
**WCAG**: 4.1.2 Name, Role, Value (A)

**Recommended Fix**:
```tsx
<Badge variant="outline" role="status">
  <span className="sr-only">{t('tasks.ui.currentPlan', 'Current plan:')}</span>
  {subscription.tier} {t('tasks.ui.plan', '套餐')}
</Badge>

{isOnTrial && (
  <Badge variant="secondary" role="status">
    <span className="sr-only">{t('tasks.ui.accountStatus', 'Account status:')}</span>
    {t('tasks.ui.trial', '试用')}
  </Badge>
)}
```

---

### 🟢 Good Practices Already Implemented

✅ **Internationalization**: All text uses i18n  
✅ **Loading States**: Implements loading indicators  
✅ **Error Handling**: Provides error messages via toast  
✅ **Responsive Design**: Uses responsive grid layouts  
✅ **Conditional Rendering**: Handles empty states  
✅ **Permission Guards**: Uses PermissionGuard component  
✅ **Lazy Rendering**: Uses LazyRender for performance  
✅ **Semantic Components**: Uses Card, Alert, Badge components  

---

## Recommended Improvements

### 1. Add Comprehensive ARIA Labels

```tsx
// Add to i18n files
{
  "tasks": {
    "ui": {
      "createTaskAriaLabel": "Create new task",
      "taskCountAriaLabel": "{{current}} of {{max}} tasks used",
      "statsUpdate": "{{running}} running, {{completed}} completed, {{pending}} pending, {{failed}} failed tasks",
      "subscriptionStatus": "Subscription Status",
      "taskStatistics": "Task Statistics",
      "taskTypes": "Available Task Types",
      "runningTasksCount": "{{count}} running tasks",
      "completedTasksCount": "{{count}} completed tasks",
      "pendingTasksCount": "{{count}} pending tasks",
      "failedTasksCount": "{{count}} failed tasks",
      "upgradeForMoreAriaLabel": "Upgrade subscription to increase task limit",
      "scheduleEvaluationDisabled": "Schedule evaluation - requires Professional or Elite plan",
      "scheduleEvaluationEnabled": "Schedule evaluation",
      "upgradeRequired": "Upgrade to Professional or Elite to use AI evaluation",
      "currentPlan": "Current plan:",
      "accountStatus": "Account status:"
    }
  }
}
```

### 2. Implement Live Regions for Dynamic Content

```tsx
export function TasksPage() {
  const [lastStatsUpdate, setLastStatsUpdate] = useState<string>('');

  // Update announcement when stats change
  useEffect(() => {
    if (tasks.length > 0) {
      setLastStatsUpdate(
        t('tasks.ui.statsUpdate', '{{running}} running, {{completed}} completed, {{pending}} pending, {{failed}} failed tasks', taskStats)
      );
    }
  }, [taskStats, t]);

  return (
    <DashboardPageLayout {...}>
      {/* Live region for updates */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {lastStatsUpdate}
      </div>
      
      {/* Rest of component */}
    </DashboardPageLayout>
  );
}
```

### 3. Add Screen Reader Only Headings

```tsx
// Add utility class to global CSS
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

// Use in component
<h2 className="sr-only">
  {t('tasks.ui.subscriptionStatus', 'Subscription Status')}
</h2>
```

### 4. Improve Focus Management

```tsx
import { useRouter } from 'next/navigation';
import { useRef, useEffect } from 'react';

export function TasksPage() {
  const router = useRouter();
  const alertRef = useRef<HTMLDivElement>(null);

  // Focus alert when task limit is reached
  useEffect(() => {
    if (taskLimits.maxTasks !== -1 && tasks.length >= taskLimits.maxTasks && alertRef.current) {
      alertRef.current.focus();
    }
  }, [tasks.length, taskLimits.maxTasks]);

  return (
    // ...
    {taskLimits.maxTasks !== -1 && tasks.length >= taskLimits.maxTasks && (
      <div ref={alertRef} tabIndex={-1}>
        <Alert type={'warn'} role="alert" aria-live="assertive">
          {/* ... */}
        </Alert>
      </div>
    )}
  );
}
```

### 5. Enhanced Statistics Cards

```tsx
<Card>
  <CardContent className="p-4 sm:p-6">
    <div 
      role="group" 
      aria-labelledby="running-tasks-label"
      aria-describedby="running-tasks-desc"
    >
      <div 
        className="text-xl sm:text-2xl font-bold text-blue-600 mb-2"
        aria-label={t('tasks.ui.runningTasksCount', '{{count}} running tasks', { count: taskStats.running })}
      >
        {taskStats.running}
      </div>
      <div id="running-tasks-label" className="text-sm font-medium">
        {t('tasks.ui.running', '运行中')}
      </div>
      <div id="running-tasks-desc" className="text-xs text-muted-foreground hidden sm:block">
        {t('tasks.ui.currentlyExecuting', '当前执行中')}
      </div>
    </div>
  </CardContent>
</Card>
```

---

## Testing Checklist

### Manual Testing

- [ ] **Keyboard Navigation**
  - Tab through all interactive elements
  - Verify focus indicators are visible
  - Test Enter/Space to activate buttons
  - Ensure no keyboard traps
  - Test Escape to close modals/dialogs

- [ ] **Screen Reader Testing**
  - VoiceOver (macOS): Cmd+F5
  - NVDA (Windows): Free download
  - JAWS (Windows): Commercial
  
  Test scenarios:
  - Navigate through page sections
  - Verify statistics are announced correctly
  - Check alert messages are announced immediately
  - Test badge and status announcements
  - Verify disabled button states are communicated
  - Check task limit counter is understandable

- [ ] **Focus Management**
  - Alert focuses when task limit reached
  - Navigation preserves focus context
  - Modal/dialog focus trapping (when implemented)

- [ ] **Dynamic Content**
  - Task statistics updates are announced
  - Alert messages are announced immediately
  - Toast notifications are accessible

### Automated Testing

```typescript
// Example test with @testing-library/react
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

expect.extend(toHaveNoViolations);

describe('TasksPage Accessibility', () => {
  test('has no accessibility violations', async () => {
    const { container } = render(<TasksPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('create task button has descriptive label', () => {
    render(<TasksPage />);
    
    const createButton = screen.getByRole('button', { 
      name: /create new task/i 
    });
    expect(createButton).toBeInTheDocument();
  });

  test('task statistics have proper labels', () => {
    render(<TasksPage />);
    
    const runningTasks = screen.getByLabelText(/running tasks/i);
    const completedTasks = screen.getByLabelText(/completed tasks/i);
    
    expect(runningTasks).toBeInTheDocument();
    expect(completedTasks).toBeInTheDocument();
  });

  test('disabled buttons communicate why they are disabled', () => {
    render(<TasksPage />);
    
    const disabledButton = screen.getByRole('button', { 
      name: /requires professional or elite plan/i 
    });
    expect(disabledButton).toBeDisabled();
  });

  test('alerts are announced to screen readers', async () => {
    render(<TasksPage />);
    
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });
  });

  test('buttons are keyboard accessible', async () => {
    const user = userEvent.setup();
    render(<TasksPage />);
    
    const createButton = screen.getByRole('button', { 
      name: /create new task/i 
    });
    
    await user.tab();
    expect(createButton).toHaveFocus();
    
    await user.keyboard('{Enter}');
    // Verify action occurred
  });

  test('live region announces statistics updates', async () => {
    const { rerender } = render(<TasksPage />);
    
    const liveRegion = screen.getByRole('status', { hidden: true });
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    
    // Simulate stats update
    rerender(<TasksPage />);
    
    await waitFor(() => {
      expect(liveRegion).toHaveTextContent(/running.*completed.*pending.*failed/i);
    });
  });
});
```

---

## WCAG 2.1 Compliance Status

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 1.3.1 Info and Relationships | A | ⚠️ Partial | Need section landmarks and semantic structure |
| 2.1.1 Keyboard | A | ✅ Pass | All functions keyboard accessible |
| 2.4.3 Focus Order | A | ⚠️ Partial | Navigation breaks SPA focus |
| 2.4.6 Headings and Labels | AA | ⚠️ Partial | Need descriptive button labels |
| 2.4.7 Focus Visible | AA | ✅ Pass | Focus indicators visible |
| 4.1.2 Name, Role, Value | A | ⚠️ Partial | Need proper ARIA attributes |
| 4.1.3 Status Messages | AA | ❌ Fail | Missing live regions for updates |

---

## Priority Recommendations

### High Priority (Fix Immediately)
1. Add `aria-label` to all interactive buttons
2. Add live region for task statistics updates
3. Add `role="alert"` to critical alerts
4. Replace `window.location.href` with `router.push`
5. Add screen reader context to task counter

### Medium Priority (Fix Soon)
6. Add section landmarks with `aria-labelledby`
7. Improve disabled button state communication
8. Add semantic structure to statistics cards
9. Add proper ARIA attributes to badges
10. Add missing i18n keys for ARIA labels

### Low Priority (Nice to Have)
11. Implement focus management for alerts
12. Add keyboard shortcuts for common actions
13. Add skip links for long content
14. Implement comprehensive automated tests
15. Add reduced motion support

---

## Related Issues

- See: `apps/frontend/ACCESSIBILITY_AUDIT_TASKS_TABLE.md`
- See: `apps/frontend/ACCESSIBILITY_AUDIT_DASHBOARD_AGGREGATES.md`
- See: `apps/frontend/ACCESSIBILITY_IMPROVEMENTS_PRICING.md`
- Related: Tasks page implementation documentation

---

## Resources

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
