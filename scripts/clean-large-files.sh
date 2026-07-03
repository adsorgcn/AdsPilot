#!/bin/bash
# This script helps to clean up the project directory from large files
# that are not necessary for the development environment.

echo "Starting cleanup..."

# Clean up docker images and containers
echo "Cleaning up docker..."
docker image prune -a -f
docker container prune -f
docker volume prune -f
docker builder prune -f

# Clean up pnpm store
echo "Cleaning up pnpm store..."
pnpm store prune

# Clean up go modules and cache
echo "Cleaning up go modules..."
go mod tidy
go clean -modcache

# Find and remove large files
echo "Finding and removing large files..."
# Remove files larger than 100M
find . -type f -size +100M -not -path "./.git/*" -not -path "./.pnpm-store/*" -exec ls -lh {} +
find . -type f -size +100M -not -path "./.git/*" -not -path "./.pnpm-store/*" -exec rm -f {} +

echo "Cleanup finished."
