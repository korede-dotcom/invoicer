# Unified Login Implementation

## Overview
This document describes the unified login system that allows both admin users and project users to log in through the same endpoint, with automatic detection and routing based on user type.

## Backend Implementation

### 1. Unified Login Endpoint

**Endpoint:** `POST /api/unified-auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response for Admin:**
```json
{
  "success": true,
  "message": "Login successful",
  "userType": "admin",
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": "user_id",
    "firstname": "John",
    "lastname": "Doe",
    "email": "admin@example.com"
  }
}
```

**Response for Project (First-time login):**
```json
{
  "success": true,
  "message": "Login successful",
  "userType": "project",
  "token": "eyJhbGc...",
  "requiresPasswordChange": true,
  "project": {
    "id": "project_id",
    "name": "Project Name",
    "email": "project@example.com",
    "isPasswordChanged": false
  }
}
```

**Response for Project (Subsequent logins):**
```json
{
  "success": true,
  "message": "Login successful",
  "userType": "project",
  "token": "eyJhbGc...",
  "requiresPasswordChange": false,
  "project": {
    "id": "project_id",
    "name": "Project Name",
    "email": "project@example.com",
    "isPasswordChanged": true
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

**Error Response (Project needs OTP verification):**
```json
{
  "success": false,
  "message": "Please verify your OTP first to set a password",
  "requiresOTP": true
}
```

### 2. How It Works

1. **Email Lookup**: The system first checks if the email belongs to an admin user
2. **Admin Path**: If user found, validates password and returns admin tokens
3. **Project Path**: If no user found, checks if email belongs to a project
4. **Project Validation**: Validates project password and checks if password change is required
5. **Token Generation**: Generates appropriate tokens based on user type

### 3. Backend Files Modified

#### `invoicer/src/modules/auth/unified-login.controller.ts` (NEW)
- Unified login controller that handles both admin and project authentication
- Automatically detects user type based on email
- Returns appropriate response format for each user type

#### `invoicer/src/modules/auth/auth.module.ts`
- Registered `UnifiedLoginController` in the AuthModule

#### `invoicer/src/modules/projects/project-auth.controller.ts`
- Modified login endpoint to return `requiresPasswordChange` flag
- Modified login endpoint to return `requiresOTP` flag when password not set
- Modified change-password endpoint to set `isPasswordChanged = true`

### 4. Database Schema

The `Project` model already has the necessary fields:
```prisma
model Project {
  // ... other fields
  password           String?   // Hashed password
  otp                String?   // One-time password for first login
  otpExpiry          DateTime? // OTP expiration time
  isPasswordChanged  Boolean   @default(false) // Track if password changed
}
```

## Frontend Implementation

### 1. Updated Login Page

**File:** `invoicing/src/app/page.tsx`

The main login page now:
- Uses the unified endpoint `/api/unified-auth/login`
- Detects user type from response
- Routes admin users to `/dashboard`
- Routes project users to `/project-portal/dashboard` or `/project-portal/change-password`
- Stores appropriate tokens based on user type

### 2. Project Portal API Service

**File:** `invoicing/src/services/projectPortalApi.ts`

Provides functions for:
- Token management (`getProjectToken`, `storeProjectToken`, `clearProjectToken`)
- Authentication (`verifyOTPAndSetPassword`, `projectLogin`, `changeProjectPassword`)
- Project data (`getProjectProfile`, `getProjectClients`, `getProjectQuotes`, etc.)
- Unified API calls (`createClient`, `createQuote`, `createInvoice`)

### 3. Project Portal Pages

#### Login Page (Optional - can use main login)
**File:** `invoicing/src/app/project-portal/login/page.tsx`
- Dedicated project login page (optional, since main login handles both)

#### OTP Verification Page
**File:** `invoicing/src/app/project-portal/verify-otp/page.tsx`
- For first-time project setup
- Verifies OTP and sets initial password

#### Change Password Page
**File:** `invoicing/src/app/project-portal/change-password/page.tsx`
- Required for first-time login
- Enforces password change on initial login
- Validates password strength

## User Flow

### Admin Login Flow
1. User enters email and password on main login page
2. System detects admin user
3. Returns admin tokens (`access_token` and `refresh_token`)
4. Redirects to `/dashboard`

### Project First-Time Login Flow
1. Admin creates project and generates OTP (sent via email)
2. Project user visits OTP verification page
3. Enters OTP and sets initial password
4. System logs them in automatically
5. Redirects to project portal dashboard

### Project Subsequent Login Flow
1. Project user enters email and password on main login page
2. System detects project user
3. If `isPasswordChanged = false`, redirects to change password page
4. If `isPasswordChanged = true`, redirects to project portal dashboard

## Security Features

1. **Password Hashing**: All passwords are hashed using bcrypt
2. **OTP Expiration**: OTPs expire after a set time period
3. **Token-based Authentication**: JWT tokens for both admin and project users
4. **Password Strength Validation**: Frontend enforces strong password requirements
5. **First-time Password Change**: Projects must change password on first login

## Testing

Run the test script:
```bash
cd invoicer
chmod +x test-unified-login.sh
./test-unified-login.sh
```

## Next Steps

1. Create project portal dashboard page
2. Implement project portal client/quote/invoice management pages
3. Add navigation for project portal
4. Test complete project portal flow

