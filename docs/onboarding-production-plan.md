# Onboarding Production Readiness Plan

**Agent 4 - Production Planning Lead**  
**Date:** 2026-02-15  
**Status:** Draft

---

## Executive Summary

This document outlines the comprehensive production readiness checklist for the SquadOps onboarding flow. The current implementation provides a solid foundation with multi-step form, API integration, and basic state management. This plan identifies gaps and prioritizes features needed for a production-grade onboarding experience.

---

## Current Implementation Review

### What's Implemented ✅
- Multi-step wizard (5 steps: Business Info → Template → Agents → Integrations → Provider Keys)
- Basic form validation
- API endpoints for status check, submit, and skip
- Onboarding completion tracking in user_profiles.preferences
- Auth integration with redirect logic
- Basic loading states
- Skip option with minimal data

### Architecture Overview
```
Frontend (Next.js)
├── /onboarding/page.tsx - Main wizard component
├── useAuth.tsx - Auth context with onboarding status
└── AuthGuard.tsx - Route protection

Backend (Express + PostgreSQL)
├── /onboarding/status - GET onboarding status
├── /onboarding - POST complete onboarding
└── /onboarding/skip - POST skip onboarding

Database
└── user_profiles.preferences.onboarding (JSONB)
```

---

## Production Features Checklist

### 1. Core Functionality

| Feature | Status | Priority | Effort | Notes |
|---------|--------|----------|--------|-------|
| Multi-step form with validation | ✅ Partial | P0 | 2d | Field-level validation needed |
| Progress persistence | ❌ Missing | P0 | 3d | Auto-save draft to backend/localStorage |
| Skip option with minimal data | ✅ Implemented | - | - | Working well |
| Completion tracking in database | ✅ Implemented | - | - | JSONB in user_profiles |
| Redirect logic after completion | ✅ Implemented | - | - | AuthGuard + useAuth |
| **Step-by-step persistence** | ❌ Missing | P0 | 2d | Save progress per step |
| **Resume from any step** | ❌ Missing | P1 | 1d | URL-based step routing |

#### P0: Progress Persistence Design
```typescript
// Proposed schema addition
interface OnboardingProgress {
  userId: string;
  currentStep: number;
  data: Partial<OnboardingData>;
  lastSavedAt: string;
  sessionId: string;
}

// API endpoints needed
POST /onboarding/progress - Save progress
GET /onboarding/progress - Load progress
DELETE /onboarding/progress - Clear on completion
```

---

### 2. UI/UX Polish

| Feature | Status | Priority | Effort | Notes |
|---------|--------|----------|--------|-------|
| Responsive design (mobile/tablet/desktop) | ✅ Basic | P1 | 3d | Needs mobile optimization |
| Loading states | ✅ Basic | P1 | 1d | Need per-field loading |
| Error handling with user-friendly messages | ⚠️ Partial | P0 | 2d | Better error boundaries |
| Form validation feedback | ⚠️ Basic | P0 | 2d | Real-time validation |
| Smooth transitions between steps | ❌ Missing | P1 | 1d | Framer Motion or CSS |
| **Accessibility (ARIA, keyboard nav)** | ❌ Missing | P0 | 3d | WCAG 2.1 AA compliance |
| **Focus management** | ❌ Missing | P1 | 1d | Trap focus in modals |
| **Screen reader announcements** | ❌ Missing | P0 | 1d | Live regions for step changes |
| **Progressive enhancement** | ❌ Missing | P2 | 2d | Works without JS |

#### P0: Accessibility Requirements
```typescript
// Step indicator accessibility
<nav aria-label="Onboarding progress">
  <ol role="list">
    <li aria-current={isActive ? "step" : undefined}>
      <span className="sr-only">{isCompleted ? "Completed: " : ""}</span>
      {step.title}
    </li>
  </ol>
</nav>

// Form field accessibility
<label htmlFor="business-name">Business Name *</label>
<input 
  id="business-name"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? "business-name-error" : undefined}
/>
{hasError && <span id="business-name-error" role="alert">{error}</span>}
```

---

### 3. Error Handling

| Feature | Status | Priority | Effort | Notes |
|---------|--------|----------|--------|-------|
| API error handling | ⚠️ Basic | P0 | 2d | Retry logic needed |
| Network failure recovery | ❌ Missing | P0 | 2d | Auto-retry with backoff |
| Validation error display | ⚠️ Basic | P0 | 1d | Field-level errors |
| Session expiration handling | ❌ Missing | P0 | 2d | Refresh token + re-submit |
| **Error boundaries** | ❌ Missing | P1 | 1d | Catch React errors |
| **Offline detection** | ❌ Missing | P1 | 1d | Warn user, queue actions |
| **Rate limiting handling** | ❌ Missing | P1 | 1d | 429 response handling |

