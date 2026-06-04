# 10 · Authentication & Access

> **Module:** `auth` · **Status:** Draft · **Use cases:** UC1 · **Primary roles:** All

## Purpose

Authenticate staff into the platform and establish the role context that every other module
authorizes against. Pairs with [02-roles-and-permissions](02-roles-and-permissions.md).

## Use cases

- **UC1 — User Login.** User enters credentials → system validates → redirect to dashboard on
  success, error on failure; appropriate error if the server is unavailable.

## Functional requirements

- **FR-auth-1** — Email/password login with server-side credential validation.
- **FR-auth-2** — Logout from any authenticated screen.
- **FR-auth-3** — Password recovery (request reset link → set new password).
- **FR-auth-4** — Optional multi-factor authentication (MFA) per the source ("optional").
- **FR-auth-5** — Successful login establishes a session carrying the user's role(s) and pod.
- **FR-auth-6** — On success, redirect to `/` (dashboard); on invalid credentials show a
  non-enumerating error ("invalid email or password").
- **FR-auth-7** — On server/identity-provider unavailability, show a retry-able error.
- **FR-auth-8** — Sessions expire; protected routes redirect unauthenticated users to `/login`.
- **FR-auth-9** — Login, logout, failed-login, and password-reset events are audit-logged.

## Data model

- **Session** — `userId`, `issuedAt`, `expiresAt`, `mfaSatisfied`.
- **PasswordReset** — `userId`, `token`, `expiresAt`, `usedAt?`.
- Auth provider TBD (see Open questions); user identity lives in **User** (see roles spec).

## Screens

- `/login` — email + password, "forgot password" link, error states.
- `/forgot-password`, `/reset-password` — recovery flow.
- (MFA challenge screen if enabled.)
- All `/(app)/*` routes are protected and redirect to `/login` when unauthenticated.

## Acceptance criteria

- [ ] Valid credentials log in and land on the dashboard.
- [ ] Invalid credentials show an error and do not reveal whether the email exists.
- [ ] Unauthenticated access to a protected route redirects to `/login`.
- [ ] Password reset issues a time-limited, single-use token.
- [ ] Server-unavailable shows a retry-able message, not a crash.

## Out of scope (v1) / future

- SSO / SAML for enterprise firms.
- Per-device session management UI.

## Decisions (v1)

Resolved in [03-architecture-and-scope](03-architecture-and-scope.md):

- **Supabase Auth** (email/password; TOTP MFA available but **optional** for all roles in v1).
- The firm (tenant) is resolved from the user's profile (`profiles.firm_id`); subdomain/org
  routing is a later enhancement.
- Sessions and RLS policies key off `auth.uid()` → `firm_id` for tenant isolation.
