# Project Portal API Documentation

## Overview
The Project Portal API allows projects to authenticate and access their data including clients, quotes, invoices, and analytics. When a project is created, an OTP (One-Time Password) is sent to the project's email address. The project can then use this OTP to set a password and access the portal.

**Base URL**: `http://localhost:3020/api`

---

## Authentication Flow

### 1. Project Creation (Admin Only)
When an admin creates a project, an OTP is automatically generated and sent to the project's email.

**Endpoint**: `POST /projects`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer {ADMIN_ACCESS_TOKEN}
```

**Request Body**:
```json
{
  "name": "Project Name",
  "email": "project@example.com",
  "projectType": "Web Development",
  "address": "123 Main Street",
  "city": "San Francisco",
  "state": "California",
  "country": "United States"
}
```

**Response** (200 OK):
```json
{
  "id": "cmhxylcee0002pqg8t4gtzox2",
  "name": "Project Name",
  "email": "project@example.com",
  "projectType": "Web Development",
  "address": "123 Main Street",
  "city": "San Francisco",
  "state": "California",
  "country": "United States",
  "createdAt": "2025-11-13T21:46:36.422Z",
  "updatedAt": "2025-11-13T21:46:36.422Z",
  "isActive": true,
  "isPasswordChanged": false
}
```

**Note**: An email with a 6-digit OTP will be sent to the project's email address. The OTP is valid for 24 hours.

---

### 2. Verify OTP and Set Password
Use the OTP received via email to set a password for the project.

**Endpoint**: `POST /project-auth/verify-otp`

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "project@example.com",
  "otp": "161207",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password set successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "project": {
    "id": "cmhxylcee0002pqg8t4gtzox2",
    "name": "Project Name",
    "email": "project@example.com"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid OTP or OTP expired
- `404 Not Found`: Project not found

---

### 3. Login with Password
After setting a password, projects can login using their email and password.

**Endpoint**: `POST /project-auth/login`

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "project@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "project": {
    "id": "cmhxylcee0002pqg8t4gtzox2",
    "name": "Project Name",
    "email": "project@example.com"
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid email or password
- `404 Not Found`: Project not found

---

## Protected Endpoints

All endpoints below require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer {PROJECT_TOKEN}
```

---

### 4. Get Project Profile
Retrieve the authenticated project's profile information.

**Endpoint**: `GET /project-portal/profile`

**Headers**:
```
Authorization: Bearer {PROJECT_TOKEN}
```

**Response** (200 OK):
```json
{
  "id": "cmhxylcee0002pqg8t4gtzox2",
  "name": "Project Name",
  "email": "project@example.com",
  "projectType": "Web Development",
  "address": "123 Main Street",
  "city": "San Francisco",
  "state": "California",
  "country": "United States",
  "createdAt": "2025-11-13T21:46:36.422Z",
  "updatedAt": "2025-11-13T21:46:36.422Z",
  "isActive": true
}
```

---

### 5. Get Project Clients
Retrieve all clients associated with the project.

**Endpoint**: `GET /project-portal/clients`

**Headers**:
```
Authorization: Bearer {PROJECT_TOKEN}
```

**Response** (200 OK):
```json
[
  {
    "id": "client_id_1",
    "name": "Client Name",
    "email": "client@example.com",
    "phone": "+1234567890",
    "address": "456 Client Street",
    "city": "Los Angeles",
    "state": "California",
    "country": "United States",
    "createdAt": "2025-11-13T10:00:00.000Z"
  }
]
```

---

### 6. Get Project Quotes
Retrieve all quotes for the project. Optionally filter by status.

**Endpoint**: `GET /project-portal/quotes?status={STATUS}`

**Headers**:
```
Authorization: Bearer {PROJECT_TOKEN}
```

**Query Parameters**:
- `status` (optional): Filter by quote status (`DRAFT`, `SENT`, `SIGNED`, `EXPIRED`)

**Response** (200 OK):
```json
[
  {
    "id": "quote_id_1",
    "quoteNumber": "Q-2025-001",
    "status": "SENT",
    "totalAmount": 5000.00,
    "currency": "USD",
    "validUntil": "2025-12-31T23:59:59.000Z",
    "createdAt": "2025-11-13T10:00:00.000Z",
    "client": {
      "id": "client_id_1",
      "name": "Client Name"
    }
  }
]
```

---

### 7. Get Project Invoices
Retrieve all invoices for the project. Optionally filter by status.

**Endpoint**: `GET /project-portal/invoices?status={STATUS}`

**Headers**:
```
Authorization: Bearer {PROJECT_TOKEN}
```

**Query Parameters**:
- `status` (optional): Filter by invoice status (`DRAFT`, `SENT`, `PAID`, `UNPAID`, `OVERDUE`)

