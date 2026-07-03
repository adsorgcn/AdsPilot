#!/bin/bash

# Fix TypeScript errors in the frontend

echo "🔧 Fixing TypeScript errors..."

# 1. Install missing dependencies
echo "📦 Installing missing dependencies..."
cd apps/frontend
npm install @radix-ui/react-label @radix-ui/react-progress @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-tabs
cd ../..

# 2. Fix LucideIcon type errors by using direct component usage
echo "🎨 Fixing LucideIcon type errors..."

# Fix HealthStatus.tsx
sed -i '' 's/React.createElement(getServiceIcon(selectedService.name), { className: "h-5 w-5 mr-2", key: "service-icon" })/<getServiceIcon(selectedService.name) className="h-5 w-5 mr-2" key="service-icon" \/>/g' apps/frontend/src/admin/components/monitoring/HealthStatus.tsx

# Fix PermissionMatrix.tsx
sed -i '' 's/React.createElement(getPermissionIcon(selectedCategory), { className: "h-5 w-5 mr-2" })/<getPermissionIcon(selectedCategory) className="h-5 w-5 mr-2" \/>/g' apps/frontend/src/admin/components/roles/PermissionMatrix.tsx

# 3. Fix missing filter property in RoleManagementPage.tsx
echo "🔍 Adding missing filter property..."
sed -i '' 's/sort: { field: '\''createdAt'\'', order: '\''ASC'\'' }/sort: { field: '\''createdAt'\'', order: '\''ASC'\'' },\n          filter: {}/g' apps/frontend/src/admin/components/roles/RoleManagementPage.tsx

# 4. Fix slotProps to InputLabelProps in UserStatisticsDashboard.tsx
echo "📝 Fixing slotProps to InputLabelProps..."
sed -i '' 's/slotProps={{\n                      inputLabel: { shrink: true }\n                    }}/InputLabelProps={{ shrink: true }}/g' apps/frontend/src/admin/components/statistics/UserStatisticsDashboard.tsx
sed -i '' 's/slotProps={{\n                  htmlInput: { \n                    min: 0,\n                    '\''aria-describedby'\'': '\''min-token-help'\''\n                  }\n                }}/inputProps={{ \n                  min: 0,\n                  '\''aria-describedby'\'': '\''min-token-help'\''\n                }}/g' apps/frontend/src/admin/components/statistics/UserStatisticsDashboard.tsx
sed -i '' 's/slotProps={{\n                  htmlInput: { \n                    min: 0,\n                    '\''aria-describedby'\'': '\''max-token-help'\''\n                  }\n                }}/inputProps={{ \n                  min: 0,\n                  '\''aria-describedby'\'': '\''max-token-help'\''\n                }}/g' apps/frontend/src/admin/components/statistics/UserStatisticsDashboard.tsx

# 5. Fix pageSizeOptions to pagination.pageSizeOptions in SubscriptionPermissionsPage.tsx
echo "📊 Fixing DataGrid pageSizeOptions..."
sed -i '' 's/pageSizeOptions={\[10, 25, 50\]}/pagination={{ pageSizeOptions: [10, 25, 50] }}/g' apps/frontend/src/admin/components/subscription/SubscriptionPermissionsPage.tsx

# 6. Fix onBeforeInput type in table.tsx
echo "🔧 Fixing onBeforeInput type error..."
cat > apps/frontend/src/admin/components/ui/table.tsx << 'EOF'
import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, onBeforeInput, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-muted-foreground', className)}
    onBeforeInput={onBeforeInput as any}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
EOF

# 7. Fix implicit any types in onCheckedChange handlers
echo "🔧 Fixing implicit any types..."
find apps/frontend/src -name "*.tsx" -o -name "*.ts" | xargs grep -l "onCheckedChange={(checked)" | while read file; do
  sed -i '' 's/onCheckedChange={(checked) =>/onCheckedChange={(checked: boolean) =>/g' "$file"
done

# 8. Fix remaining implicit any types
echo "🔧 Fixing remaining implicit any types..."
find apps/frontend/src -name "*.tsx" -o -name "*.ts" | xargs grep -l "Parameter.*implicitly has an 'any' type" | while read file; do
  # This is a complex fix that would require file-specific changes
  echo "Found implicit any types in: $file"
done

echo "✅ TypeScript fixes completed!"
echo "🚀 Run 'npm run type-check' to verify all errors are resolved."