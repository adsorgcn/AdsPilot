# Accessibility Audit - TasksTable Component

**Date**: 2025-10-18  
**Component**: `apps/frontend/src/components/tasks/TasksTable.tsx`  
**Status**: ⚠️ Needs Improvements

---

## Summary

The TasksTable component displays task information in both desktop and mobile views. While it has good baseline structure, it requires several accessibility improvements to meet WCAG 2.1 AA standards, particularly around ARIA labels, semantic HTML, and screen reader announcements.

---

## Accessibility Issues Found

### 🔴 Critical Issues

#### 1. Missing Table Caption/Label
**Issue**: Table lacks `<caption>` or `aria-label` for screen readers  
**Impact**: Screen reader users don't understand the table's purpose  
**WCAG**: 1.3.1 Info and Relationships (A), 2.4.6 Headings and Labels (AA)

**Current Code**:
```tsx
<table className="w-full">
  <thead className="bg-gray-50 border-b">
```

**Recommended Fix**:
```tsx
<table className="w-full" aria-label={t('tasks.table.ariaLabel', 'Tasks list')}>
  <caption className="sr-only">
    {t('tasks.table.caption', 'Recent automation tasks with status and progress')}
  </caption>
  <thead className="bg-gray-50 border-b">
```

#### 2. Decorative Icons Not Hidden from Screen Readers
**Issue**: All icons are read by screen readers but are decorative  
**Impact**: Redundant announcements, cluttered experience  
**WCAG**: 1.1.1 Non-text Content (A)

**Current Icons**:
- CheckCircleIcon, XCircleIcon, ClockIcon, PlayCircleIcon, BanIcon (status badges)
- ExternalLinkIcon (external links)

**Recommended Fix**:
```tsx
<Icon className="h-3 w-3" aria-hidden="true" />

<ExternalLinkIcon className="h-3 w-3" aria-hidden="true" />
```

#### 3. Missing ARIA Labels on Action Buttons
**Issue**: Buttons lack context about which task they affect  
**Impact**: Screen reader users don't know which task the action applies to  
**WCAG**: 2.4.6 Headings and Labels (AA), 4.1.2 Name, Role, Value (A)

**Current Code**:
```tsx
<Button size="sm" variant="outline" onClick={() => onCancel(task.id)}>
  {t('tasks.actions.cancel', 'Cancel')}
</Button>
```

**Recommended Fix**:
```tsx
<Button 
  size="sm" 
  variant="outline" 
  onClick={() => onCancel(task.id)}
  aria-label={t('tasks.actions.cancelTask', `Cancel ${getTaskTypeLabel(task.type)} task`)}
>
  {t('tasks.actions.cancel', 'Cancel')}
</Button>
```

#### 4. External Links Missing Accessible Labels
**Issue**: External link icons don't indicate they open in new window  
**Impact**: Screen reader users aren't warned about context change  
**WCAG**: 3.2.5 Change on Request (AAA - but good practice)

**Recommended Fix**:
```tsx
<a 
  href={task.offerUrl} 
  target="_blank" 
  rel="noopener noreferrer"
  className="text-blue-600 hover:text-blue-800"
  aria-label={t('tasks.actions.viewOffer', 'View offer (opens in new window)')}
>
  <ExternalLinkIcon className="h-3 w-3" aria-hidden="true" />
  <span className="sr-only">
    {t('tasks.actions.opensNewWindow', '(opens in new window)')}
  </span>
</a>
```

---

### 🟡 Important Issues

#### 5. Progress Bar Missing Accessible Label
**Issue**: Progress bars lack `role="progressbar"` and ARIA attributes  
**Impact**: Screen readers can't announce progress properly  
**WCAG**: 4.1.2 Name, Role, Value (A)

**Current Code**:
```tsx
<div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
  <div 
    className="bg-blue-600 h-2 rounded-full transition-all" 
    style={{ width: `${task.progress}%` }}
  />
</div>
```

**Recommended Fix**:
```tsx
<div 
  role="progressbar" 
  aria-valuenow={task.progress} 
  aria-valuemin={0} 
  aria-valuemax={100}
  aria-label={t('tasks.progress.label', `Task progress: ${task.progress}%`)}
  className="flex-1 bg-gray-200 rounded-full h-2 w-20"
>
  <div 
    className="bg-blue-600 h-2 rounded-full transition-all" 
    style={{ width: `${task.progress}%` }}
    aria-hidden="true"
  />
</div>
```

#### 6. Loading State Missing Proper Announcement
**Issue**: Loading skeleton doesn't announce loading state  
**Impact**: Screen reader users don't know content is loading  
**WCAG**: 4.1.3 Status Messages (AA)