#### P0: Network Failure Recovery
```typescript
// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  backoffMs: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

// Usage in onboarding
const submitWithRetry = async (data: OnboardingData) => {
  return retryWithBackoff(() => api.post("/onboarding", data), RETRY_CONFIG);
};
```

---

### 4. Analytics & Monitoring

| Feature | Status | Priority | Effort | Notes |
|---------|--------|----------|--------|-------|
| Track onboarding completion rate | ❌ Missing | P0 | 2d | Funnel analysis |
| Track step drop-off | ❌ Missing | P0 | 2d | Identify friction points |
| Error logging | ⚠️ Console only | P1 | 1d | Sentry integration |
| **Time per step tracking** | ❌ Missing | P1 | 1d | Performance metrics |
| **A/B test framework** | ❌ Missing | P2 | 3d | Experiment support |
| **User feedback collection** | ❌ Missing | P2 | 1d | Post-onboarding survey |

#### P0: Analytics Events
```typescript
// Events to track
interface OnboardingAnalytics {
  "onboarding_started": { timestamp: string; source: string };
  "onboarding_step_viewed": { step: number; stepName: string };
  "onboarding_step_completed": { step: number; stepName: string; durationMs: number };
  "onboarding_step_abandoned": { step: number; stepName: string; durationMs: number };
  "onboarding_completed": { totalDurationMs: number; template: string };
  "onboarding_skipped": { stepReached: number };
  "onboarding_error": { step: number; errorType: string; message: string };
  "onboarding_field_error": { field: string; error: string };
}
```

---

### 5. Edge Cases

| Feature | Status | Priority | Effort | Notes |
|---------|--------|----------|--------|-------|
| User refreshes mid-onboarding | ⚠️ Lost progress | P0 | 2d | Persist on refresh |
| User closes browser and returns | ⚠️ Lost progress | P0 | 2d | localStorage + backend |
| Multiple tabs open | ❌ Race condition | P1 | 2d | Session sync |
| Already completed onboarding | ✅ Handled | - | - | Redirect to dashboard |
| **Browser back button** | ⚠️ Inconsistent | P1 | 1d | History management |
| **Mobile app deep link** | ❌ Missing | P2 | 2d | URL scheme handling |
| **Session timeout mid-flow** | ❌ Missing | P0 | 2d | Re-auth flow |
| **Concurrent submissions** | ❌ Race condition | P1 | 1d | Idempotency key |
| **Data migration** | ❌ Missing | P2 | 2d | Schema version handling |

#### P0: Data Persistence Strategy
```typescript
// Hybrid persistence approach
class OnboardingPersistence {
  // Save to both localStorage and backend
  async save(data: OnboardingProgress): Promise<void> {
    // Immediate local save
    localStorage.setItem("onboarding_draft", JSON.stringify(data));
    
    // Debounced backend save
    this.debouncedBackendSave(data);
  }
  
  // Load with fallback
  async load(): Promise<OnboardingProgress | null> {
    // Try backend first
    try {
      const backend = await api.get("/onboarding/progress");
      return backend.data;
    } catch {
      // Fallback to localStorage
      const local = localStorage.getItem("onboarding_draft");
      return local ? JSON.parse(local) : null;
    }
  }
  
  // Clear on completion
  async clear(): Promise<void> {
    localStorage.removeItem("onboarding_draft");
    await api.delete("/onboarding/progress");
  }
}
```

---

## Implementation Roadmap

### Phase 1: Critical (P0) - 2 Weeks
**Goal:** Make onboarding production-safe and reliable

#### Week 1
- [ ] **Day 1-2:** Progress persistence API + localStorage hybrid
- [ ] **Day 3-4:** Real-time form validation with field-level feedback
- [ ] **Day 5:** Session expiration handling with re-auth flow

#### Week 2
- [ ] **Day 1-2:** Accessibility implementation (ARIA, keyboard nav, screen readers)
- [ ] **Day 3:** Error handling improvements (retry logic, error boundaries)
- [ ] **Day 4:** Analytics foundation (event tracking)
- [ ] **Day 5:** Edge case handling (refresh, multiple tabs, race conditions)

### Phase 2: Polish (P1) - 1 Week
**Goal:** Professional-grade user experience

- [ ] Responsive design refinements for mobile
- [ ] Smooth transitions and animations
- [ ] Offline detection and warning
- [ ] Time per step tracking
- [ ] Browser back button handling

### Phase 3: Optimization (P2) - 1 Week
**Goal:** Data-driven optimization

- [ ] A/B testing framework
- [ ] User feedback collection
- [ ] Performance monitoring
- [ ] Progressive enhancement
- [ ] Data migration support

