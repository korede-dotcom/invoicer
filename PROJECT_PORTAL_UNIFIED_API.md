# Project Portal - Unified API Documentation

## 🎯 Overview

The Project Portal now uses a **unified authentication system** that allows projects to use the **same endpoints as admins** for creating and managing clients, quotes, and invoices. This eliminates code duplication and provides a consistent API experience.

**Base URL**: `http://localhost:3020/api`

---

## 🔑 Key Concept: Unified Authentication

### How It Works

1. **Admin users** authenticate with their email/password and receive a **user token**
2. **Projects** authenticate with their email/password and receive a **project token**
3. **Both tokens** can be used with the same endpoints (`/clients`, `/quotes`, `/invoices`)
4. The system automatically:
   - Filters data by project when using a project token
   - Shows all data when using an admin token
   - Validates ownership before allowing modifications

### Benefits

- ✅ **No duplicate endpoints** - Projects use `/clients`, `/quotes`, `/invoices` (not `/project-portal/clients`)
- ✅ **Automatic data isolation** - Projects only see their own data
- ✅ **Automatic email sending** - Quotes and invoices automatically send PDFs when created by projects
- ✅ **Consistent API** - Same request/response format for admins and projects
- ✅ **Cleaner codebase** - Single implementation, less maintenance

---

## 🚀 Getting Started

### 1. Project Authentication

#### Verify OTP and Set Password
**Endpoint**: `POST /project-auth/verify-otp`

```bash
curl -X POST http://localhost:3020/api/project-auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "project@example.com",
    "otp": "123456",
    "password": "SecurePass123!"
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Password set successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "project": {
    "id": "project_id",
    "name": "Project Name",
    "email": "project@example.com"
  }
}
```

#### Login with Password
**Endpoint**: `POST /project-auth/login`

```bash
curl -X POST http://localhost:3020/api/project-auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "project@example.com",
    "password": "SecurePass123!"
  }'
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "project": {
    "id": "project_id",
    "name": "Project Name",
    "email": "project@example.com"
  }
}
```

---

## 📝 Using the Unified Endpoints

### Create Client

**Endpoint**: `POST /clients`

**With Project Token**:
```bash
curl -X POST http://localhost:3020/api/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {PROJECT_TOKEN}" \
  -d '{
    "name": "Client Company",
    "contactEmail": "client@example.com",
    "contactName": "John Doe",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "country": "United States"
  }'
```

**What Happens**:
- ✅ Client is automatically associated with the project
- ✅ Welcome email is sent to the client
- ✅ Client is created in the database

**Response**:
```json
{
  "id": "client_id",
  "name": "Client Company",
  "contactEmail": "client@example.com",
  "projectId": "project_id",
  ...
}
```

---

### Create Quote

**Endpoint**: `POST /quotes`

**With Project Token**:
```bash
curl -X POST http://localhost:3020/api/quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {PROJECT_TOKEN}" \
  -d '{
    "clientId": "client_id",
    "companyId": "company_id",
    "status": "DRAFT",
    "currency": "USD",
    "items": [
      {
        "description": "Web Development",
        "quantity": 10,
        "rate": 100,
        "amount": 1000
      }
    ]
  }'
```

**What Happens**:
- ✅ System verifies the client belongs to the project
- ✅ Quote is created in the database
- ✅ **Quote PDF is automatically sent to the client via email**

**Response**:
```json
{
  "id": "quote_id",
  "clientId": "client_id",
  "status": "DRAFT",
  "totalTTC": 1000,
  ...
}
```

---

### Create Invoice

**Endpoint**: `POST /invoices`

**With Project Token**:
```bash
curl -X POST http://localhost:3020/api/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {PROJECT_TOKEN}" \
  -d '{
    "clientId": "client_id",
    "companyId": "company_id",
    "status": "UNPAID",
    "currency": "USD",
    "items": [
      {
        "description": "Consulting Services",
        "quantity": 5,
        "rate": 150,
        "amount": 750
      }
    ]
  }'
```

**What Happens**:
- ✅ System verifies the client belongs to the project
- ✅ Invoice is created in the database
- ✅ **Invoice PDF is automatically sent to the client via email**

**Response**:
```json
{
  "id": "invoice_id",
  "clientId": "client_id",
  "status": "UNPAID",
  "totalTTC": 750,
  ...
}
```

---

## 📊 Reading Data

### Get Clients

**Endpoint**: `GET /clients`

**With Project Token**:
```bash
curl -X GET http://localhost:3020/api/clients \
  -H "Authorization: Bearer {PROJECT_TOKEN}"
```

