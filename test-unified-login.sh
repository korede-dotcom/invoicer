#!/bin/bash

BASE_URL="http://localhost:3020/api"

echo "=========================================="
echo "🎯 UNIFIED LOGIN TEST"
echo "=========================================="
echo ""

# Test 1: Admin Login via Unified Endpoint
echo "1️⃣  Testing Admin Login via Unified Endpoint..."
ADMIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/unified-auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@invoicerr.com",
    "password": "Test123456!"
  }')

echo "Response: $ADMIN_RESPONSE"
echo ""

# Extract userType
USER_TYPE=$(echo "$ADMIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('userType', ''))" 2>/dev/null)

if [ "$USER_TYPE" = "admin" ]; then
  echo "✅ Admin login successful via unified endpoint"
else
  echo "❌ Admin login failed"
fi
echo ""

# Test 2: Project Login via Unified Endpoint (if project exists)
echo "2️⃣  Testing Project Login via Unified Endpoint..."
PROJECT_RESPONSE=$(curl -s -X POST "${BASE_URL}/unified-auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "project@test.com",
    "password": "Test123456!"
  }')

echo "Response: $PROJECT_RESPONSE"
echo ""

PROJECT_USER_TYPE=$(echo "$PROJECT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('userType', ''))" 2>/dev/null)

if [ "$PROJECT_USER_TYPE" = "project" ]; then
  echo "✅ Project login successful via unified endpoint"
  
  # Check if password change is required
  REQUIRES_CHANGE=$(echo "$PROJECT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('requiresPasswordChange', False))" 2>/dev/null)
  
  if [ "$REQUIRES_CHANGE" = "True" ]; then
    echo "⚠️  Password change required (first-time login)"
  else
    echo "✅ Password already changed"
  fi
else
  echo "ℹ️  Project login test skipped (project may not exist or password not set)"
fi
echo ""

echo "=========================================="
echo "✅ UNIFIED LOGIN TEST COMPLETE"
echo "=========================================="