---

## API Changes Required

### New Endpoints

```typescript
// Save progress (debounced)
POST /api/onboarding/progress
Request: {
  currentStep: number;
  data: Partial<OnboardingData>;
  sessionId: string;
}
Response: { success: true; savedAt: string }

// Load progress
GET /api/onboarding/progress
Response: {
  currentStep: number;
  data: Partial<OnboardingData>;
  lastSavedAt: string;
}

// Clear progress (on completion)
DELETE /api/onboarding/progress
Response: { success: true }

// Validate step data (real-time)
POST /api/onboarding/validate
Request: {
  step: number;
  data: Partial<OnboardingData>;
}
Response: {
  valid: boolean;
  errors?: Record<string, string>;
}
```

### Database Changes

```sql
-- New table for onboarding progress
CREATE TABLE onboarding_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 0,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, session_id)
);

-- Index for quick lookup
CREATE INDEX idx_onboarding_progress_user ON onboarding_progress(user_id);

-- Auto-cleanup old progress (optional)
CREATE INDEX idx_onboarding_progress_updated ON onboarding_progress(updated_at);
```

---

## Testing Strategy

### Unit Tests
- Form validation logic
- Progress persistence
- Step navigation
- Error handling

### Integration Tests
- API endpoints
- Database operations
- Auth flow integration

### E2E Tests (Playwright)
```typescript
// Critical paths
test("completes full onboarding flow");
test("resumes from saved progress");
test("handles session expiration gracefully");
test("validates required fields");
test("skip onboarding and complete later");

// Edge cases
test("recovers from network failure");
test("handles browser refresh");
test("prevents double submission");
```

### Accessibility Tests
- Keyboard navigation (Tab, Enter, Escape)
- Screen reader compatibility (NVDA, VoiceOver)
- Color contrast compliance
- Focus management

---

## Security Considerations

| Concern | Mitigation | Priority |
|---------|------------|----------|
| API key exposure | Server-side encryption, masked input | P0 |
| CSRF attacks | CSRF tokens on state-changing requests | P0 |
| Rate limiting | Implement on /onboarding endpoints | P0 |
| Data validation | Server-side validation for all fields | P0 |
| PII in logs | Sanitize logs, don't log sensitive data | P1 |
| Session fixation | Regenerate session on onboarding complete | P1 |

---

## Performance Budget

| Metric | Target | Current | Gap |
|--------|--------|---------|-----|
| Time to Interactive | < 3s | ~2s | ✅ |
| Step transition | < 300ms | ~500ms | ⚠️ |
| API response | < 200ms | ~150ms | ✅ |
| Bundle size | < 200KB | ~180KB | ✅ |
| Lighthouse score | > 90 | ~85 | ⚠️ |

---

## Rollback Plan

1. **Database:** Keep existing `user_profiles.preferences.onboarding` structure
2. **API:** Maintain backward compatibility with existing endpoints
3. **Feature flags:** Implement for new features
   ```typescript
   const features = {
     progressPersistence: process.env.FF_PROGRESS_PERSISTENCE === "true",
     enhancedValidation: process.env.FF_ENHANCED_VALIDATION === "true",
   };
   ```

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Completion rate | ? | > 80% | Analytics |
| Avg. time to complete | ? | < 5 min | Analytics |
| Step drop-off rate | ? | < 15% per step | Analytics |
| Error rate | ? | < 2% | Sentry |
| Accessibility score | ? | 100% | axe-core |
| Mobile completion rate | ? | Within 5% of desktop | Analytics |

---

## Appendix: Accessibility Checklist

- [ ] All form inputs have associated labels
- [ ] Required fields marked with aria-required
- [ ] Error messages linked with aria-describedby
- [ ] Step progress announced with aria-live
- [ ] Focus visible on all interactive elements
- [ ] Color not sole means of conveying information
- [ ] Minimum contrast ratio 4.5:1 for text
- [ ] Keyboard operable (Tab, Enter, Space, Escape)
- [ ] No keyboard traps
- [ ] Skip links for navigation
- [ ] Page title updates with step change
- [ ] Focus management on step transition

---

## Appendix: Code Quality Standards

```typescript
// All new code must have:
interface QualityRequirements {
  testCoverage: "> 80%";
  typeSafety: "strict TypeScript";
  errorHandling: "explicit, no silent failures";
  documentation: "JSDoc for public APIs";
  linting: "ESPass, no warnings";
  formatting: "Prettier, pre-commit hooks";
}
```

---

**Next Steps:**
1. Review and approve priorities with stakeholders
2. Create detailed tickets for P0 items
3. Set up analytics infrastructure
4. Schedule accessibility audit
5. Begin Phase 1 implementation
