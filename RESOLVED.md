# ✅ Resolved Issues

After careful review of the codebase and QA report from the sales, the following issues were resolved:

## 1. Fund Managers can't get in at all.

### Description

Fund Managers were previously unable to log into the system.

### Root Cause

Backend auth policy explicitly set `FUND_MANAGER` to `canLogin: false`, so login attempts were always rejected.

### Resolution

- Updated `auth.service.ts` role permissions to allow `FUND_MANAGER` to log in while keeping other capabilities unchanged.
- Login now succeeds for `manager@funds.com` using the seeded password.