**Response** (200 OK):
```json
[
  {
    "id": "invoice_id_1",
    "invoiceNumber": "INV-2025-001",
    "status": "PAID",
    "totalAmount": 5000.00,
    "currency": "USD",
    "dueDate": "2025-12-15T00:00:00.000Z",
    "createdAt": "2025-11-13T10:00:00.000Z",
    "client": {
      "id": "client_id_1",
      "name": "Client Name"
    }
  }
]
```

---

### 8. Get Project Analytics
Retrieve comprehensive analytics for the project including client count, revenue overview, quotes, and invoices statistics.

**Endpoint**: `GET /project-portal/analytics?year={YEAR}&currency={CURRENCY}`

**Headers**:
```
Authorization: Bearer {PROJECT_TOKEN}
```

**Query Parameters**:
- `year` (optional): Filter by year (default: current year)
- `currency` (optional): Filter by currency (default: USD)

**Response** (200 OK):
```json
{
  "totalClients": 5,
  "revenueOverview": {
    "totalRevenue": 50000.00,
    "currency": "USD",
    "byMonth": [
      {
        "month": "January",
        "revenue": 5000.00
      },
      {
        "month": "February",
        "revenue": 7500.00
      }
    ]
  },
  "quotes": {
    "total": 20,
    "draft": 3,
    "sent": 10,
    "signed": 5,
    "expired": 2,
    "recentQuotes": [
      {
        "id": "quote_id_1",
        "quoteNumber": "Q-2025-001",
        "status": "SENT",
        "totalAmount": 5000.00,
        "createdAt": "2025-11-13T10:00:00.000Z",
        "client": {
          "name": "Client Name"
        }
      }
    ]
  },
  "invoices": {
    "total": 15,
    "unpaid": 3,
    "sent": 5,
    "paid": 10,
    "overdue": 2,
    "recentInvoices": [
      {
        "id": "invoice_id_1",
        "invoiceNumber": "INV-2025-001",
        "status": "PAID",
        "totalAmount": 5000.00,
        "createdAt": "2025-11-13T10:00:00.000Z",
        "client": {
          "name": "Client Name"
        }
      }
    ]
  }
}
```

---

### 9. Change Password
Change the project's password.

