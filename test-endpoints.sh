#!/bin/bash

BASE_URL="http://localhost:3020/api"
PROJECT_EMAIL="testportal1763070203@example.com"
OTP="587065"
PASSWORD="SecurePass123!"

echo "=========================================="
echo "TESTING PROJECT PORTAL ENDPOINTS"
echo "=========================================="
echo ""

# Test 1: Verify OTP and Set Password
echo "1️⃣  Testing: Verify OTP and Set Password"
VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/project-auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"otp\": \"$OTP\",
    \"password\": \"$PASSWORD\"
  }")

echo "$VERIFY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$VERIFY_RESPONSE"
PROJECT_TOKEN=$(echo $VERIFY_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "✅ Token received: ${PROJECT_TOKEN:0:50}..."
echo ""

# Test 2: Login with Password
echo "2️⃣  Testing: Login with Password"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/project-auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
PROJECT_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "✅ New token received: ${PROJECT_TOKEN:0:50}..."
echo ""

# Test 3: Get Project Profile
echo "3️⃣  Testing: Get Project Profile"
PROFILE_RESPONSE=$(curl -s -X GET "$BASE_URL/project-portal/profile" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo "$PROFILE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PROFILE_RESPONSE"
echo ""

# Test 4: Get Project Clients
echo "4️⃣  Testing: Get Project Clients"
CLIENTS_RESPONSE=$(curl -s -X GET "$BASE_URL/project-portal/clients" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo "$CLIENTS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CLIENTS_RESPONSE"
echo ""

# Test 5: Get Project Quotes
echo "5️⃣  Testing: Get Project Quotes"
QUOTES_RESPONSE=$(curl -s -X GET "$BASE_URL/project-portal/quotes" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo "$QUOTES_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$QUOTES_RESPONSE"
echo ""

# Test 6: Get Project Invoices
echo "6️⃣  Testing: Get Project Invoices"
INVOICES_RESPONSE=$(curl -s -X GET "$BASE_URL/project-portal/invoices" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo "$INVOICES_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$INVOICES_RESPONSE"
echo ""

# Test 7: Get Project Analytics
echo "7️⃣  Testing: Get Project Analytics"
ANALYTICS_RESPONSE=$(curl -s -X GET "$BASE_URL/project-portal/analytics?year=2025&currency=USD" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo "$ANALYTICS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ANALYTICS_RESPONSE"
echo ""

# Test 8: Change Password
echo "8️⃣  Testing: Change Password"
NEW_PASSWORD="NewSecurePass456!"
CHANGE_PASSWORD_RESPONSE=$(curl -s -X POST "$BASE_URL/project-auth/change-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROJECT_TOKEN" \
  -d "{
    \"currentPassword\": \"$PASSWORD\",
    \"newPassword\": \"$NEW_PASSWORD\"
  }")

echo "$CHANGE_PASSWORD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CHANGE_PASSWORD_RESPONSE"
echo ""

# Test 9: Login with New Password
echo "9️⃣  Testing: Login with New Password"
NEW_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/project-auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"password\": \"$NEW_PASSWORD\"
  }")

echo "$NEW_LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$NEW_LOGIN_RESPONSE"
NEW_TOKEN=$(echo $NEW_LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$NEW_TOKEN" ]; then
  echo "✅ Successfully logged in with new password!"
else
  echo "❌ Failed to login with new password"
fi
echo ""

echo "=========================================="
echo "✅ ALL TESTS COMPLETED!"
echo "=========================================="
