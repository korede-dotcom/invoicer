# Authentication API Usage Guide

## Overview
This API supports **Bearer Token authentication** for cross-origin requests. HttpOnly cookies are also set for backward compatibility but are **not required** for API access.

## Cross-Origin Setup

### 1. Login
**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**JavaScript Example:**
```javascript
const response = await fetch('http://188.212.124.39:3020/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'your-password'
  })
});

const data = await response.json();
// Store tokens in localStorage or memory
localStorage.setItem('access_token', data.access_token);
localStorage.setItem('refresh_token', data.refresh_token);
```

### 2. Making Authenticated Requests
**Use the `Authorization` header with Bearer token:**

```javascript
const accessToken = localStorage.getItem('access_token');

const response = await fetch('http://188.212.124.39:3020/api/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
});

const userData = await response.json();
```

### 3. Refresh Access Token
**Endpoint:** `POST /api/auth/refresh`

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "message": "Tokens refreshed successfully",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**JavaScript Example:**
```javascript
const refreshToken = localStorage.getItem('refresh_token');

const response = await fetch('http://188.212.124.39:3020/api/auth/refresh', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    refresh_token: refreshToken
  })
});

const data = await response.json();
// Update access token
localStorage.setItem('access_token', data.access_token);
```

### 4. Logout
**Endpoint:** `POST /api/auth/logout`

```javascript
await fetch('http://188.212.124.39:3020/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  }
});

// Clear stored tokens
localStorage.removeItem('access_token');
localStorage.removeItem('refresh_token');
```

## Token Lifetimes
- **Access Token:** 15 minutes
- **Refresh Token:** 7 days

## Error Handling
When you receive a `401 Unauthorized` response:
1. Try to refresh the access token using the refresh token
2. If refresh fails, redirect user to login

**Example with automatic token refresh:**
```javascript
async function fetchWithAuth(url, options = {}) {
  let accessToken = localStorage.getItem('access_token');
  
  // Add Authorization header
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
  };
  
  let response = await fetch(url, options);
  
  // If unauthorized, try to refresh token
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refresh_token');
    
    const refreshResponse = await fetch('http://188.212.124.39:3020/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    
    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      localStorage.setItem('access_token', data.access_token);
      
      // Retry original request with new token
      options.headers['Authorization'] = `Bearer ${data.access_token}`;
      response = await fetch(url, options);
    } else {
      // Refresh failed, redirect to login
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }
  
  return response;
}

// Usage
const response = await fetchWithAuth('http://188.212.124.39:3020/api/auth/me');
const userData = await response.json();
```

## CORS Configuration
The server is configured to accept requests from:
- `http://localhost:5173`
- `http://188.212.124.39:5173`
- Any origins specified in `CORS_ORIGINS` environment variable

## Security Notes
1. **Never store tokens in cookies when making cross-origin requests** - they won't be sent
2. **Use localStorage or sessionStorage** for token storage in cross-origin scenarios
3. **Always use HTTPS in production** to protect tokens in transit
4. **The server sets HttpOnly cookies** for backward compatibility, but they are not required for API access

