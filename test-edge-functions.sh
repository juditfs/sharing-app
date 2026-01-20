#!/bin/bash
# Test script for Phase 1 Edge Functions

PROJECT_REF="ndbqasanctkwagyinfag"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYnFhc2FuY3Rrd2FneWluZmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzM4MjAsImV4cCI6MjA4NDQwOTgyMH0.jOJE9ELPitovSroaoFi-q5_OZmf2V44Iy29ca0lp0Jc"

echo "=== Step 1: Create anonymous session ==="
SESSION_RESPONSE=$(curl -s -X POST "https://${PROJECT_REF}.supabase.co/auth/v1/signup" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$SESSION_RESPONSE" | jq '.'

# Extract access token
ACCESS_TOKEN=$(echo "$SESSION_RESPONSE" | jq -r '.access_token')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo ""
    echo "❌ Failed to create anonymous session."
    echo "Make sure you've enabled Anonymous Sign-ins in the Supabase Dashboard:"
    echo "https://supabase.com/dashboard/project/${PROJECT_REF}/auth/users"
    exit 1
fi

echo ""
echo "✅ Anonymous session created!"
echo "Access Token: ${ACCESS_TOKEN:0:20}..."
echo ""

echo "=== Step 2: Test create-link Edge Function ==="
CREATE_RESPONSE=$(curl -s -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/create-link" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "photoUrl": "test/photo.jpg",
    "encryptionKey": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  }')

echo "$CREATE_RESPONSE" | jq '.'

# Extract short code
SHORT_CODE=$(echo "$CREATE_RESPONSE" | jq -r '.shortCode')

if [ "$SHORT_CODE" == "null" ] || [ -z "$SHORT_CODE" ]; then
    echo ""
    echo "❌ Failed to create link."
    exit 1
fi

echo ""
echo "✅ Link created successfully!"
echo "Short Code: $SHORT_CODE"
echo ""

echo "=== Step 3: Test get-link Edge Function (metadata) ==="
curl -s "https://${PROJECT_REF}.supabase.co/functions/v1/get-link?shortCode=${SHORT_CODE}&action=metadata" | jq '.'

echo ""
echo "=== Step 4: Test get-link Edge Function (key) ==="
curl -s "https://${PROJECT_REF}.supabase.co/functions/v1/get-link?shortCode=${SHORT_CODE}&action=key" | jq '.'

echo ""
echo "✅ All tests completed!"
