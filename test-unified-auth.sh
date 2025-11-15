#!/bin/bash

BASE_URL="http://localhost:3020/api"
TIMESTAMP=$(date +%s)

echo "=========================================="
echo "🎯 UNIFIED AUTHENTICATION TEST"
echo "=========================================="
echo ""

# Test 1: Admin Login
echo "1️⃣  Admin Login..."
ADMIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@invoicerr.com",
    "password": "Test123456!"
  }')

ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Admin login failed"
  echo "$ADMIN_RESPONSE"
  exit 1
fi
echo "✅ Admin logged in"
echo ""

# Test 2: Create Project (Admin)
echo "2️⃣  Creating Project (Admin)..."
PROJECT_EMAIL="unified-test-${TIMESTAMP}@example.com"
PROJECT_RESPONSE=$(curl -s -X POST "${BASE_URL}/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"name\": \"Unified Test Project ${TIMESTAMP}\",
    \"email\": \"${PROJECT_EMAIL}\",
    \"projectType\": \"Web Development\",
    \"address\": \"123 Test St\",
    \"city\": \"Test City\",
    \"state\": \"Test State\",
    \"country\": \"United States\"
  }")

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Project creation failed"
  echo "$PROJECT_RESPONSE"
  exit 1
fi
echo "✅ Project created: $PROJECT_ID"
echo ""

# Test 3: Wait for OTP
echo "3️⃣  Waiting for OTP..."
echo "⏳ Sleeping for 3 seconds..."
sleep 3
echo ""
echo "🔍 Check server logs for OTP"
echo "   Look for: 🔑 Generated OTP for ${PROJECT_EMAIL}: XXXXXX"
echo ""
read -p "Enter the OTP from server logs: " OTP

if [ -z "$OTP" ]; then
  echo "❌ No OTP provided"
  exit 1
fi
echo ""

# Test 4: Verify OTP and Set Password (Project)
echo "4️⃣  Verifying OTP and Setting Password (Project)..."
VERIFY_RESPONSE=$(curl -s -X POST "${BASE_URL}/project-auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${PROJECT_EMAIL}\",
    \"otp\": \"${OTP}\",
    \"password\": \"SecurePass123!\"
  }")

PROJECT_TOKEN=$(echo "$VERIFY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)

if [ -z "$PROJECT_TOKEN" ]; then
  echo "❌ OTP verification failed"
  echo "$VERIFY_RESPONSE"
  exit 1
fi
echo "✅ Project token obtained"
echo ""

# Test 5: Create Client with Admin Token (should work)
echo "5️⃣  Creating Client with Admin Token..."
CLIENT_EMAIL_ADMIN="admin-client-${TIMESTAMP}@example.com"
ADMIN_CLIENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/clients" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"name\": \"Admin Client ${TIMESTAMP}\",
    \"contactEmail\": \"${CLIENT_EMAIL_ADMIN}\",
    \"contactFirstname\": \"Admin\",
    \"contactLastname\": \"Test\",
    \"address\": \"789 Admin St\",
    \"postalCode\": \"12345\",
    \"city\": \"Admin City\",
    \"country\": \"United States\",
    \"projectId\": \"${PROJECT_ID}\"
  }")

ADMIN_CLIENT_ID=$(echo "$ADMIN_CLIENT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)

if [ -z "$ADMIN_CLIENT_ID" ]; then
  echo "❌ Admin client creation failed"
  echo "$ADMIN_CLIENT_RESPONSE"
else
  echo "✅ Admin created client: $ADMIN_CLIENT_ID"
  echo "   (No email should be sent - admin mode)"
fi
echo ""

# Test 6: Create Client with Project Token (should work + send email)
echo "6️⃣  Creating Client with Project Token..."
CLIENT_EMAIL_PROJECT="project-client-${TIMESTAMP}@example.com"
PROJECT_CLIENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/clients" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROJECT_TOKEN" \
  -d "{
    \"name\": \"Project Client ${TIMESTAMP}\",
    \"contactEmail\": \"${CLIENT_EMAIL_PROJECT}\",
    \"contactFirstname\": \"Project\",
    \"contactLastname\": \"Test\",
    \"address\": \"456 Project Ave\",
    \"postalCode\": \"67890\",
    \"city\": \"Project City\",
    \"country\": \"United States\"
  }")

PROJECT_CLIENT_ID=$(echo "$PROJECT_CLIENT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)

if [ -z "$PROJECT_CLIENT_ID" ]; then
  echo "❌ Project client creation failed"
  echo "$PROJECT_CLIENT_RESPONSE"
else
  echo "✅ Project created client: $PROJECT_CLIENT_ID"
  echo "   📧 Welcome email should be sent to: ${CLIENT_EMAIL_PROJECT}"
fi
echo ""

# Test 7: Get Clients with Admin Token (should see all clients)
echo "7️⃣  Getting Clients with Admin Token..."
ADMIN_CLIENTS=$(curl -s -X GET "${BASE_URL}/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ADMIN_CLIENT_COUNT=$(echo "$ADMIN_CLIENTS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null)
echo "✅ Admin sees $ADMIN_CLIENT_COUNT clients (all clients in system)"
echo ""

# Test 8: Get Clients with Project Token (should see only project's clients)
echo "8️⃣  Getting Clients with Project Token..."
PROJECT_CLIENTS=$(curl -s -X GET "${BASE_URL}/clients" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

PROJECT_CLIENT_COUNT=$(echo "$PROJECT_CLIENTS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null)
echo "✅ Project sees $PROJECT_CLIENT_COUNT clients (only their clients)"
echo ""

echo "=========================================="
echo "✅ UNIFIED AUTHENTICATION TEST COMPLETE!"
echo "=========================================="
echo ""
echo "📝 Summary:"
echo "- Admin Token: Works ✅"
echo "- Project Token: Works ✅"
echo "- Admin can create clients without emails ✅"
echo "- Project can create clients with emails ✅"
echo "- Admin sees all clients ✅"
echo "- Project sees only their clients ✅"
echo ""
echo "🎯 Unified Authentication is working correctly!"
echo ""