**Endpoint**: `POST /project-auth/change-password`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer {PROJECT_TOKEN}
```

**Request Body**:
```json
{
  "currentPassword": "SecurePass123!",
  "newPassword": "NewSecurePass456!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Current password is incorrect
- `401 Unauthorized`: Invalid or expired token

---

### 10. Create Client
Create a new client for the project. A welcome email will be sent to the client.

**Endpoint**: `POST /project-portal/clients`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer {PROJECT_TOKEN}
```

**Request Body**:
```json
{
  "name": "Client Company Name",
  "contactFirstname": "John",
  "contactLastname": "Doe",
  "contactEmail": "john@clientcompany.com",
  "contactPhone": "+1234567890",
  "address": "456 Client Street",
  "postalCode": "12345",
  "city": "Los Angeles",
  "country": "United States",
  "currency": "USD",
  "description": "Client description",
  "legalId": "123456789",
  "VAT": "VAT123456",
  "isActive": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Client created successfully. Welcome email sent.",
  "client": {
    "id": "client_id",
    "name": "Client Company Name",
    "contactEmail": "john@clientcompany.com",
    "projectId": "project_id",
    "createdAt": "2025-11-13T10:00:00.000Z"
  }
}
```

**Note**: A welcome email is automatically sent to the client's email address.

---

### 11. Create Quote
Create a new quote for a client. The quote PDF will be sent to the client via email.

**Endpoint**: `POST /project-portal/quotes`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer {PROJECT_TOKEN}
```

**Request Body**:
```json
{
  "clientId": "client_id",
  "title": "Website Development Quote",
  "validUntil": "2025-12-31T23:59:59.000Z",
  "currency": "USD",
  "paymentMethod": "Bank Transfer",
  "paymentDetails": "Account: 123456789",
  "notes": "Thank you for your business",
  "items": [
    {
      "description": "Website Design",
      "quantity": 1,
      "unitPrice": 2000.00,
      "vatRate": 20,
      "order": 1
    },
    {
      "description": "Website Development",
      "quantity": 1,
      "unitPrice": 3000.00,
      "vatRate": 20,
      "order": 2
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Quote created successfully. Email sent to client.",
  "quote": {
    "id": "quote_id",
    "number": 1,
    "status": "DRAFT",
    "totalHT": 5000.00,
    "totalVAT": 1000.00,
    "totalTTC": 6000.00,
    "currency": "USD",
    "createdAt": "2025-11-13T10:00:00.000Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Client not found or does not belong to this project

**Note**: The quote PDF is automatically generated and sent to the client's email address.

---

### 12. Create Invoice
Create a new invoice for a client. The invoice PDF will be sent to the client via email.

**Endpoint**: `POST /project-portal/invoices`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer {PROJECT_TOKEN}
```

**Request Body**:
```json
{
  "clientId": "client_id",
  "dueDate": "2025-12-15T00:00:00.000Z",
  "currency": "USD",
  "paymentMethod": "Bank Transfer",
  "paymentDetails": "Account: 123456789",
  "notes": "Payment due within 30 days",
  "items": [
    {
      "description": "Website Design",
      "quantity": 1,
      "unitPrice": 2000.00,
      "vatRate": 20,
      "order": 1
    },
    {
      "description": "Website Development",
      "quantity": 1,
      "unitPrice": 3000.00,
      "vatRate": 20,
      "order": 2
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Invoice created successfully. Email sent to client.",
  "invoice": {
    "id": "invoice_id",
    "number": 1,
    "status": "UNPAID",
    "totalHT": 5000.00,
    "totalVAT": 1000.00,
    "totalTTC": 6000.00,
    "currency": "USD",
    "dueDate": "2025-12-15T00:00:00.000Z",
    "createdAt": "2025-11-13T10:00:00.000Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Client not found or does not belong to this project

**Note**: The invoice PDF is automatically generated and sent to the client's email address.

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "message": "Error description",
  "error": "Error Type",
  "statusCode": 400
}
```

### Common HTTP Status Codes:
- `200 OK`: Request successful
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## TypeScript/JavaScript Integration Examples

### 1. Verify OTP and Set Password
```typescript
const verifyOTP = async (email: string, otp: string, password: string) => {
  const response = await fetch('http://localhost:3020/api/project-auth/verify-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, otp, password }),
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Store token in localStorage or state management
    localStorage.setItem('projectToken', data.token);
    return data.project;
  } else {
    throw new Error(data.message);
  }
};
```

### 2. Login
```typescript
const login = async (email: string, password: string) => {
  const response = await fetch('http://localhost:3020/api/project-auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('projectToken', data.token);
    return data.project;
  } else {
    throw new Error(data.message);
  }
};
```

### 3. Get Project Profile
```typescript
const getProfile = async () => {
  const token = localStorage.getItem('projectToken');
  
  const response = await fetch('http://localhost:3020/api/project-portal/profile', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return await response.json();
};
```

### 4. Get Analytics
```typescript
const getAnalytics = async (year?: number, currency?: string) => {
  const token = localStorage.getItem('projectToken');
  const params = new URLSearchParams();

  if (year) params.append('year', year.toString());
  if (currency) params.append('currency', currency);

  const response = await fetch(
    `http://localhost:3020/api/project-portal/analytics?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  return await response.json();
};
```

### 5. Create Client
```typescript
const createClient = async (clientData: {
  name: string;
  contactFirstname: string;
  contactLastname: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  currency: string;
  description?: string;
  legalId?: string;
  VAT?: string;
  isActive: boolean;
}) => {
  const token = localStorage.getItem('projectToken');

  const response = await fetch('http://localhost:3020/api/project-portal/clients', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(clientData),
  });

  const data = await response.json();

  if (data.success) {
    return data.client;
  } else {
    throw new Error(data.message);
  }
};
```

### 6. Create Quote
```typescript
const createQuote = async (quoteData: {
  clientId: string;
  title?: string;
  validUntil?: Date;
  currency?: string;
  paymentMethod?: string;
  paymentDetails?: string;
  notes: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    order: number;
  }>;
}) => {
  const token = localStorage.getItem('projectToken');

  const response = await fetch('http://localhost:3020/api/project-portal/quotes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(quoteData),
  });

  const data = await response.json();

  if (data.success) {
    return data.quote;
  } else {
    throw new Error(data.message);
  }
};
```

### 7. Create Invoice
```typescript
const createInvoice = async (invoiceData: {
  clientId: string;
  dueDate?: Date;
  currency?: string;
  paymentMethod?: string;
  paymentDetails?: string;
  notes: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    order: number;
  }>;
}) => {
  const token = localStorage.getItem('projectToken');

  const response = await fetch('http://localhost:3020/api/project-portal/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(invoiceData),
  });

  const data = await response.json();

  if (data.success) {
    return data.invoice;
  } else {
    throw new Error(data.message);
  }
};
```

---

## Notes

1. **Token Expiration**: JWT tokens expire after 7 days. Store the token securely and implement re-authentication when expired.
2. **OTP Validity**: OTPs are valid for 24 hours from generation.
3. **Password Requirements**: Passwords must be at least 8 characters long.
4. **Email Delivery**: OTPs are sent via email. Ensure the project email is valid and accessible.
5. **Security**: Always use HTTPS in production environments.
6. **Rate Limiting**: Consider implementing rate limiting on authentication endpoints to prevent brute force attacks.
7. **Token Storage**: Store JWT tokens securely (e.g., in httpOnly cookies or secure localStorage).

---

## Support

For issues or questions, please contact the development team or refer to the main API documentation.

