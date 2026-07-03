#!/bin/bash

echo "🔧 Cleaning up syntax errors from type annotations..."

# Fix broken arrow function syntax
find apps/frontend/src -name "*.tsx" -o -name "*.ts" | xargs sed -i.bak 's/((: any): any) =>/() =>/g'
find apps/frontend/src -name "*.tsx" -o -name "*.ts" | xargs sed -i.bak 's/(([^:]*): any) =>/((\1) =>/g'
find apps/frontend/src -name "*.tsx" -o -name "*.ts" | xargs sed -i.bak 's/(\([^:]*: any\): any) =>/((\1) =>/g'
find apps/frontend/src -name "*.tsx" -o -name "*.ts" | xargs sed -i.bak 's/onCheckedChange={((checked: boolean): any) =>/onCheckedChange={(checked) =>/g'
find apps/frontend/src -name "*.tsx" -o -name "*.ts" | xargs sed -i.bak 's/onChange={((e: any): any) =>/onChange={(e) =>/g'
find apps/frontend/src -name "*.tsx" -o -name "*.ts" | xargs sed -i.bak 's/onValueChange={((value: string): any) =>/onValueChange={(value) =>/g'
find apps/frontend/src -name "*.tsx" -o -name "*.ts" | xargs sed -i.bak 's/onClick={((: any): any) =>/onClick={() =>/g'

echo "✅ Cleaned up syntax errors"