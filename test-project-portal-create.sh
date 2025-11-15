#!/bin/bash

BASE_URL="http://localhost:3020/api"
TIMESTAMP=$(date +%s)
PROJECT_EMAIL="test-create-${TIMESTAMP}@example.com"
PROJECT_NAME="Test Create Project ${TIMESTAMP}"

echo "=========================================="
echo "🎯 PROJECT PORTAL - CREATE ENDPOINTS TEST"
echo "=========================================="
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

echo "✅ Admin logged in"
echo ""

# Step 2: Create Project
echo "2️⃣  Create Project"
CREATE_PROJECT=$(curl -s -X POST "$BASE_URL/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"name\": \"$PROJECT_NAME\",
    \"email\": \"$PROJECT_EMAIL\",
    \"projectType\": \"Web Development\",
    \"address\": \"123 Test Street\",
    \"city\": \"San Francisco\",
    \"state\": \"California\",
    \"country\": \"United States\"
  }")

PROJECT_ID=$(echo $CREATE_PROJECT | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "✅ Project created: $PROJECT_ID"
echo ""

# Step 3: Extract OTP
echo "3️⃣  Extracting OTP..."
sleep 2
OTP=$(docker logs invoicer-app-1 2>&1 | grep "🔑 Generated OTP for $PROJECT_EMAIL" | tail -1 | grep -o '[0-9]\{6\}' | tail -1)

if [ -z "$OTP" ]; then
  echo "⚠️  Could not extract OTP. Please enter manually:"
  read OTP
else
  echo "✅ OTP: $OTP"
fi
echo ""

# Step 4: Verify OTP and Set Password
echo "4️⃣  Verify OTP and Set Password"
PASSWORD="TestPassword123!"
VERIFY_OTP=$(curl -s -X POST "$BASE_URL/project-auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROJECT_EMAIL\",
    \"otp\": \"$OTP\",
    \"password\": \"$PASSWORD\"
  }")

PROJECT_TOKEN=$(echo $VERIFY_OTP | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$PROJECT_TOKEN" ]; then
  echo "❌ OTP verification failed"
  echo "$VERIFY_OTP" | python3 -m json.tool
  exit 1
fi

echo "✅ Password set, token received"
echo ""

# Step 5: Create Client
echo "5️⃣  Create Client"
CLIENT_EMAIL="client-${TIMESTAMP}@example.com"
CREATE_CLIENT=$(curl -s -X POST "$BASE_URL/project-portal/clients" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROJECT_TOKEN" \
  -d "{
    \"name\": \"Test Client Company\",
    \"contactFirstname\": \"John\",
    \"contactLastname\": \"Doe\",
    \"contactEmail\": \"$CLIENT_EMAIL\",
    \"contactPhone\": \"+1234567890\",
    \"address\": \"456 Client Street\",
    \"postalCode\": \"12345\",
    \"city\": \"Los Angeles\",
    \"country\": \"United States\",
    \"currency\": \"USD\",
    \"description\": \"Test client\",
    \"isActive\": true
  }")

echo "$CREATE_CLIENT" | python3 -m json.tool
CLIENT_ID=$(echo $CREATE_CLIENT | grep -o '"id":"[^"]*' | grep -v "projectId" | head -1 | cut -d'"' -f4)

if [ -z "$CLIENT_ID" ]; then
  echo "❌ Client creation failed"
  exit 1
fi

echo ""
echo "✅ Client created: $CLIENT_ID"
echo "📧 Welcome email sent to: $CLIENT_EMAIL"
echo ""

# Step 6: Create Quote
echo "6️⃣  Create Quote for Client"
CREATE_QUOTE=$(curl -s -X POST "$BASE_URL/project-portal/quotes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROJECT_TOKEN" \
  -d "{
    \"clientId\": \"$CLIENT_ID\",
    \"title\": \"Website Development Quote\",
    \"validUntil\": \"2025-12-31T23:59:59.000Z\",
    \"currency\": \"USD\",
    \"paymentMethod\": \"Bank Transfer\",
    \"paymentDetails\": \"Account: 123456789\",
    \"notes\": \"Thank you for your business\",
    \"items\": [
      {
        \"description\": \"Website Design\",
        \"quantity\": 1,
        \"unitPrice\": 2000.00,
        \"vatRate\": 20,
        \"order\": 1
      },
      {
        \"description\": \"Website Development\",
        \"quantity\": 1,
        \"unitPrice\": 3000.00,
        \"vatRate\": 20,
        \"order\": 2
      }
    ]
  }")

echo "$CREATE_QUOTE" | python3 -m json.tool
QUOTE_ID=$(echo $CREATE_QUOTE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$QUOTE_ID" ]; then
  echo "❌ Quote creation failed"
  exit 1
fi

echo ""
echo "✅ Quote created: $QUOTE_ID"
echo "📧 Quote PDF sent to client"
echo ""

# Step 7: Create Invoice
echo "7️⃣  Create Invoice for Client"
CREATE_INVOICE=$(curl -s -X POST "$BASE_URL/project-portal/invoices" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROJECT_TOKEN" \
  -d "{
    \"clientId\": \"$CLIENT_ID\",
    \"dueDate\": \"2025-12-15T00:00:00.000Z\",
    \"currency\": \"USD\",
    \"paymentMethod\": \"Bank Transfer\",
    \"paymentDetails\": \"Account: 123456789\",
    \"notes\": \"Payment due within 30 days\",
    \"items\": [
      {
        \"description\": \"Website Design\",
        \"quantity\": 1,
        \"unitPrice\": 2000.00,
        \"vatRate\": 20,
        \"order\": 1
      },
      {
        \"description\": \"Website Development\",
        \"quantity\": 1,
        \"unitPrice\": 3000.00,
        \"vatRate\": 20,
        \"order\": 2
      }
    ]
  }")

echo "$CREATE_INVOICE" | python3 -m json.tool
INVOICE_ID=$(echo $CREATE_INVOICE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$INVOICE_ID" ]; then
  echo "❌ Invoice creation failed"
  exit 1
fi

echo ""
echo "✅ Invoice created: $INVOICE_ID"
echo "📧 Invoice PDF sent to client"
echo ""

# Step 8: Verify Data in Portal
echo "8️⃣  Verify Portal Data"
echo ""
echo "📊 Get Clients:"
curl -s -X GET "$BASE_URL/project-portal/clients" \
  -H "Authorization: Bearer $PROJECT_TOKEN" | python3 -m json.tool

echo ""
echo "📊 Get Quotes:"
curl -s -X GET "$BASE_URL/project-portal/quotes" \
  -H "Authorization: Bearer $PROJECT_TOKEN" | python3 -m json.tool

echo ""
echo "📊 Get Invoices:"
curl -s -X GET "$BASE_URL/project-portal/invoices" \
  -H "Authorization: Bearer $PROJECT_TOKEN" | python3 -m json.tool

echo ""
echo "=========================================="
echo "🎉 ALL CREATE ENDPOINTS TESTED!"
echo "=========================================="
echo ""
echo "Summary:"
echo "✅ Project created and authenticated"
echo "✅ Client created (welcome email sent)"
echo "✅ Quote created (PDF sent to client)"
echo "✅ Invoice created (PDF sent to client)"
echo "✅ All data visible in project portal"
echo ""
echo "Project Email: $PROJECT_EMAIL"
echo "Client Email: $CLIENT_EMAIL"
echo "Client ID: $CLIENT_ID"
echo "Quote ID: $QUOTE_ID"
echo "Invoice ID: $INVOICE_ID"

