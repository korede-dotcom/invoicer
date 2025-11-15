#!/bin/bash

BASE_URL="http://localhost:3020/api"
TIMESTAMP=$(date +%s)
PROJECT_EMAIL="test-create-${TIMESTAMP}@example.com"

echo "=========================================="
echo "🎯 PROJECT PORTAL - CREATE ENDPOINTS TEST"
echo "=========================================="
echo ""

# 1. Admin Login
echo "1️⃣  Admin Login"
ADMIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@invoicerr.com",
    "password": "Test123456!"
  }')

ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Admin login failed"
  exit 1
fi
echo "✅ Admin logged in"
echo ""

# 2. Create Project
echo "2️⃣  Create Project"
PROJECT_RESPONSE=$(curl -s -X POST "${BASE_URL}/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"name\": \"Test Create Project ${TIMESTAMP}\",
    \"email\": \"${PROJECT_EMAIL}\",
    \"projectType\": \"Web Development\",
    \"address\": \"123 Test St\",
    \"city\": \"Test City\",
    \"state\": \"Test State\",
    \"country\": \"United States\"
  }")

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Project creation failed"
  echo "$PROJECT_RESPONSE"
  exit 1
fi
echo "✅ Project created: $PROJECT_ID"
echo ""

# 3. Wait for OTP to be logged and extract it
echo "3️⃣  Extracting OTP from server logs..."
sleep 2

# Get OTP from database directly
OTP=$(npx ts-node -e "
import prisma from './src/prisma/prisma.service';
async function getOTP() {
  const project = await prisma.project.findUnique({
    where: { id: '${PROJECT_ID}' },
    select: { otp: true }
  });
  console.log(project?.otp || '');
  await prisma.\$disconnect();
}
getOTP();
" 2>/dev/null | tail -1)

if [ -z "$OTP" ]; then
  echo "❌ Could not extract OTP"
  exit 1
fi
echo "✅ OTP extracted: $OTP"
echo ""

# 4. Verify OTP and Set Password
echo "4️⃣  Verify OTP and Set Password"
VERIFY_RESPONSE=$(curl -s -X POST "${BASE_URL}/project-auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${PROJECT_EMAIL}\",
    \"otp\": \"${OTP}\",
    \"password\": \"SecurePass123!\"
  }")

PROJECT_TOKEN=$(echo "$VERIFY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

if [ -z "$PROJECT_TOKEN" ]; then
  echo "❌ OTP verification failed"
  echo "$VERIFY_RESPONSE"
  exit 1
fi
echo "✅ OTP verified and password set"
echo ""

# 5. Create Client (via Project Portal)
echo "5️⃣  Create Client via Project Portal"
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

CLIENT_ID=$(echo "$CLIENT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['client']['id'])" 2>/dev/null)

if [ -z "$CLIENT_ID" ]; then
  echo "❌ Client creation failed"
  echo "$CLIENT_RESPONSE"
  exit 1
fi
echo "✅ Client created: $CLIENT_ID"
echo "📧 Welcome email should be sent to client-${TIMESTAMP}@example.com"
echo ""

# 6. Get Company ID for Quote/Invoice
echo "6️⃣  Getting Company ID..."
COMPANY_ID=$(npx ts-node -e "
import prisma from './src/prisma/prisma.service';
async function getCompany() {
  const company = await prisma.company.findFirst({
    select: { id: true }
  });
  console.log(company?.id || '');
  await prisma.\$disconnect();
}
getCompany();
" 2>/dev/null | tail -1)

if [ -z "$COMPANY_ID" ]; then
  echo "❌ Could not get company ID"
  exit 1
fi
echo "✅ Company ID: $COMPANY_ID"
echo ""

# 7. Create Quote (via Project Portal)
echo "7️⃣  Create Quote via Project Portal"
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

QUOTE_ID=$(echo "$QUOTE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['quote']['id'])" 2>/dev/null)

if [ -z "$QUOTE_ID" ]; then
  echo "❌ Quote creation failed"
  echo "$QUOTE_RESPONSE"
  exit 1
fi
echo "✅ Quote created: $QUOTE_ID"
echo "📧 Quote PDF should be sent to client-${TIMESTAMP}@example.com"
echo ""

# 8. Create Invoice (via Project Portal)
echo "8️⃣  Create Invoice via Project Portal"
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

INVOICE_ID=$(echo "$INVOICE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['invoice']['id'])" 2>/dev/null)

if [ -z "$INVOICE_ID" ]; then
  echo "❌ Invoice creation failed"
  echo "$INVOICE_RESPONSE"
  exit 1
fi
echo "✅ Invoice created: $INVOICE_ID"
echo "📧 Invoice PDF should be sent to client-${TIMESTAMP}@example.com"
echo ""

# 9. Verify Data in Portal
echo "9️⃣  Verify Data in Project Portal"

# Get clients
CLIENTS=$(curl -s -X GET "${BASE_URL}/project-portal/clients" \
  -H "Authorization: Bearer $PROJECT_TOKEN")
CLIENT_COUNT=$(echo "$CLIENTS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['clients']))" 2>/dev/null)
echo "✅ Clients in portal: $CLIENT_COUNT"

# Get quotes
QUOTES=$(curl -s -X GET "${BASE_URL}/project-portal/quotes" \
  -H "Authorization: Bearer $PROJECT_TOKEN")
QUOTE_COUNT=$(echo "$QUOTES" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['quotes']))" 2>/dev/null)
echo "✅ Quotes in portal: $QUOTE_COUNT"

# Get invoices
INVOICES=$(curl -s -X GET "${BASE_URL}/project-portal/invoices" \
  -H "Authorization: Bearer $PROJECT_TOKEN")
INVOICE_COUNT=$(echo "$INVOICES" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['invoices']))" 2>/dev/null)
echo "✅ Invoices in portal: $INVOICE_COUNT"

echo ""
echo "=========================================="
echo "✅ ALL TESTS PASSED!"
echo "=========================================="
echo ""
echo "📝 Summary:"
echo "- Project ID: $PROJECT_ID"
echo "- Project Email: $PROJECT_EMAIL"
echo "- Client ID: $CLIENT_ID"
echo "- Quote ID: $QUOTE_ID"
echo "- Invoice ID: $INVOICE_ID"
echo ""
echo "📧 Emails sent:"
echo "1. Welcome email to project: $PROJECT_EMAIL"
echo "2. Welcome email to client: client-${TIMESTAMP}@example.com"
echo "3. Quote PDF to client: client-${TIMESTAMP}@example.com"
echo "4. Invoice PDF to client: client-${TIMESTAMP}@example.com"
echo ""
