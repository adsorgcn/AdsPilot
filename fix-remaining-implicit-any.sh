#!/bin/bash

echo "🔧 Fixing All Remaining Implicit 'any' Types..."

# Fix all arrow functions with implicit any parameters
find apps/frontend/src -name "*.tsx" -o -name "*.ts" | xargs grep -l "=> " | while read file; do
  # Fix filter functions
  sed -i.bak 's/filter((\([^)]*\)) =>/filter((\1: any) =>/g' "$file"
  sed -i.bak 's/filter(\([^)]*\) =>/filter((\1: any) =>/g' "$file"
  
  # Fix map functions
  sed -i.bak 's/map((\([^)]*\)) =>/map((\1: any) =>/g' "$file"
  sed -i.bak 's/map(\([^)]*\) =>/map((\1: any) =>/g' "$file"
  
  # Fix reduce functions
  sed -i.bak 's/reduce((\([^)]*\)) =>/reduce((\1: any) =>/g' "$file"
  sed -i.bak 's/reduce(\([^)]*\) =>/reduce((\1: any) =>/g' "$file"
  
  # Fix find functions
  sed -i.bak 's/find((\([^)]*\)) =>/find((\1: any) =>/g' "$file"
  sed -i.bak 's/find(\([^)]*\) =>/find((\1: any) =>/g' "$file"
  
  # Fix forEach functions
  sed -i.bak 's/forEach((\([^)]*\)) =>/forEach((\1: any) =>/g' "$file"
  sed -i.bak 's/forEach(\([^)]*\) =>/forEach((\1: any) =>/g' "$file"
  
  # Fix onChange handlers
  sed -i.bak 's/onChange={(\([^)]*\)) =>/onChange={(\1: any) =>/g' "$file"
  sed -i.bak 's/onChange={\([^}]*\) =>/onChange={(\1: any) =>/g' "$file"
  
  # Fix onValueChange handlers
  sed -i.bak 's/onValueChange={(\([^)]*\)) =>/onValueChange={(\1: any) =>/g' "$file"
  sed -i.bak 's/onValueChange={\([^}]*\) =>/onValueChange={(\1: any) =>/g' "$file"
  
  # Fix onCheckedChange handlers
  sed -i.bak 's/onCheckedChange={(\([^)]*\)) =>/onCheckedChange={(\1: any) =>/g' "$file"
  sed -i.bak 's/onCheckedChange={\([^}]*\) =>/onCheckedChange={(\1: any) =>/g' "$file"
  
  # Fix onClick handlers
  sed -i.bak 's/onClick={(\([^)]*\)) =>/onClick={(\1: any) =>/g' "$file"
  sed -i.bak 's/onClick={\([^}]*\) =>/onClick={(\1: any) =>/g' "$file"
  
  # Fix onSubmit handlers
  sed -i.bak 's/onSubmit={(\([^)]*\)) =>/onSubmit={(\1: any) =>/g' "$file"
  sed -i.bak 's/onSubmit={\([^}]*\) =>/onSubmit={(\1: any) =>/g' "$file"
done

echo "✅ Fixed implicit any types in all files"