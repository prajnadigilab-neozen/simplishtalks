---
description: Run agentic regression tests for SIMPLISH TALKS and SNEHI packages
---

# Regression Testing Workflow — SIMPLISH Talks

This workflow runs the full regression test suite defined in:
`C:\Users\prade\.gemini\antigravity\brain\3807f58c-cee7-490d-b390-e81cb4a1d611\regression_scenarios.md`

## Prerequisites
- Dev server running: `npm run dev` (in `d:\Prajna\Simpl Proj\simplishtalks`)
- App accessible at: `http://localhost:5173`
- Test accounts available (see below)

## Test Accounts

| Role | Phone | Password | Notes |
|------|-------|----------|-------|
| STUDENT (TALKS) | TBD | TBD | `packageType=TALKS`, `packageStatus=ACTIVE` |
| STUDENT (SNEHI) | TBD | TBD | `packageType=SNEHI`, `agentCredits>0` |
| STUDENT (New) | TBD | TBD | Fresh account, `is_placement_done=false` |
| MODERATOR | TBD | TBD | `role=MODERATOR` |
| SUPER_ADMIN | TBD | TBD | `role=SUPER_ADMIN` |
| Restricted | TBD | TBD | `is_restricted=true` |

## Test Suites (Run in Order)

1. **Suite 1 — Authentication** (S1.1–S1.8)
   - Registration (new, duplicate, admin code)
   - Login (valid, invalid, route redirect)
   - Sign out, restricted access, direct URL guard

2. **Suite 2 — TALKS Happy Path** (S2.1–S2.6)
   - Placement test → Dashboard → Lesson → Coach Chat
   - Subscription expiry lock
   - Voice access blocked for TALKS users

3. **Suite 3 — SNEHI Happy Path** (S3.1–S3.5)
   - Placement → SNEHI Dashboard → Voice Coach
   - Credit depletion block
   - Scenario practice

4. **Suite 4 — Package Selection & Upgrade** (S4.1–S4.3)
   - Package screen post-placement
   - Payment simulation
   - NONE package redirect

5. **Suite 5 — RBAC** (S5.1–S5.5)
   - Student blocked from admin routes
   - Moderator partial admin access
   - Super admin full access
   - Role assignment and user ban

6. **Suite 6 — AI Evaluation & Guardrail** (S6.1–S6.4)
   - Placement scoring accuracy
   - Rate limit enforcement
   - Billing circuit breaker

7. **Suite 7 — Admin Flows** (S7.1–S7.5)
   - Course CRUD, AI instructions, analytics, quota, telemetry

8. **Suite 8 — UI/UX & Bilingual** (S8.1–S8.5)
   - Dark/light toggle
   - EN ↔ KN switch
   - Mobile nav, loading skeleton, error boundary

## How to Execute

For browser-based agentic testing, instruct the AI agent:

```
"Run regression tests for SIMPLISH TALKS. 
Use the scenario file at: regression_scenarios.md
Start at http://localhost:5173
Test Suite: [specify suite, e.g., Suite 1 — Authentication]
Account: [specify test account]
Report: pass/fail per scenario ID."
```

## Reporting

After each test run, update the Rerun Checklist table in `regression_scenarios.md`:

| Run Date | Tester | Suites Run | Pass | Fail | Notes |
|----------|--------|-----------|------|------|-------|

Mark scenario status: ✅ Pass | ❌ Fail | ⚠️ Partial | ⏭️ Skipped

## Known Regressions (Fixed)

| Bug ID | Description |
|--------|-------------|
| REG-001 | Login redirect loop |
| REG-002 | Lesson generation 500 error |
| REG-003 | Milestone test blank questions |
| REG-004 | packageType overwritten on token refresh |
| REG-005 | SANGAATHI→SNEHI mapping missing |
