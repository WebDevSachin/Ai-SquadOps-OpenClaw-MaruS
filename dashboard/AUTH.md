# SquadOps Authentication

This directory contains the authentication system for the SquadOps dashboard.

## Structure

```
dashboard/
├── app/
│   ├── auth/
│   │   ├── layout.tsx              # Auth pages layout (no sidebar)
│   │   ├── login/
│   │   │   └── page.tsx            # Login page
│   │   ├── signup/
│   │   │   └── page.tsx            # Signup page with password strength
│   │   └── forgot-password/
│   │       └── page.tsx            # Password reset request page
│   └── layout.tsx                  # Root layout with AuthProvider
├── components/
│   ├── AuthGuard.tsx               # Route protection component
│   └── LogoutButton.tsx            # Logout button component
├── hooks/
│   └── useAuth.ts                  # Auth context and hook
└── lib/
    └── api.ts                      # Axios instance with interceptors
```

## Features

### Login Page (`/auth/login`)
- Email/password form with validation
- Error handling with user-friendly messages
- Session expired notification
- Password visibility toggle
- Redirect to original URL after login
- Link to signup and forgot password

### Signup Page (`/auth/signup`)
- Name, email, password, confirm password fields
- Real-time password strength indicator
- Password requirements checklist
- Terms of service acceptance
- Auto-login after successful registration
- Link to login page

### Forgot Password Page (`/auth/forgot-password`)
- Email input form
- Success state with confirmation message
- Security: shows success even if email doesn't exist (prevents user enumeration)

### Auth Hook (`useAuth`)
```typescript
const { 
  user,           // Current user object
  isLoading,      // Auth state loading
  isAuthenticated,// Boolean auth status
  isAdmin,        // Boolean admin status
  login,          // (credentials) => Promise
  logout,         // () => void
  register,       // (data) => Promise
  refreshUser     // () => Promise
} = useAuth();
```

### Auth Guard (`AuthGuard`)
```typescript
// Protect routes
<AuthGuard>
  <ProtectedContent />
</AuthGuard>

// Admin-only routes
<AuthGuard requireAdmin>
  <AdminContent />
</AuthGuard>

// Conditional rendering
<AuthenticatedOnly>
  <ShowWhenLoggedIn />
</AuthenticatedOnly>

<AdminOnly>
  <ShowWhenAdmin />
</AdminOnly>
```

### API Client (`lib/api`)
- Base URL from `NEXT_PUBLIC_API_URL` env var
- Automatic JWT header injection
- Token refresh on 401 errors
- Redirects to login on session expiry
- Token storage in localStorage + cookie

## Environment Variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000  # API server URL
```

## Usage

### Protecting a Page

```typescript
"use client";

import { AuthGuard } from "@/components/AuthGuard";

export default function ProtectedPage() {
  return (
    <AuthGuard>
      <div>Protected content</div>
    </AuthGuard>
  );
}
```

### Admin-Only Page

```typescript
"use client";

import { AuthGuard } from "@/components/AuthGuard";

export default function AdminPage() {
  return (
    <AuthGuard requireAdmin>
      <div>Admin-only content</div>
    </AuthGuard>
  );
}
```

### Using Auth Hook

```typescript
"use client";

import { useAuth } from "@/hooks/useAuth";

export default function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Making Authenticated API Calls

```typescript
import api from "@/lib/api";

// Token is automatically injected
const response = await api.get("/tasks");
const tasks = response.data;
```

## JWT Token Flow

1. User logs in with email/password
2. Server validates and returns JWT token + user data
3. Token stored in:
   - localStorage (for JavaScript access)
   - Cookie (for SSR/middleware if needed)
4. Axios interceptor adds `Authorization: Bearer <token>` header
5. On 401 response, token is cleared and user redirected to login

## Security Considerations

- JWT tokens expire after 7 days (server-side)
- Rate limiting on auth endpoints (5 attempts per 15 minutes)
- Passwords must be at least 8 characters
- Password strength indicator encourages strong passwords
- httpOnly cookie flag should be set server-side for production
- HTTPS required for production deployments
