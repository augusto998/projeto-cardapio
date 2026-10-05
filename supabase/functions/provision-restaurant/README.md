# provision-restaurant

This authenticated Edge Function provisions a restaurant and its owner. It
creates Auth users only on the server, stores no password, and uses an
unpredictable temporary password that is never returned or logged. A magic
sign-in link is sent after the restaurant and owner association commit.

## Required configuration

The function uses the official `@supabase/server` package. The
`withSupabase({ auth: "user" })` wrapper verifies the caller's JWT and provides
the authenticated identity and scoped clients; the package manages
Supabase-provided URL and key configuration. Never put privileged keys in
frontend variables or commit real values. Set the following application
secrets in the Edge Function environment:

| Name | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Server-side credential for sending owner access email |
| `PROVISIONING_EMAIL_FROM` | Verified sender address used by the email provider |
| `PROVISIONING_ALLOWED_ORIGINS` | Comma-separated exact browser origins allowed by CORS |
| `PROVISIONING_REDIRECT_URL` | HTTPS application URL allowed by Supabase Auth redirects |

An empty-value template is in `.env.example`. Supabase supplies the required
project URL and API key configuration to hosted Edge Functions.

## Authorization and recovery

The `withSupabase({ auth: "user" })` wrapper validates the caller's bearer JWT;
the function obtains the caller ID from `ctx.userClaims.id` and checks
`private.platform_admins` through a server-only RPC using `ctx.supabaseAdmin`.
The SQL finalization RPC rechecks that authorization and atomically creates a
private restaurant and its `owner` association. The new Auth user is rejected
if it already has any `restaurant_admins` association. `ctx.supabase` remains
available for user-scoped operations subject to RLS; this provisioning flow
uses the admin client only for operations that require server privileges.

The Auth API and Postgres do not share a transaction. Each request therefore
creates a private provisioning attempt before creating its Auth user. If the
SQL operation fails, the function deletes the just-created Auth user. The
attempt records `compensated` if deletion succeeds or
`compensation_required` if it does not. If Auth creation has an ambiguous
network result, the attempt is marked `auth_creation_unknown`. Operators can
use the private attempt row and its email to reconcile the Auth user through
trusted server-side tooling. Do not inspect or reconcile these rows through
the browser. The email is retained only while needed for pending reconciliation
or notification; successful notification and compensation clear it. If the
finalization RPC response is ambiguous, the function checks
the atomic attempt state before deleting anything; if it cannot determine
whether the commit succeeded, it returns `202` and leaves the attempt for
reconciliation rather than risk deleting an owner from a committed restaurant.

If the database commit succeeds but access email delivery fails, the endpoint
returns `202` and records `notification_pending`; an operator must resend a
fresh magic link through trusted server-side tooling. The action link,
password, authorization token, and provider credentials are never logged or
included in the response.

## Request

The only accepted JSON properties are `name`, `slug`, `email`, `telefone`,
`whatsapp`, and `logo_url`. The last three are optional. The function derives
all user and restaurant identifiers, sets the owner role server-side, and
always creates the restaurant with `is_public = false`.

Call with the authenticated Supabase session using
`supabase.functions.invoke("provision-restaurant", { body })`. The caller must
already be a platform administrator; a restaurant `owner` or `admin` is not
sufficient.
