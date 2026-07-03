#!/bin/bash

echo "=== Fixing Remaining TypeScript Errors ==="

cd apps/frontend || exit 1

# Install vitest types
echo "1. Installing vitest types..."
npm install --save-dev vitest @types/vitest

# Create a script to fix implicitly typed parameters
echo "2. Creating TypeScript fix script..."

# Fix APIManager.tsx - implicitly typed parameters
echo "Fixing APIManager.tsx..."
cat > fix-api-manager.ts << 'EOF'
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, 'src/admin/components/api/APIManager.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix implicitly typed parameters in callback functions
content = content.replace(
  /Object\.keys\(.*?\)\.forEach\(\s*(\w+)\s*=>/g,
  'Object.keys($1).forEach(($1: string) =>'
);

content = content.replace(
  /\.map\(\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*=>/g,
  '.map(($1: any, $2: number) =>'
);

content = content.replace(
  /\.filter\(\s*(\w+)\s*=>/g,
  '.filter(($1: any) =>'
);

fs.writeFileSync(filePath, content);
console.log('Fixed APIManager.tsx');
EOF

node fix-api-manager.ts
rm fix-api-manager.ts

echo "3. Running TypeScript compilation to check remaining errors..."
npx tsc --noEmit --skipLibCheck | grep -E "error TS" | head -20

echo "Done!"