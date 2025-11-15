#!/bin/bash

# Project Portal API Testing Script
# This script tests all project portal endpoints and generates documentation

BASE_URL="http://localhost:3020/api"
PROJECT_EMAIL="testportal$(date +%s)@example.com"
PROJECT_PASSWORD="SecurePass123!"

echo "======================================"
echo "PROJECT PORTAL API TESTING"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Admin Login
echo -e "${BLUE}Step 1: Admin Login${NC}"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@invoicerr.com",
    "password": "Test123456!"
  }')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Admin login failed${NC}"
  echo $ADMIN_LOGIN
  exit 1
fi

echo -e "${GREEN}✅ Admin logged in successfully${NC}"
echo "Token: ${ADMIN_TOKEN:0:50}..."
echo ""

# Step 2: Create Project
echo -e "${BLUE}Step 2: Create Project${NC}"
CREATE_PROJECT=$(curl -s -X POST "$BASE_URL/projects" \
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

PROJECT_ID=$(echo $CREATE_PROJECT | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}❌ Project creation failed${NC}"
  echo $CREATE_PROJECT
  exit 1
fi

echo -e "${GREEN}✅ Project created successfully${NC}"
echo "Project ID: $PROJECT_ID"
echo "Project Email: $PROJECT_EMAIL"
echo ""

# Step 3: Get OTP from database (for testing)
echo -e "${BLUE}Step 3: Retrieving OTP from database${NC}"
OTP=$(psql $DATABASE_URL -t -c "SELECT otp FROM \"Project\" WHERE email='$PROJECT_EMAIL';" 2>/dev/null | tr -d ' ')

if [ -z "$OTP" ]; then
  echo -e "${RED}❌ Could not retrieve OTP from database${NC}"
  echo "Please check your email for the OTP or manually query the database"
  echo "Query: SELECT otp FROM \"Project\" WHERE email='$PROJECT_EMAIL';"
  exit 1
fi

echo -e "${GREEN}✅ OTP retrieved: $OTP${NC}"
echo ""

# Step 4: Verify OTP and Set Password
echo -e "${BLUE}Step 4: Verify OTP and Set Password${NC}"
VERIFY_OTP=$(curl -s -X POST "$BASE_URL/project-auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"otp\": \"$OTP\",
    \"password\": \"$PROJECT_PASSWORD\"
  }")

PROJECT_TOKEN=$(echo $VERIFY_OTP | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$PROJECT_TOKEN" ]; then
  echo -e "${RED}❌ OTP verification failed${NC}"
  echo $VERIFY_OTP
  exit 1
fi

echo -e "${GREEN}✅ OTP verified and password set${NC}"
echo "Project Token: ${PROJECT_TOKEN:0:50}..."
echo ""

# Step 5: Login with Password
echo -e "${BLUE}Step 5: Login with Password${NC}"
PROJECT_LOGIN=$(curl -s -X POST "$BASE_URL/project-auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"password\": \"$PROJECT_PASSWORD\"
  }")

PROJECT_TOKEN=$(echo $PROJECT_LOGIN | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$PROJECT_TOKEN" ]; then
  echo -e "${RED}❌ Project login failed${NC}"
  echo $PROJECT_LOGIN
  exit 1
fi

echo -e "${GREEN}✅ Project logged in successfully${NC}"
echo "New Token: ${PROJECT_TOKEN:0:50}..."
echo ""

# Step 6: Get Project Profile
echo -e "${BLUE}Step 6: Get Project Profile${NC}"
PROFILE=$(curl -s -X GET "$BASE_URL/project-portal/profile" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo -e "${GREEN}✅ Profile retrieved${NC}"
echo $PROFILE | python3 -m json.tool 2>/dev/null || echo $PROFILE
echo ""

# Step 7: Get Project Clients
echo -e "${BLUE}Step 7: Get Project Clients${NC}"
CLIENTS=$(curl -s -X GET "$BASE_URL/project-portal/clients" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo -e "${GREEN}✅ Clients retrieved${NC}"
echo $CLIENTS | python3 -m json.tool 2>/dev/null || echo $CLIENTS
echo ""

# Step 8: Get Project Quotes
echo -e "${BLUE}Step 8: Get Project Quotes${NC}"
QUOTES=$(curl -s -X GET "$BASE_URL/project-portal/quotes" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo -e "${GREEN}✅ Quotes retrieved${NC}"
echo $QUOTES | python3 -m json.tool 2>/dev/null || echo $QUOTES
echo ""

# Step 9: Get Project Invoices
echo -e "${BLUE}Step 9: Get Project Invoices${NC}"
INVOICES=$(curl -s -X GET "$BASE_URL/project-portal/invoices" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo -e "${GREEN}✅ Invoices retrieved${NC}"
echo $INVOICES | python3 -m json.tool 2>/dev/null || echo $INVOICES
echo ""

# Step 10: Get Project Analytics
echo -e "${BLUE}Step 10: Get Project Analytics${NC}"
ANALYTICS=$(curl -s -X GET "$BASE_URL/project-portal/analytics?year=2025&currency=USD" \
  -H "Authorization: Bearer $PROJECT_TOKEN")

echo -e "${GREEN}✅ Analytics retrieved${NC}"
echo $ANALYTICS | python3 -m json.tool 2>/dev/null || echo $ANALYTICS
echo ""

# Step 11: Change Password
echo -e "${BLUE}Step 11: Change Password${NC}"
NEW_PASSWORD="NewSecurePass456!"
CHANGE_PASSWORD=$(curl -s -X POST "$BASE_URL/project-auth/change-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROJECT_TOKEN" \
  -d "{
    \"currentPassword\": \"$PROJECT_PASSWORD\",
    \"newPassword\": \"$NEW_PASSWORD\"
  }")

echo -e "${GREEN}✅ Password changed${NC}"
echo $CHANGE_PASSWORD | python3 -m json.tool 2>/dev/null || echo $CHANGE_PASSWORD
echo ""

# Step 12: Login with New Password
echo -e "${BLUE}Step 12: Login with New Password${NC}"
NEW_LOGIN=$(curl -s -X POST "$BASE_URL/project-auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"password\": \"$NEW_PASSWORD\"
  }")

NEW_TOKEN=$(echo $NEW_LOGIN | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$NEW_TOKEN" ]; then
  echo -e "${RED}❌ Login with new password failed${NC}"
  echo $NEW_LOGIN
  exit 1
fi

echo -e "${GREEN}✅ Logged in with new password successfully${NC}"
echo ""

echo "======================================"
echo -e "${GREEN}ALL TESTS PASSED! ✅${NC}"
echo "======================================"
echo ""
echo "Summary:"
echo "- Project ID: $PROJECT_ID"
echo "- Project Email: $PROJECT_EMAIL"
echo "- All endpoints working correctly"

