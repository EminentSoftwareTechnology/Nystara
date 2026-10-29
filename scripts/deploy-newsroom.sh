#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
release_dir=$(mktemp -d "${TMPDIR:-/tmp}/nystara-newsroom.XXXXXX")
trap 'rm -rf -- "$release_dir"' EXIT
git archive HEAD | tar -x -C "$release_dir"
rm -f "$release_dir/railway.toml" "$release_dir/railway.json"
railway up "$release_dir" --path-as-root --detach "$@"