**Recommended Fix**:
```tsx
if (isLoading) {
  return (
    <div className="rounded-lg border" role="status" aria-live="polite">
      <div className="p-6 text-center">
        <span className="sr-only">
          {t('tasks.ui.loading', 'Loading tasks...')}
        </span>
        <div className="animate-pulse space-y-3" aria-hidden="true">
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
        </div>
      </div>
    </div>
  );
}
```

#### 7. Empty State Missing Proper Structure
**Issue**: Empty state lacks semantic structure  
**Impact**: Screen reader users may miss the message  
**WCAG**: 1.3.1 Info and Relationships (A)

**Recommended Fix**:
```tsx
if (tasks.length === 0) {
  return (
    <div className="rounded-lg border">
      <div className="p-6 border-b">
        <h3 className="font-semibold">{t('tasks.ui.recentTasks', 'Recent Tasks')}</h3>
      </div>
      <div 
        className="p-6 text-center text-muted-foreground" 
        role="status"
        aria-live="polite"
      >
        <p className="text-sm mb-4">{t('tasks.ui.noTasksFound', 'No tasks found')}</p>
        <p className="text-xs">{t('tasks.ui.createFirstTask', 'Create your first automation task to get started')}</p>
      </div>
    </div>
  );
}
```

#### 8. Mobile Cards Missing Semantic Structure
**Issue**: Mobile view uses generic divs instead of semantic elements  
**Impact**: Screen reader users lose context and navigation  
**WCAG**: 1.3.1 Info and Relationships (A)

**Recommended Fix**:
```tsx
<div className="md:hidden divide-y" role="list" aria-label={t('tasks.ui.tasksList', 'Tasks list')}>
  {tasks.map((task) => (
    <article 
      key={task.id} 
      className="p-4 space-y-3"
      role="listitem"
      aria-label={`${getTaskTypeLabel(task.type)} task - ${getStatusBadge(task.status)}`}
    >
```

#### 9. Status Badges Missing Accessible Text
**Issue**: Status badges rely on color alone for meaning  
**Impact**: Color-blind users and screen readers need text alternatives  
**WCAG**: 1.4.1 Use of Color (A)

**Current Implementation**: Good - includes both icon and text  
**Improvement**: Add `role="status"` for live updates

```tsx
return (
  <Badge 
    variant={config.variant} 
    className="flex items-center gap-1 w-fit"
    role="status"
    aria-label={`Task status: ${config.label}`}
  >
    <Icon className="h-3 w-3" aria-hidden="true" />
    {config.label}
  </Badge>
);
```

---

### 🟢 Good Practices Already Implemented

✅ **Semantic HTML**: Uses `<table>`, `<thead>`, `<tbody>` properly  
✅ **Responsive Design**: Separate desktop/mobile views  
✅ **Internationalization**: All text uses i18n  
✅ **Loading States**: Implements loading indicators  
✅ **Empty States**: Provides helpful empty state message  
✅ **Status Communication**: Uses both icons and text for status  
✅ **Keyboard Accessible**: Buttons are keyboard accessible  
✅ **Conditional Rendering**: Shows appropriate actions per status  

---

## Recommended Improvements

### 1. Add Comprehensive ARIA Attributes

```tsx
export function TasksTable({ 
  tasks, 
  isLoading, 
  onCancel, 
  onRetry,
  onViewDetails 
}: TasksTableProps) {
  const { t } = useTranslation('common');

  // ... existing code ...

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-semibold" id="tasks-table-heading">
          {t('tasks.ui.recentTasks', 'Recent Tasks')}
        </h3>
      </div>
      
      {/* Desktop view */}
      <div className="hidden md:block overflow-x-auto">
        <table 
          className="w-full" 
          aria-labelledby="tasks-table-heading"
          aria-describedby="tasks-table-description"
        >
          <caption className="sr-only" id="tasks-table-description">
            {t('tasks.table.caption', 'Table showing recent automation tasks with their status, progress, and available actions')}
          </caption>
          <thead className="bg-gray-50 border-b">
            {/* ... existing headers ... */}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.map((task) => (
              <tr 
                key={task.id} 
                className="hover:bg-gray-50"
                aria-label={`${getTaskTypeLabel(task.type)} task, status: ${task.status}`}
              >
                {/* ... table cells ... */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile view */}
      <div 
        className="md:hidden divide-y" 
        role="list" 
        aria-labelledby="tasks-table-heading"
      >
        {tasks.map((task) => (
          <article 
            key={task.id} 
            className="p-4 space-y-3"
            role="listitem"
          >
            {/* ... mobile card content ... */}
          </article>
        ))}
      </div>
    </div>
  );
}
```

### 2. Improve Progress Bar Accessibility

