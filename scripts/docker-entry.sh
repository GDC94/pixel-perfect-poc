#!/usr/bin/env sh
set -e

# The Playwright image ships Node and npm, but not pnpm. Corepack is bundled with
# Node and reads the "packageManager" field in package.json, so the container ends
# up on the exact pnpm version the host uses. Forgetting this line produces a
# "pnpm: not found" that looks like a broken image rather than a missing shim.
corepack enable

# --frozen-lockfile makes the container fail loudly on a lockfile that does not
# match package.json, instead of silently resolving different versions than the
# host and producing baselines nobody can reproduce.
pnpm install --frozen-lockfile

exec "$@"
