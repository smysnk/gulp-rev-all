#!/usr/bin/env bash
set -euo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${THIS_DIR}/../.." && pwd)"
STAGE_DIR="${DOCS_PUBLIC_STAGE_DIR:-${ROOT_DIR}/.test-results/docs-public-source}"
SITE_DIR="${DOCS_PUBLIC_SITE_DIR:-${ROOT_DIR}/.test-results/docs-site}"

node "${THIS_DIR}/stage-readme-docs.mjs"
node "${THIS_DIR}/check-docs.mjs"
rm -rf "${SITE_DIR}"

if ! command -v jekyll >/dev/null 2>&1; then
  echo "jekyll is required; install the pinned CI version with: gem install jekyll -v 4.3.4" >&2
  exit 1
fi

jekyll build \
  --source "${STAGE_DIR}" \
  --destination "${SITE_DIR}" \
  --baseurl "/projects/gulp-rev-all/docs"

node "${THIS_DIR}/check-docs.mjs"
echo "Built public documentation: ${SITE_DIR}"
