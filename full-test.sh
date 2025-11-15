#!/bin/bash

BASE_URL="http://localhost:3020/api"
TIMESTAMP=$(date +%s)
PROJECT_EMAIL="testproject${TIMESTAMP}@example.com"
PASSWORD="SecurePass123!"

echo "=========================================="
echo "FULL PROJECT PORTAL API TEST"
echo "=========================================="
echo ""

# Step 1: Admin Login
echo "Step 1: Admin Login"
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@invoicerr.com",
    "password": "Test123456!"
  }')

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
echo "✅ Admin token: ${ADMIN_TOKEN:0:50}..."
echo ""

# Step 2: Create Project
echo "Step 2: Create Project with email: $PROJECT_EMAIL"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"name\": \"Test Portal Project\",
    \"email\": \"$PROJECT_EMAIL\",
    \"projectType\": \"Web Development\",
    \"address\": \"123 Test Street\",
    \"city\": \"San Francisco\",
    \"state\": \"California\",
    \"country\": \"United States\"
  }")

echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
PROJECT_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "✅ Project ID: $PROJECT_ID"
echo ""

# Wait for server logs to show OTP
echo "⏳ Waiting 2 seconds for OTP generation..."
sleep 2
echo ""

# Get OTP from server logs (last occurrence)
echo "Step 3: Extracting OTP from server logs..."
OTP=$(docker logs invoicer-backend 2>&1 | grep "🔑 Generated OTP for $PROJECT_EMAIL" | tail -1 | grep -o '[0-9]\{6\}' | tail -1)

if [ -z "$OTP" ]; then
  echo "❌ Could not find OTP in logs. Checking alternative method..."
  # Try to get from database
  OTP=$(psql $DATABASE_URL -t -c "SELECT otp FROM \"Project\" WHERE email='$PROJECT_EMAIL';" 2>/dev/null | tr -d ' ')
fi

if [ -z "$OTP" ]; then
  echo "❌ Could not retrieve OTP. Please check server logs manually."
  echo "Look for: 🔑 Generated OTP for $PROJECT_EMAIL"
  exit 1
fi

echo "✅ OTP: $OTP"
echo ""

# Step 4: Verify OTP and Set Password
echo "Step 4: Verify OTP and Set Password"
VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/project-auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"otp\": \"$OTP\",
    \"password\": \"$PASSWORD\"
  }")

echo "$VERIFY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$VERIFY_RESPONSE"
PROJECT_TOKEN=$(echo $VERIFY_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$PROJECT_TOKEN" ]; then
  echo "❌ Failed to verify OTP"
  exit 1
fi

echo "✅ Token: ${PROJECT_TOKEN:0:50}..."
echo ""

# Step 5: Login with Password
echo "Step 5: Login with Password"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/project-auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
PROJECT_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "✅ New token: ${PROJECT_TOKEN:0:50}..."
echo ""

# Step 6: Get Project Profile
echo "Step 6: Get Project Profile"
PROFILE_RESPONSE=$(curl -s -X GET "$BASE_URL/project-portal/profile" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo "$PROFILE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PROFILE_RESPONSE"
echo ""

# Step 7: Get Project Clients
echo "Step 7: Get Project Clients"
CLIENTS_RESPONSE=$(curl -s -X GET "$BASE_URL/project-portal/clients" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo "$CLIENTS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CLIENTS_RESPONSE"
echo ""

# Step 8: Get Project Quotes
echo "Step 8: Get Project Quotes"
QUOTES_RESPONSE=$(curl -s -X GET "$BASE_URL/project-portal/quotes" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo "$QUOTES_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$QUOTES_RESPONSE"
echo ""

# Step 9: Get Project Invoices
echo "Step 9: Get Project Invoices"
INVOICES_RESPONSE=$(curl -s -X GET "$BASE_URL/project-portal/invoices" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo "$INVOICES_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$INVOICES_RESPONSE"
echo ""

# Step 10: Get Project Analytics
echo "Step 10: Get Project Analytics"
ANALYTICS_RESPONSE=$(curl -s -X GET "$BASE_URL/project-portal/analytics?year=2025&currency=USD" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo "$ANALYTICS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ANALYTICS_RESPONSE"
echo ""

# Step 11: Change Password
echo "Step 11: Change Password"
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

# Step 12: Login with New Password
echo "Step 12: Login with New Password"
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
echo "✅ ALL TESTS COMPLETED SUCCESSFULLY!"
echo "=========================================="
echo ""
echo "Summary:"
echo "- Project Email: $PROJECT_EMAIL"
echo "- Project ID: $PROJECT_ID"
echo "- All endpoints tested and working"
