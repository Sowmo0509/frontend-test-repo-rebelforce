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
