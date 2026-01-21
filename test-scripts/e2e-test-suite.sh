#!/bin/bash

# Sharene E2E Test Suite
# Runs all automated tests for Phase 4

set -e

echo "🧪 Sharene E2E Test Suite"
echo "=========================="
echo ""

# Load environment variables
if [ -f "viewer/.env.local" ]; then
  export $(cat viewer/.env.local | grep -v '^#' | xargs)
  echo "✓ Loaded environment from viewer/.env.local"
elif [ -f ".env.local" ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
  echo "✓ Loaded environment from .env.local"
fi
echo ""

# Test 1: Environment Setup
echo "✓ Test 1: Environment Setup"
./test-scripts/verify-environment.sh

# Test 2: Functional API Tests
echo ""
echo "✓ Test 2: Functional API Tests"
./test-scripts/test-api-flow.sh

# Test 3: Security Validation
echo ""
echo "✓ Test 3: Security Validation"
./test-scripts/test-security.sh

# Test 4: Image Processing
echo ""
echo "✓ Test 4: Image Processing"
./test-scripts/test-image-processing.sh

echo ""
echo "=========================="
echo "✅ All automated tests completed!"
echo ""
echo "📋 Next Steps:"
echo "  1. Review test results above"
echo "  2. Run manual tests (see test-scripts/manual-test-checklist.md)"
echo "  3. Document findings in test report"
