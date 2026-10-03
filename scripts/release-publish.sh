#!/usr/bin/env bash
set -euo pipefail

echo "Building release artifacts and schemas..."
pnpm run build

echo "Publishing to npm via Changesets..."
pnpm changeset publish

echo "Publishing to JSR..."
pnpm dlx jsr publish
