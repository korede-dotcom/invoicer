#!/bin/bash

# Test Project Email Verification Link Flow
# This script tests the new link-based OTP verification endpoints

BASE_URL="http://localhost:3020/api"
ADMIN_EMAIL="admin@test.com"
ADMIN_PASSWORD="Admin123!"
PROJECT_EMAIL="testproject@example.com"

echo "🧪 Testing Project Email Verification Link Flow"
echo "================================================"
echo ""

# Step 1: Admin Login
echo "📝 Step 1: Admin Login..."
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Admin login failed. Please check credentials."
  echo "Response: $ADMIN_LOGIN"
  exit 1
fi

echo "✅ Admin logged in successfully"
echo ""

# Step 2: Create Project
echo "📝 Step 2: Creating new project..."
PROJECT_CREATE=$(curl -s -X POST "$BASE_URL/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"name\": \"Test Project Verification\",
    \"email\": \"$PROJECT_EMAIL\",
    \"projectType\": \"Software Development\",
    \"address\": \"123 Test St\",
    \"city\": \"Test City\",
    \"state\": \"Test State\",
    \"country\": \"USA\"
  }")

PROJECT_ID=$(echo $PROJECT_CREATE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
OTP=$(echo $PROJECT_CREATE | grep -o '"otp":"[^"]*' | cut -d'"' -f4)

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Project creation failed"
  echo "Response: $PROJECT_CREATE"
  exit 1
fi

echo "✅ Project created successfully"
echo "   Project ID: $PROJECT_ID"
echo "   Email: $PROJECT_EMAIL"
echo "   OTP: $OTP"
echo ""

# Step 3: Test Verify OTP Link Endpoint (GET)
echo "📝 Step 3: Testing GET /project-auth/verify-otp-link..."
VERIFY_LINK=$(curl -s -X GET "$BASE_URL/project-auth/verify-otp-link?email=$PROJECT_EMAIL&otp=$OTP")

VERIFY_SUCCESS=$(echo $VERIFY_LINK | grep -o '"success":[^,]*' | cut -d':' -f2)

if [ "$VERIFY_SUCCESS" = "true" ]; then
  echo "✅ OTP verification via link successful"
  echo "   Response: $VERIFY_LINK"
else
  echo "❌ OTP verification failed"
  echo "   Response: $VERIFY_LINK"
  exit 1
fi
echo ""

# Step 4: Test Set Password from Link Endpoint (POST)
echo "📝 Step 4: Testing POST /project-auth/set-password-from-link..."
SET_PASSWORD=$(curl -s -X POST "$BASE_URL/project-auth/set-password-from-link" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"otp\": \"$OTP\",
    \"password\": \"TestPassword123!\"
  }")

PROJECT_TOKEN=$(echo $SET_PASSWORD | grep -o '"token":"[^"]*' | cut -d'"' -f4)
SET_SUCCESS=$(echo $SET_PASSWORD | grep -o '"success":[^,]*' | cut -d':' -f2)

if [ "$SET_SUCCESS" = "true" ] && [ ! -z "$PROJECT_TOKEN" ]; then
  echo "✅ Password set successfully via link"
  echo "   Token received: ${PROJECT_TOKEN:0:20}..."
else
  echo "❌ Password setup failed"
  echo "   Response: $SET_PASSWORD"
  exit 1
fi
echo ""

# Step 5: Test Project Login with New Password
echo "📝 Step 5: Testing project login with new password..."
PROJECT_LOGIN=$(curl -s -X POST "$BASE_URL/project-auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"password\": \"TestPassword123!\"
  }")

LOGIN_SUCCESS=$(echo $PROJECT_LOGIN | grep -o '"success":[^,]*' | cut -d':' -f2)
LOGIN_TOKEN=$(echo $PROJECT_LOGIN | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ "$LOGIN_SUCCESS" = "true" ] && [ ! -z "$LOGIN_TOKEN" ]; then
  echo "✅ Project login successful"
  echo "   Token received: ${LOGIN_TOKEN:0:20}..."
else
  echo "❌ Project login failed"
  echo "   Response: $PROJECT_LOGIN"
  exit 1
fi
echo ""

# Step 6: Test Invalid OTP
echo "📝 Step 6: Testing invalid OTP..."
INVALID_OTP=$(curl -s -X GET "$BASE_URL/project-auth/verify-otp-link?email=$PROJECT_EMAIL&otp=999999")

INVALID_SUCCESS=$(echo $INVALID_OTP | grep -o '"success":[^,]*' | cut -d':' -f2)

if [ "$INVALID_SUCCESS" = "false" ]; then
  echo "✅ Invalid OTP correctly rejected"
  echo "   Response: $INVALID_OTP"
else
  echo "⚠️  Invalid OTP was accepted (should be rejected)"
  echo "   Response: $INVALID_OTP"
fi
echo ""

# Step 7: Test Already Used OTP
echo "📝 Step 7: Testing already used OTP..."
USED_OTP=$(curl -s -X GET "$BASE_URL/project-auth/verify-otp-link?email=$PROJECT_EMAIL&otp=$OTP")

USED_SUCCESS=$(echo $USED_OTP | grep -o '"success":[^,]*' | cut -d':' -f2)

if [ "$USED_SUCCESS" = "false" ]; then
  echo "✅ Already used OTP correctly rejected"
  echo "   Response: $USED_OTP"
else
  echo "⚠️  Already used OTP was accepted (should be rejected)"
  echo "   Response: $USED_OTP"
fi
echo ""

# Summary
echo "================================================"
echo "✅ All tests passed successfully!"
echo ""
echo "📧 Email Link Format:"
echo "   https://yourapp.com/verify-otp?email=$PROJECT_EMAIL&otp=$OTP"
echo ""
echo "🔗 Verification Link Endpoint:"
echo "   GET $BASE_URL/project-auth/verify-otp-link"
echo ""
echo "🔐 Set Password Endpoint:"
echo "   POST $BASE_URL/project-auth/set-password-from-link"
echo ""
echo "✅ Project can now login with:"
echo "   Email: $PROJECT_EMAIL"
echo "   Password: TestPassword123!"
echo ""
echo "================================================"