```tsx
{task.progress !== undefined && (
  <div>
    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
      <span id={`progress-label-${task.id}`}>
        {t('tasks.table.progress', 'Progress')}
      </span>
      <span aria-live="polite">{task.progress}%</span>
    </div>
    <div 
      role="progressbar" 
      aria-valuenow={task.progress} 
      aria-valuemin={0} 
      aria-valuemax={100}
      aria-labelledby={`progress-label-${task.id}`}
      className="bg-gray-200 rounded-full h-2"
    >
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all" 
        style={{ width: `${task.progress}%` }}
        aria-hidden="true"
      />
    </div>
  </div>
)}
```

### 3. Add Live Region for Status Updates

```tsx
import { useEffect, useState } from 'react';

export function TasksTable({ tasks, ...props }: TasksTableProps) {
  const { t } = useTranslation('common');
  const [statusAnnouncement, setStatusAnnouncement] = useState('');

  // Announce status changes
  useEffect(() => {
    const runningTasks = tasks.filter(t => t.status === 'running').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const failedTasks = tasks.filter(t => t.status === 'failed').length;

    if (runningTasks > 0 || completedTasks > 0 || failedTasks > 0) {
      const announcement = t('tasks.status.announcement', 
        `${runningTasks} running, ${completedTasks} completed, ${failedTasks} failed`
      );
      setStatusAnnouncement(announcement);
    }
  }, [tasks, t]);

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Live region for status updates */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {statusAnnouncement}
      </div>
      
      {/* ... rest of component ... */}
    </div>
  );
}
```

### 4. Enhance Action Buttons

```tsx
<div className="flex items-center justify-end gap-2">
  {task.status === 'running' && onCancel && (
    <Button
      size="sm"
      variant="outline"
      onClick={() => onCancel(task.id)}
      aria-label={t('tasks.actions.cancelSpecific', 
        `Cancel ${getTaskTypeLabel(task.type)} task`
      )}
    >
      {t('tasks.actions.cancel', 'Cancel')}
    </Button>
  )}
  {task.status === 'failed' && onRetry && (
    <Button
      size="sm"
      variant="outline"
      onClick={() => onRetry(task.id)}
      aria-label={t('tasks.actions.retrySpecific', 
        `Retry ${getTaskTypeLabel(task.type)} task`
      )}
    >
      {t('tasks.actions.retry', 'Retry')}
    </Button>
  )}
  {onViewDetails && (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => onViewDetails(task)}
      aria-label={t('tasks.actions.detailsSpecific', 
        `View details for ${getTaskTypeLabel(task.type)} task`
      )}
    >
      {t('tasks.actions.details', 'Details')}
    </Button>
  )}
</div>
```

### 5. Add Missing i18n Keys

Add to `apps/frontend/src/i18n/locales/en/common.json`:
```json
{
  "tasks": {
    "table": {
      "ariaLabel": "Tasks list",
      "caption": "Table showing recent automation tasks with their status, progress, and available actions",
      "type": "Type",
      "status": "Status",
      "progress": "Progress",
      "tokens": "Tokens",
      "duration": "Duration",
      "created": "Created",
      "actions": "Actions"
    },
    "status": {
      "pending": "Pending",
      "running": "Running",
      "completed": "Completed",
      "failed": "Failed",
      "cancelled": "Cancelled",
      "announcement": "{{runningTasks}} running, {{completedTasks}} completed, {{failedTasks}} failed"
    },
    "type": {
      "evaluation": "Evaluation",
      "clickTask": "Click Task",
      "deployment": "Deployment",
      "sync": "Sync",
      "other": "Other"
    },
    "actions": {
      "cancel": "Cancel",
      "cancelSpecific": "Cancel {{taskType}} task",
      "retry": "Retry",
      "retrySpecific": "Retry {{taskType}} task",
      "details": "Details",
      "detailsSpecific": "View details for {{taskType}} task",
      "viewOffer": "View offer (opens in new window)",
      "opensNewWindow": "(opens in new window)"
    },
    "progress": {
      "label": "Task progress: {{progress}}%"
    },
    "ui": {
      "recentTasks": "Recent Tasks",
      "noTasksFound": "No tasks found",
      "createFirstTask": "Create your first automation task to get started",
      "loading": "Loading tasks...",
      "tasksList": "Tasks list"
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
  - Test table navigation with arrow keys

- [ ] **Screen Reader Testing**
  - VoiceOver (macOS): Cmd+F5
  - NVDA (Windows): Free download
  - JAWS (Windows): Commercial
  
  Test scenarios:
  - Navigate through table rows
  - Verify column headers are announced
  - Check status badges are announced correctly
  - Verify progress bars announce values
  - Test action buttons announce task context
  - Check loading and empty states

- [ ] **Color Contrast**
  - Verify all text meets 4.5:1 ratio
  - Test status badge colors
  - Check progress bar colors
  - Test in high contrast mode

- [ ] **Responsive Design**
  - Test mobile view (320px width)
  - Test tablet view (768px width)
  - Test desktop view (1024px+ width)
  - Verify mobile cards are accessible

### Automated Testing

```typescript
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { TasksTable } from './TasksTable';

