# Security Policy & Fixes

## Fixed Issues (Branch: fix/all-critical-issues)

### 🔴 Critical Fixes

#### 1. Tenant Isolation & Missing Authentication
- **Problem**: Report endpoints (`/api/customer-report`, `/api/supplier-report`, `/api/worker-report`) had no auth
- **Impact**: Anyone could access another company's data
- **Fix**: Added `requireAuth()` and `companyId` filtering to all sensitive endpoints

#### 2. Cross-Tenant Deletes (IDOR)
- **Problem**: Delete endpoints didn't check company ownership
- **Impact**: Could delete other companies' workers, attendance, production records
- **Fix**: Scoped all deletes through company relations using `withWorkerCompanyScope`

#### 3. Privilege Escalation via Sync
- **Problem**: `POST /api/sync/push` allowed regular users to upsert `users` table
- **Impact**: Employees could grant themselves admin access
- **Fix**: Removed `users` from sync map, added company checks for worker-child rows

#### 4. Cross-Tenant Data Wipe
- **Problem**: `POST /api/restore` deleted all companies' data
- **Impact**: One company's backup restore deleted everyone's records
- **Fix**: Added `companyId` filters to all `deleteMany()` operations

#### 5. Stored XSS in Print/Export
- **Problem**: Customer names, notes, etc. rendered raw in HTML
- **Impact**: Could inject JavaScript via malicious data
- **Fix**: Added `escapeHtml()` and `safeImageSrc()` utilities, applied everywhere

#### 6. Unlimited Brute Force
- **Problem**: No rate limiting on login or password recovery
- **Impact**: Easy credential guessing and user enumeration
- **Fix**: Added in-memory rate limiting:
  - Login: 10 attempts per 5 minutes per IP+username
  - Password recovery: 10 attempts per 5 minutes
  - Password reset: 5 attempts per 15 minutes

#### 7. Dockerfile Data Reset
- **Problem**: `echo 'y' | npx prisma db push --force-reset` dropped all tables on every start
- **Impact**: Data loss on container restart
- **Fix**: Changed to safe `npx prisma db push` (creates schema, no reset)

#### 8. Error Silencing
- **Problem**: Errors caught and converted to empty responses
- **Impact**: Network failures looked like "no data"; no audit trail
- **Fix**: Centralized `apiFetch` with proper error propagation

### 🟠 High Priority

#### Code Duplication
- **Problem**: 47 API route files repeated auth/error/pagination boilerplate
- **Fix**: Created `src/lib/api.ts` with `withAuth()` wrapper

#### Inconsistent Error Handling
- **Problem**: Each route handled errors differently
- **Fix**: Unified via `serverError()`, `jsonError()`, `notFound()`

### 🟡 Known Issues (Not Changed)

These require your decision and are logged for follow-up:

- `src/hooks/use-permissions.ts` contains JSX in a `.ts` file (build works due to `typescript.ignoreBuildErrors`)
- `DATABASE_URL` leaked in git history (run: `git filter-branch --env-filter 'if [ "$GIT_COMMIT_MESSAGE" != "" ]; then git rm --cached *.env* 2>/dev/null; fi'`)
- Session cookie is raw `user.id` (not rotated, not revoked after password change)
- Minimum password length is 4 characters (should be ≥12)
- 4-character minimum password length

## How to Deploy Securely

1. **Rotate secrets:**
   ```bash
   openssl rand -base64 32  # Generate new TOKEN_SECRET
   # Update DATABASE_URL to a new database (old one may be compromised)
   ```

2. **Enable HTTPS only:**
   ```nginx
   # In your reverse proxy/load balancer
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
   ```

3. **Set strong environment variables:**
   ```bash
   export NODE_ENV=production
   export TOKEN_SECRET=$(openssl rand -base64 32)
   export DATABASE_URL="your-secure-postgres-url"
   ```

4. **Verify no old secrets in git:**
   ```bash
   git log -S "DATABASE_URL" --all  # Check history
   ```

## Testing Security Fixes

### Test tenant isolation:
```bash
curl -H "Authorization: Bearer user1-token" \
  http://localhost:3000/api/customer-report/company2-customer-id
# Should return 403 or 404, not the customer data
```

### Test rate limiting:
```bash
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
done
# After 10 attempts, should get 429 (Too Many Requests)
```

### Test XSS prevention:
```bash
# Create a customer with script injection in name
curl -X POST http://localhost:3000/api/customers \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{"name":"<img src=x onerror=alert(1)>"}'  

# Export/print the invoice
# Inspect HTML: <img> should be escaped to &lt;img&gt;, not executable
```

## Reporting Security Issues

⚠️ **Do NOT create public issues for security vulnerabilities.**

Email: security@example.com (update with your email)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Security Review Checklist

- [ ] All API endpoints require authentication
- [ ] All data queries filtered by `companyId`
- [ ] User input escaped before rendering in HTML
- [ ] Rate limiting on auth endpoints
- [ ] No sensitive data in error messages (production)
- [ ] HTTPS enforced in reverse proxy
- [ ] `TOKEN_SECRET` and `DATABASE_URL` rotated
- [ ] No secrets in git history
- [ ] Dependencies updated (`npm audit`)
