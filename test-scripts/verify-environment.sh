#!/bin/bash

echo "Verifying test environment..."

# Load environment variables from viewer/.env.local
if [ -f "viewer/.env.local" ]; then
  export $(cat viewer/.env.local | grep -v '^#' | xargs)
  echo "✓ Loaded environment from viewer/.env.local"
elif [ -f ".env.local" ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
  echo "✓ Loaded environment from .env.local"
fi

# Check Supabase connection
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_URL not set"
  echo "   Create viewer/.env.local with Supabase credentials"
  exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not set"
  echo "   Create viewer/.env.local with Supabase credentials"
  exit 1
fi

echo "✓ Environment variables configured"

# Check if exiftool is installed
if ! command -v exiftool &> /dev/null; then
  echo "⚠️  exiftool not found. Install with: brew install exiftool"
  echo "   (Required for EXIF validation tests)"
else
  echo "✓ exiftool installed"
fi

# Check if jq is installed (for JSON parsing)
if ! command -v jq &> /dev/null; then
  echo "⚠️  jq not found. Install with: brew install jq"
  echo "   (Required for API response parsing)"
else
  echo "✓ jq installed"
fi

# Test Supabase connection
echo "Testing Supabase connection..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/")

if [ "$RESPONSE" = "200" ]; then
  echo "✓ Supabase connection successful"
else
  echo "❌ Supabase connection failed (HTTP $RESPONSE)"
  exit 1
fi

echo ""
echo "✅ Environment verification complete"
