#!/bin/bash

echo "Testing API flow..."

# Load environment variables
if [ -f "viewer/.env.local" ]; then
  export $(cat viewer/.env.local | grep -v '^#' | xargs)
elif [ -f ".env.local" ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Load environment
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$ANON_KEY" ]; then
  echo "❌ Environment variables not set. Run verify-environment.sh first."
  exit 1
fi

# Test 1: Check if Edge Functions are deployed
echo "1. Checking Edge Functions deployment..."

# Test get-link function with a test request
echo "2. Testing get-link Edge Function..."

# Create a test request (this will fail if no test link exists, which is expected)
TEST_SHORTCODE="test123"

echo "   Testing metadata endpoint..."
METADATA_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "${SUPABASE_URL}/functions/v1/get-link" \
  -H "Content-Type: application/json" \
  -H "apikey: ${ANON_KEY}" \
  -d "{\"shortCode\": \"${TEST_SHORTCODE}\", \"action\": \"metadata\"}" 2>&1)

HTTP_CODE=$(echo "$METADATA_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$METADATA_RESPONSE" | sed '/HTTP_CODE:/d')

echo "   Response code: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✓ Edge Function is accessible and returned 200"
  if command -v jq &> /dev/null; then
    if echo "$RESPONSE_BODY" | jq -e '.signedUrl' > /dev/null 2>&1; then
      echo "   ✓ Response contains signedUrl field"
    fi
  fi
elif [ "$HTTP_CODE" = "404" ]; then
  echo "   ✓ Edge Function is accessible (404 expected for non-existent link)"
elif [ "$HTTP_CODE" = "000" ]; then
  echo "   ❌ Edge Function not accessible (connection failed)"
  echo "   Check if Edge Functions are deployed"
else
  echo "   ⚠️  Edge Function returned HTTP $HTTP_CODE"
fi

# Test 2: Test create-link function (requires auth)
echo ""
echo "3. Testing create-link Edge Function..."
echo "   Note: This requires authentication, testing endpoint accessibility only"

CREATE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "${SUPABASE_URL}/functions/v1/create-link" \
  -H "Content-Type: application/json" \
  -H "apikey: ${ANON_KEY}" \
  -d "{}" 2>&1)

HTTP_CODE=$(echo "$CREATE_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "   ✓ Edge Function is accessible (auth required as expected)"
elif [ "$HTTP_CODE" = "200" ]; then
  echo "   ⚠️  Edge Function accessible without auth (unexpected)"
elif [ "$HTTP_CODE" = "000" ]; then
  echo "   ❌ Edge Function not accessible (connection failed)"
else
  echo "   ⚠️  Edge Function returned HTTP $HTTP_CODE"
fi

echo ""
echo "✅ API flow tests complete"
echo ""
echo "📋 Manual Testing Required:"
echo "   1. Create a link via mobile app"
echo "   2. Note the shortCode"
echo "   3. Test get-link endpoint with real shortCode"
echo "   4. Verify full flow: metadata → download → key → decrypt"
