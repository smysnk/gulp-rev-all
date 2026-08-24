#!/usr/bin/env bash
set -euo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${THIS_DIR}/../.." && pwd)"
SITE_DIR="${DOCS_PUBLIC_SITE_DIR:-${ROOT_DIR}/.test-results/docs-site}"
SERVE_ROOT="${ROOT_DIR}/.test-results/docs-serve-root"
MOUNT_DIR="${SERVE_ROOT}/projects/gulp-rev-all/docs"
PORT="${DOCS_LOCAL_PORT:-4102}"

"${THIS_DIR}/build-public.sh"
rm -rf "${SERVE_ROOT}"
mkdir -p "${MOUNT_DIR}"
cp -R "${SITE_DIR}/." "${MOUNT_DIR}/"

echo "Documentation: http://127.0.0.1:${PORT}/projects/gulp-rev-all/docs/"
exec python3 -m http.server "${PORT}" --bind 127.0.0.1 --directory "${SERVE_ROOT}"
