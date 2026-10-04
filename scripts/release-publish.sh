#!/usr/bin/env bash
set -euo pipefail

echo "Building release artifacts and schemas..."
pnpm run build

echo "Publishing to npm via Changesets..."
pnpm changeset publish

echo "Publishing to JSR..."
pnpm dlx jsr publish

echo "Pushing git release tags to origin..."
git push origin --tags

echo "Ensuring GitHub release exists..."
node scripts/create-github-release.mjs