expect.extend(toHaveNoViolations);

describe('TasksTable Accessibility', () => {
  const mockTasks = [
    {
      id: '1',
      type: 'evaluation',
      status: 'running',
      progress: 50,
      tokensConsumed: 10,
      createdAt: new Date().toISOString(),
    },
  ];

  test('has no accessibility violations', async () => {
    const { container } = render(<TasksTable tasks={mockTasks} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('table has proper caption', () => {
    render(<TasksTable tasks={mockTasks} />);
    const caption = screen.getByText(/table showing recent automation tasks/i);
    expect(caption).toBeInTheDocument();
  });

  test('progress bars have proper ARIA attributes', () => {
    render(<TasksTable tasks={mockTasks} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  test('action buttons have descriptive labels', () => {
    const onCancel = jest.fn();
    render(<TasksTable tasks={mockTasks} onCancel={onCancel} />);
    
    const cancelButton = screen.getByRole('button', { 
      name: /cancel evaluation task/i 
    });
    expect(cancelButton).toBeInTheDocument();
  });

  test('decorative icons are hidden from screen readers', () => {
    const { container } = render(<TasksTable tasks={mockTasks} />);
    const icons = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThan(0);
  });

  test('loading state is announced', () => {
    render(<TasksTable tasks={[]} isLoading={true} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/loading tasks/i);
  });

  test('empty state is announced', () => {
    render(<TasksTable tasks={[]} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/no tasks found/i);
  });

  test('buttons are keyboard accessible', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    render(<TasksTable tasks={mockTasks} onCancel={onCancel} />);
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    
    await user.tab();
    expect(cancelButton).toHaveFocus();
    
    await user.keyboard('{Enter}');
    expect(onCancel).toHaveBeenCalledWith('1');
  });
});
```

---

## WCAG 2.1 Compliance Status

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 1.1.1 Non-text Content | A | ⚠️ Partial | Need aria-hidden on decorative icons |
| 1.3.1 Info and Relationships | A | ⚠️ Partial | Need table caption and semantic mobile structure |
| 1.4.1 Use of Color | A | ✅ Pass | Status uses both color and text |
| 2.1.1 Keyboard | A | ✅ Pass | All functions keyboard accessible |
| 2.4.6 Headings and Labels | AA | ⚠️ Partial | Need descriptive button labels |
| 3.2.4 Consistent Identification | AA | ✅ Pass | Consistent patterns |
| 4.1.2 Name, Role, Value | A | ⚠️ Partial | Need proper ARIA on progress bars |
| 4.1.3 Status Messages | AA | ⚠️ Partial | Need live regions for updates |

---

## Priority Recommendations

### High Priority (Fix Immediately)
1. Add `aria-hidden="true"` to all decorative icons
2. Add table `<caption>` or `aria-label`
3. Add `role="progressbar"` with ARIA attributes to progress bars
4. Add descriptive `aria-label` to action buttons
5. Add `role="status"` to loading and empty states

### Medium Priority (Fix Soon)
6. Add live region for status updates
7. Add semantic structure to mobile cards (`<article>`, `role="list"`)
8. Add accessible labels to external links
9. Add missing i18n keys for ARIA labels
10. Improve status badge announcements

### Low Priority (Nice to Have)
11. Add keyboard shortcuts for common actions
12. Add skip links for long tables
13. Implement focus management on updates
14. Add automated accessibility tests
15. Add visual focus indicators for custom styles

---

## Related Issues

- See: `apps/frontend/ACCESSIBILITY_AUDIT_DASHBOARD_AGGREGATES.md`
- See: `apps/frontend/ACCESSIBILITY_AUDIT_FINAL_CTA.md`
- See: `apps/frontend/ACCESSIBILITY_IMPROVEMENTS_PRICING.md`

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Accessibility Docs](https://react.dev/learn/accessibility)
- [ARIA Authoring Practices - Table](https://www.w3.org/WAI/ARIA/apg/patterns/table/)
- [WebAIM Articles](https://webaim.org/articles/)
- [Lucide Icons Accessibility](https://lucide.dev/)

---

**Maintained by**: Frontend Team  
**Last Updated**: 2025-10-18  
**Review Cycle**: Quarterly  
**Next Review**: 2026-01-18