**What Happens**:
- ✅ Returns only clients belonging to the project
- ✅ Automatically filtered by projectId

---

### Get Quotes

**Endpoint**: `GET /quotes`

**With Project Token**:
```bash
curl -X GET http://localhost:3020/api/quotes \
  -H "Authorization: Bearer {PROJECT_TOKEN}"
```

**What Happens**:
- ✅ Returns only quotes for clients belonging to the project
- ✅ Automatically filtered by projectId

---

### Get Invoices

**Endpoint**: `GET /invoices`

**With Project Token**:
```bash
curl -X GET http://localhost:3020/api/invoices \
  -H "Authorization: Bearer {PROJECT_TOKEN}"
```

**What Happens**:
- ✅ Returns only invoices for clients belonging to the project
- ✅ Automatically filtered by projectId

---

## 🔒 Security & Data Isolation

### Automatic Ownership Verification

When a project token is used, the system automatically:

1. **On CREATE operations**:
   - Verifies the client belongs to the project
   - Automatically sets the projectId for new clients
   - Sends emails automatically

2. **On READ operations**:
   - Filters results to show only the project's data
   - Prevents access to other projects' data

3. **On UPDATE/DELETE operations**:
   - Verifies ownership before allowing modifications
   - Returns error if resource doesn't belong to the project

### Error Responses

**If client doesn't belong to project**:
```json
{
  "statusCode": 400,
  "message": "Client does not belong to this project"
}
```

**If quote doesn't belong to project**:
```json
{
  "statusCode": 400,
  "message": "Quote does not belong to this project"
}
```

**If invoice doesn't belong to project**:
```json
{
  "statusCode": 400,
  "message": "Invoice does not belong to this project"
}
```

---

## 📧 Automatic Email Notifications

### When Projects Create Resources

| Action | Email Sent | Recipient | Content |
|--------|-----------|-----------|---------|
| Create Client | ✅ Welcome Email | Client | Welcome message |
| Create Quote | ✅ Quote PDF | Client | Quote details + PDF attachment |
| Create Invoice | ✅ Invoice PDF | Client | Invoice details + PDF attachment |

### Email Behavior

- Emails are sent **automatically** when projects create quotes/invoices
- Emails are **not sent automatically** when admins create quotes/invoices (admin must manually send)
- Email failures don't prevent resource creation (logged as errors)

---

## 🎯 Complete Example Flow

```typescript
// 1. Project logs in
const loginResponse = await fetch('http://localhost:3020/api/project-auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'project@example.com',
    password: 'SecurePass123!'
  })
});
const { token } = await loginResponse.json();

// 2. Create a client (welcome email sent automatically)
const clientResponse = await fetch('http://localhost:3020/api/clients', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Acme Corp',
    contactEmail: 'contact@acme.com',
    contactName: 'Jane Smith',
    address: '456 Business Ave',
    city: 'San Francisco',
    state: 'CA',
    country: 'United States'
  })
});
const client = await clientResponse.json();

// 3. Create a quote (PDF sent to client automatically)
const quoteResponse = await fetch('http://localhost:3020/api/quotes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    clientId: client.id,
    companyId: 'company_id',
    status: 'DRAFT',
    currency: 'USD',
    items: [{
      description: 'Website Development',
      quantity: 1,
      rate: 5000,
      amount: 5000
    }]
  })
});
const quote = await quoteResponse.json();

// 4. Create an invoice (PDF sent to client automatically)
const invoiceResponse = await fetch('http://localhost:3020/api/invoices', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    clientId: client.id,
    companyId: 'company_id',
    status: 'UNPAID',
    currency: 'USD',
    dueDate: '2025-12-31',
    items: [{
      description: 'Monthly Retainer',
      quantity: 1,
      rate: 2000,
      amount: 2000
    }]
  })
});
const invoice = await invoiceResponse.json();

// All done! Emails were sent automatically for client, quote, and invoice.
```

---

## 📝 Summary

### What Changed

- ❌ **Removed**: Duplicate `/project-portal/clients`, `/project-portal/quotes`, `/project-portal/invoices` endpoints
- ✅ **Added**: Unified authentication guard that handles both admin and project tokens
- ✅ **Enhanced**: Existing `/clients`, `/quotes`, `/invoices` endpoints now work with project tokens
- ✅ **Automatic**: Email sending for quotes/invoices when created by projects

### Benefits

- **Simpler API**: One set of endpoints for everyone
- **Less Code**: No duplication, easier maintenance
- **Better UX**: Automatic email sending for projects
- **Secure**: Automatic data isolation and ownership verification

---

**Status**: ✅ **Production Ready**  
**Last Updated**: November 13, 2025

