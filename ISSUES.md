# SquadOps Issues Log

## 🔴 Critical Issues

### Issue #1: Onboarding Data Persistence
- **Status**: NOT FIXED
- **Priority**: CRITICAL
- **Description**: After completing all 6 onboarding steps, data is not persisted to database
- **Reproduction**: Complete onboarding, refresh page - back to Step 1
- **Root Cause**: API stores data but `/api/onboarding/status` returns 404
- **Fix Required**: 
  - Implement database persistence check
  - Verify onboarding data is actually saved
  - Ensure `preferences.onboarding.completed = true` is set

### Issue #2: Dashboard React Crash
- **Status**: NOT FIXED
- **Priority**: CRITICAL  
- **Description**: User dashboard shows white screen with Minified React error #31
- **Reproduction**: Navigate to /dashboard after onboarding
- **Console Error**: `Error: Minified React error #31`
- **Fix Required**:
  - Debug React error boundary
  - Check data transformation from API
  - Add error boundaries to prevent total crashes

### Issue #3: Missing API Endpoints
- **Status**: NOT FIXED
- **Priority**: CRITICAL
- **Description**: Several API routes return 404/500
- **Affected Routes**:
  - `GET /api/v1/approvals` → 404
  - `GET /api/v1/users/stats` → 404
  - `GET /api/usage/limits` → 500
- **Fix Required**: Add routes to `api/src/index.ts`

### Issue #4: Onboarding Cookie Not Auto-Set
- **Status**: PARTIALLY FIXED
- **Priority**: CRITICAL
- **Description**: After onboarding completion, cookie not set automatically
- **Workaround**: Manually set cookie in console
- **Fix Applied**: Added `document.cookie = "onboarding=completed"` in page.tsx
- **Verification**: PENDING - requires rebuild

### Issue #5: Rate Limiting Too Strict
- **Status**: NOT FIXED
- **Priority**: HIGH
- **Description**: Account locked after few failed login attempts
- **Affected**: sachin@gmail.com locked during testing
- **Fix Required**: Add environment-based rate limiting config

## 🟡 Medium Priority

### Issue #6: Admin Middleware Bypass
- **Status**: FIXED
- **Priority**: MEDIUM
- **Description**: Admin users were being redirected to onboarding
- **Fix Applied**: Added `/admin` to ONBOARDING_EXEMPT_ROUTES in middleware.ts
- **Verification**: Working with manual cookie set

### Issue #7: API Version Consistency
- **Status**: NOT FIXED
- **Priority**: MEDIUM
- **Description**: Some APIs use `/api/v1/` prefix, others don't
- **Fix Required**: Standardize all API routes to use consistent versioning

## 🟢 Low Priority

### Issue #8: Console Warnings
- **Status**: NOT FIXED
- **Priority**: LOW
- **Description**: Password fields not in form warnings
- **Impact**: Accessibility only, no functional impact

---

## Testing Status

| Component | Status | Notes |
|-----------|--------|-------|
| Landing Page | ✅ Working | All sections render correctly |
| Login | ✅ Working | Admin login successful |
| Signup | ⚠️ Partial | Works but rate limiting strict |
| Onboarding UI | ✅ Working | Beautiful 6-step flow |
| Onboarding Persistence | 🔴 Broken | Data not saved to DB |
| User Dashboard | 🔴 Crashed | React error #31 |
| Admin Dashboard | ⚠️ Partial | Works with manual cookie |
| Settings | ⚠️ Partial | UI works, needs verification |

---

## Next Actions

1. [ ] Rebuild dashboard container to apply middleware fix
2. [ ] Debug onboarding database persistence
3. [ ] Fix React error in dashboard
4. [ ] Add missing API routes
5. [ ] Fix rate limiting configuration
6. [ ] Full retest after fixes
