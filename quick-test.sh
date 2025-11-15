#!/bin/bash

API_URL="http://localhost:3020/api"

echo "Testing unified login with test admin..."

# Try to signup first
SIGNUP=$(curl -s -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testadmin@test.com",
    "password": "password123",
    "firstname": "Test",
    "lastname": "Admin"
  }')

echo "Signup response: $SIGNUP"
echo ""

# Now try unified login
echo "Testing unified login..."
LOGIN=$(curl -s -X POST "$API_URL/unified-auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testadmin@test.com",
    "password": "password123"
  }')

echo "Login response:"
echo "$LOGIN" | jq '.' 2>/dev/null || echo "$LOGIN"
