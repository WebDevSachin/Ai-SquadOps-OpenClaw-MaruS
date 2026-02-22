---
name: auth-debug
description: Debug authentication issues, JWT token problems, login failures, session management. Use when working on auth bugs, token errors, login problems, or session-related issues.
---

# Authentication Debugging Guide

## Common Issues and Solutions

### 401 Unauthorized Errors

**"Missing or invalid authorization header"**
- Client not sending `Authorization: Bearer <token>` header
- Check frontend API client configuration

**"Token has been revoked"**
- Token is blacklisted (user logged out)
- User needs to re-login

**"Token expired"**
- Access token expired (24h default)
- Client should use refresh token to get new access token

**"Invalid token type"**
- Client using refresh token as access token
- Ensure correct token is sent for the endpoint

### Login Failures

**"Invalid email or password"**
- Check password hash comparison
- Verify email exists in database
- Check account status (not suspended/inactive)

**"Account is not active"**
- User status is not "active"
- Check `users.status` field in database

**"Account is temporarily locked"**
- 5+ failed login attempts
- Check `users.locked_until` field
- Wait for lockout to expire or admin unlock

### Token Refresh Issues

**"Refresh token expired"**
- Refresh token expired (7d or 30d with rememberMe)
- User must re-login

**"Invalid refresh token"**
- Token not in Redis (revoked or never issued)
- User must re-login

### Debugging Steps

1. **Check database**:
   ```sql
   SELECT id, email, status, locked_until, failed_login_attempts
   FROM users WHERE email = 'user@example.com';
   ```

2. **Check Redis for tokens**:
   - Keys: `refresh:{userId}:*`, `token:blacklist:*`

3. **Verify JWT payload**:
   - Decode token at jwt.io
   - Check `type` claim matches expected (access/refresh)
   - Check `exp` not expired

4. **Check environment variables**:
   - `JWT_SECRET` must be set
   - `JWT_REFRESH_SECRET` should be set separately

### Password Reset Issues

**"Invalid or expired reset token"**
- Token not in Redis (expired or already used)
- Reset tokens valid for 1 hour only

### Account Lockout

To manually unlock an account:
```sql
UPDATE users
SET locked_until = NULL, failed_login_attempts = 0
WHERE email = 'user@example.com';
```

## Prevention Best Practices

- Always validate password strength before storing
- Use rate limiting on auth endpoints
- Implement proper token blacklisting on logout
- Log failed login attempts for security monitoring
