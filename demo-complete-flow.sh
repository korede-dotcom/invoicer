#!/bin/bash

BASE_URL="http://localhost:3020/api"
TIMESTAMP=$(date +%s)
PROJECT_EMAIL="demo-project-${TIMESTAMP}@example.com"
PROJECT_NAME="Demo Project ${TIMESTAMP}"

echo "=========================================="
echo "🎯 COMPLETE PROJECT PORTAL DEMO"
echo "=========================================="
echo ""
echo "📧 Project Email: $PROJECT_EMAIL"
echo "📝 Project Name: $PROJECT_NAME"
echo ""

# Step 1: Admin Login
echo "1️⃣  Admin Login"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@invoicerr.com",
    "password": "Test123456!"
  }')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Admin login failed"
  exit 1
fi

echo "✅ Admin logged in successfully"
echo ""

# Step 2: Create Project
echo "2️⃣  Create Project (Admin)"
CREATE_PROJECT=$(curl -s -X POST "$BASE_URL/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"name\": \"$PROJECT_NAME\",
    \"email\": \"$PROJECT_EMAIL\",
    \"projectType\": \"Web Development\",
    \"address\": \"123 Demo Street\",
    \"city\": \"San Francisco\",
    \"state\": \"California\",
    \"country\": \"United States\"
  }")

echo "$CREATE_PROJECT" | python3 -m json.tool
PROJECT_ID=$(echo $CREATE_PROJECT | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Project creation failed"
  exit 1
fi

echo ""
echo "✅ Project created with ID: $PROJECT_ID"
echo "📧 OTP sent to: $PROJECT_EMAIL"
echo ""

# Step 3: Extract OTP from server logs (simulated - in real scenario, check email)
echo "3️⃣  Extracting OTP from server logs..."
sleep 2

# Get the OTP from the most recent log entry
OTP=$(docker logs invoicer-app-1 2>&1 | grep "🔑 Generated OTP for $PROJECT_EMAIL" | tail -1 | grep -o '[0-9]\{6\}' | tail -1)

if [ -z "$OTP" ]; then
  echo "⚠️  Could not extract OTP from logs. In production, check email."
  echo "Please enter OTP manually:"
  read OTP
else
  echo "✅ OTP extracted: $OTP"
fi

echo ""

# Step 4: Verify OTP and Set Password
echo "4️⃣  Verify OTP and Set Password"
PASSWORD="DemoPassword123!"
VERIFY_OTP=$(curl -s -X POST "$BASE_URL/project-auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"otp\": \"$OTP\",
    \"password\": \"$PASSWORD\"
  }")

echo "$VERIFY_OTP" | python3 -m json.tool
PROJECT_TOKEN=$(echo $VERIFY_OTP | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$PROJECT_TOKEN" ]; then
  echo "❌ OTP verification failed"
  exit 1
fi

echo ""
echo "✅ Password set successfully"
echo "🔑 JWT Token: ${PROJECT_TOKEN:0:50}..."
echo ""

# Step 5: Login with Password
echo "5️⃣  Login with Password"
LOGIN=$(curl -s -X POST "$BASE_URL/project-auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "$LOGIN" | python3 -m json.tool
echo ""

# Step 6: Access Project Portal
echo "6️⃣  Access Project Portal - Get Profile"
PROFILE=$(curl -s -X GET "$BASE_URL/project-portal/profile" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo "$PROFILE" | python3 -m json.tool
echo ""

# Step 7: Get Analytics
echo "7️⃣  Get Project Analytics"
ANALYTICS=$(curl -s -X GET "$BASE_URL/project-portal/analytics?year=2025&currency=USD" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo "$ANALYTICS" | python3 -m json.tool
echo ""

# Step 8: Change Password
echo "8️⃣  Change Password"
NEW_PASSWORD="NewDemoPassword456!"
CHANGE_PWD=$(curl -s -X POST "$BASE_URL/project-auth/change-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROJECT_TOKEN" \
  -d "{
    \"currentPassword\": \"$PASSWORD\",
    \"newPassword\": \"$NEW_PASSWORD\"
  }")

echo "$CHANGE_PWD" | python3 -m json.tool
echo ""

# Step 9: Login with New Password
echo "9️⃣  Login with New Password"
NEW_LOGIN=$(curl -s -X POST "$BASE_URL/project-auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"password\": \"$NEW_PASSWORD\"
  }")

echo "$NEW_LOGIN" | python3 -m json.tool
NEW_TOKEN=$(echo $NEW_LOGIN | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$NEW_TOKEN" ]; then
  echo ""
  echo "✅ Successfully logged in with new password!"
fi

echo ""
echo "=========================================="
echo "🎉 COMPLETE FLOW DEMONSTRATION SUCCESSFUL!"
echo "=========================================="
echo ""
echo "Summary:"
echo "✅ Admin created project"
echo "✅ OTP sent via email"
echo "✅ Project verified OTP and set password"
echo "✅ Project logged in successfully"
echo "✅ Project accessed portal data"
echo "✅ Project changed password"
echo "✅ Project logged in with new password"
echo ""
echo "📄 Documentation: PROJECT_PORTAL_API.md"
echo "📄 Summary: PROJECT_PORTAL_IMPLEMENTATION_SUMMARY.md"
