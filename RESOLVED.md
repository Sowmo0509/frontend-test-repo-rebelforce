# ✅ Resolved Issues

After careful review of the codebase and QA report from the sales, the following issues were resolved:

### 1. Fund Managers can't get in at all.

#### Description

Fund Managers were previously unable to log into the system.

#### Root Cause

Backend auth policy explicitly set `FUND_MANAGER` to `canLogin: false`, so login attempts were always rejected.

#### Resolution

- Updated `auth.service.ts` role permissions to allow `FUND_MANAGER` to log in while keeping other capabilities unchanged.
- Login now succeeds for `manager@funds.com` using the seeded password.

### 2. Registration feels broken.

#### Description

Users saw confusing messages like "Email address is already registered" even when using new emails, and generic "Registration failed" errors.

#### Root Cause

Front-end registration logic reused an "already registered" toast when the selected role was disallowed for self-registration. Other errors bubbled up as vague or raw database/network messages.

#### Resolution

- Improved validation and domain restriction messaging to clearly state why a registration is blocked.
- Clarified form validation copy (name/email/password) for better guidance.
- Fixed `verifyRolePermissions` function to return `true` for `COMPLIANCE_OFFICER` role.

### 3. Dashboard “freezes” randomly.

#### Description

Dashboard occasionally stalled with an endless spinner or partial data failing to appear.

#### Root Cause

- Dashboard queries lacked error handling and retries; failures left the UI in loading.
- API requests had a long timeout, so hung requests stalled the page.
- No user-facing error state or retry path when both queries failed.

#### Resolution

- Added react-query defaults (retry with backoff, sane cache/stale times, no refetch on focus).
- Added error handling and retry UI to dashboard data fetches; allows partial data rendering when only one query fails.
- Reduced Axios timeout to 10s to fail fast instead of hanging.
