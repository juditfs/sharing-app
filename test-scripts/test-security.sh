#!/bin/bash

echo "Testing security features..."

# Load environment variables
if [ -f "viewer/.env.local" ]; then
  export $(cat viewer/.env.local | grep -v '^#' | xargs)
elif [ -f ".env.local" ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$ANON_KEY" ]; then
  echo "❌ Environment variables not set. Run verify-environment.sh first."
  exit 1
fi

# Test 1: Attempt to query link_secrets (should fail)
echo "1. Testing RLS on link_secrets table..."

SECRETS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "${SUPABASE_URL}/rest/v1/link_secrets?select=*" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" 2>&1)

HTTP_CODE=$(echo "$SECRETS_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$SECRETS_RESPONSE" | sed '/HTTP_CODE:/d')

if command -v jq &> /dev/null; then
  RESULT_COUNT=$(echo "$RESPONSE_BODY" | jq '. | length' 2>/dev/null || echo "error")
  
  if [ "$RESULT_COUNT" = "0" ]; then
    echo "   ✓ RLS blocks access to link_secrets (empty result)"
  elif echo "$RESPONSE_BODY" | jq -e '.code' > /dev/null 2>&1; then
    ERROR_CODE=$(echo "$RESPONSE_BODY" | jq -r '.code')
    echo "   ✓ RLS blocks access to link_secrets (error: $ERROR_CODE)"
  elif [ "$RESULT_COUNT" != "error" ] && [ "$RESULT_COUNT" != "0" ]; then
    echo "   ❌ WARNING: link_secrets returned $RESULT_COUNT rows!"
    echo "   Response: $RESPONSE_BODY"
  else
    echo "   ✓ RLS appears to be working (no data returned)"
  fi
else
  # Without jq, just check if response is empty or contains error
  if [ -z "$RESPONSE_BODY" ] || [ "$RESPONSE_BODY" = "[]" ]; then
    echo "   ✓ RLS blocks access to link_secrets (empty result)"
  else
    echo "   ⚠️  Response: $RESPONSE_BODY"
    echo "   (Install jq for better parsing: brew install jq)"
  fi
fi

# Test 2: Attempt to query shared_links without auth (should fail)
echo ""
echo "2. Testing RLS on shared_links table (anonymous access)..."

LINKS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "${SUPABASE_URL}/rest/v1/shared_links?select=*" \
  -H "apikey: ${ANON_KEY}" 2>&1)

HTTP_CODE=$(echo "$LINKS_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$LINKS_RESPONSE" | sed '/HTTP_CODE:/d')

if command -v jq &> /dev/null; then
  RESULT_COUNT=$(echo "$RESPONSE_BODY" | jq '. | length' 2>/dev/null || echo "error")
  
  if [ "$RESULT_COUNT" = "0" ]; then
    echo "   ✓ RLS blocks anonymous access to shared_links"
  elif echo "$RESPONSE_BODY" | jq -e '.code' > /dev/null 2>&1; then
    ERROR_CODE=$(echo "$RESPONSE_BODY" | jq -r '.code')
    echo "   ✓ RLS blocks anonymous access (error: $ERROR_CODE)"
  elif [ "$RESULT_COUNT" != "error" ] && [ "$RESULT_COUNT" != "0" ]; then
    echo "   ❌ WARNING: shared_links returned $RESULT_COUNT rows without auth!"
    echo "   Response: $RESPONSE_BODY"
  else
    echo "   ✓ RLS appears to be working (no data returned)"
  fi
else
  if [ -z "$RESPONSE_BODY" ] || [ "$RESPONSE_BODY" = "[]" ]; then
    echo "   ✓ RLS blocks anonymous access to shared_links"
  else
    echo "   ⚠️  Response: $RESPONSE_BODY"
  fi
fi

# Test 3: Storage bucket privacy
echo ""
echo "3. Testing storage bucket privacy..."
echo "   ⚠️  Storage privacy requires manual verification:"
echo "   1. Go to Supabase Dashboard → Storage"
echo "   2. Check that 'photos' bucket is set to Private"
echo "   3. Verify RLS policies are enabled on storage.objects"
echo "   4. Attempt to access a file URL directly (should fail)"

echo ""
echo "✅ Security tests complete"
echo ""
echo "📋 Manual Verification Required:"
echo "   1. Test cross-user access (create links with different users)"
echo "   2. Test signed URL expiry (wait 60+ seconds)"
echo "   3. Verify encrypted files in storage are unreadable"
