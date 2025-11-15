#!/bin/bash

BASE_URL="http://localhost:3020/api"

echo "=========================================="
echo "🎯 MANUAL TEST - Project Portal Create"
echo "=========================================="
echo ""

# Use the existing project from the logs
PROJECT_EMAIL="test-create-1763074091@example.com"
OTP="371186"
PROJECT_ID="cmhy0skhd0003pqrlzmskw5ns"

echo "Using existing project:"
echo "- Email: $PROJECT_EMAIL"
echo "- OTP: $OTP"
echo "- ID: $PROJECT_ID"
echo ""

# 1. Verify OTP and Set Password
echo "1️⃣  Verify OTP and Set Password"
VERIFY_RESPONSE=$(curl -s -X POST "${BASE_URL}/project-auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${PROJECT_EMAIL}\",
    \"otp\": \"${OTP}\",
    \"password\": \"SecurePass123!\"
  }")

echo "$VERIFY_RESPONSE" | python3 -m json.tool
PROJECT_TOKEN=$(echo "$VERIFY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

if [ -z "$PROJECT_TOKEN" ]; then
  echo "❌ OTP verification failed"
  exit 1
fi
echo "✅ OTP verified and password set"
echo ""

# 2. Get Company ID
echo "2️⃣  Getting Company ID..."
COMPANY_RESPONSE=$(curl -s -X GET "${BASE_URL}/company/info" \
  -H "Authorization: Bearer $PROJECT_TOKEN")
COMPANY_ID=$(echo "$COMPANY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

if [ -z "$COMPANY_ID" ]; then
  echo "❌ Could not get company ID"
  echo "$COMPANY_RESPONSE"
  exit 1
fi
echo "✅ Company ID: $COMPANY_ID"
echo ""

# 3. Create Client (via Project Portal)
echo "3️⃣  Create Client via Project Portal"
TIMESTAMP=$(date +%s)
CLIENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/project-portal/clients" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROJECT_TOKEN" \
  -d "{
    \"name\": \"Test Client ${TIMESTAMP}\",
    \"contactEmail\": \"client-${TIMESTAMP}@example.com\",
    \"contactName\": \"John Doe\",
    \"address\": \"456 Client Ave\",
    \"city\": \"Client City\",
    \"state\": \"Client State\",
    \"country\": \"United States\"
  }")

echo "$CLIENT_RESPONSE" | python3 -m json.tool
CLIENT_ID=$(echo "$CLIENT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['client']['id'])" 2>/dev/null)

if [ -z "$CLIENT_ID" ]; then
  echo "❌ Client creation failed"
  exit 1
fi
echo "✅ Client created: $CLIENT_ID"
echo "📧 Welcome email should be sent to client-${TIMESTAMP}@example.com"
echo ""

# 4. Create Quote (via Project Portal)
echo "4️⃣  Create Quote via Project Portal"
QUOTE_RESPONSE=$(curl -s -X POST "${BASE_URL}/project-portal/quotes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROJECT_TOKEN" \
  -d "{
    \"clientId\": \"${CLIENT_ID}\",
    \"companyId\": \"${COMPANY_ID}\",
    \"status\": \"DRAFT\",
    \"currency\": \"USD\",
    \"items\": [
      {
        \"description\": \"Web Development Services\",
        \"quantity\": 10,
        \"rate\": 100,
        \"amount\": 1000
      }
    ]
  }")

echo "$QUOTE_RESPONSE" | python3 -m json.tool
QUOTE_ID=$(echo "$QUOTE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['quote']['id'])" 2>/dev/null)

if [ -z "$QUOTE_ID" ]; then
  echo "❌ Quote creation failed"
  exit 1
fi
echo "✅ Quote created: $QUOTE_ID"
echo "📧 Quote PDF should be sent to client-${TIMESTAMP}@example.com"
echo ""

# 5. Create Invoice (via Project Portal)
echo "5️⃣  Create Invoice via Project Portal"
INVOICE_RESPONSE=$(curl -s -X POST "${BASE_URL}/project-portal/invoices" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROJECT_TOKEN" \
  -d "{
    \"clientId\": \"${CLIENT_ID}\",
    \"companyId\": \"${COMPANY_ID}\",
    \"status\": \"UNPAID\",
    \"currency\": \"USD\",
    \"items\": [
      {
        \"description\": \"Consulting Services\",
        \"quantity\": 5,
        \"rate\": 150,
        \"amount\": 750
      }
    ]
  }")

echo "$INVOICE_RESPONSE" | python3 -m json.tool
INVOICE_ID=$(echo "$INVOICE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['invoice']['id'])" 2>/dev/null)

if [ -z "$INVOICE_ID" ]; then
  echo "❌ Invoice creation failed"
  exit 1
fi
echo "✅ Invoice created: $INVOICE_ID"
echo "📧 Invoice PDF should be sent to client-${TIMESTAMP}@example.com"
echo ""

echo "=========================================="
echo "✅ ALL TESTS PASSED!"
echo "=========================================="
echo ""
echo "📝 Summary:"
echo "- Client ID: $CLIENT_ID"
echo "- Quote ID: $QUOTE_ID"
echo "- Invoice ID: $INVOICE_ID"
echo ""
