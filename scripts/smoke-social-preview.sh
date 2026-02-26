#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${PROJECT_REF:-ndbqasanctkwagyinfag}"
VIEWER_URL="${VIEWER_URL:-https://viewer-rho-seven.vercel.app}"
CODE="${SMOKE_TEST_SHORT_CODE:?Set SMOKE_TEST_SHORT_CODE env var}"

METADATA_URL="https://${PROJECT_REF}.supabase.co/functions/v1/get-link-metadata"
VIEW_URL="${VIEWER_URL%/}/p/${CODE}"
FALLBACK_IMAGE_URL="${VIEWER_URL%/}/og-default.png"

tmp_headers="$(mktemp)"
tmp_body="$(mktemp)"
trap 'rm -f "$tmp_headers" "$tmp_body"' EXIT

echo "==> 1) Metadata endpoint status"
curl -sS -D "$tmp_headers" -o "$tmp_body" \
  -X POST "$METADATA_URL" \
  -H "Content-Type: application/json" \
  -d "{\"shortCode\":\"${CODE}\"}"

status_code="$(awk 'NR==1 {print $2}' "$tmp_headers")"
if [[ "$status_code" != "200" ]]; then
  echo "FAIL: get-link-metadata returned HTTP ${status_code}"
  cat "$tmp_body"
  exit 1
fi
echo "PASS: metadata endpoint returned 200"

echo "==> 2) Metadata JSON contract"
grep -q '"title"' "$tmp_body" || { echo 'FAIL: missing "title"'; exit 1; }
grep -q '"description"' "$tmp_body" || { echo 'FAIL: missing "description"'; exit 1; }
grep -q '"shareText"' "$tmp_body" || { echo 'FAIL: missing "shareText"'; exit 1; }
grep -q '"publicThumbnailUrl"' "$tmp_body" || { echo 'FAIL: missing "publicThumbnailUrl" key'; exit 1; }
grep -q '"metadata"' "$tmp_body" || { echo 'FAIL: missing "metadata"'; exit 1; }
grep -q '"code"' "$tmp_body" || { echo 'FAIL: missing "metadata.code"'; exit 1; }
grep -q '"createdAt"' "$tmp_body" || { echo 'FAIL: missing "metadata.createdAt"'; exit 1; }
echo "PASS: metadata contract keys present"

echo "==> 3) Cache-Control header"
grep -iq '^cache-control: .*max-age=60' "$tmp_headers" || {
  echo "FAIL: Cache-Control missing max-age=60"
  cat "$tmp_headers"
  exit 1
}
echo "PASS: Cache-Control policy present"

echo "==> 4) Viewer OG tags"
html="$(curl -sS "$VIEW_URL")"
echo "$html" | grep -q 'property="og:image"' || { echo 'FAIL: missing og:image'; exit 1; }
echo "$html" | grep -q 'property="og:title"' || { echo 'FAIL: missing og:title'; exit 1; }
echo "$html" | grep -q 'property="og:description"' || { echo 'FAIL: missing og:description'; exit 1; }
echo "PASS: viewer OG tags present"

echo "==> 5) Fallback OG image"
fallback_status="$(curl -sS -o /dev/null -w "%{http_code}" "$FALLBACK_IMAGE_URL")"
if [[ "$fallback_status" != "200" ]]; then
  echo "FAIL: fallback image returned HTTP ${fallback_status}"
  exit 1
fi
echo "PASS: fallback image is reachable"

echo "SUCCESS: social preview smoke checks passed"
