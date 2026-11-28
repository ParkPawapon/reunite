# KMUTT Microsoft sign-in

Reunite uses Microsoft Entra OpenID Connect authorization code flow through `openid-client`. Microsoft handles credential collection, password verification and MFA on its sign-in pages. Reunite verifies the ID token signature, issuer, audience and expiration against the single-tenant authority at `https://login.microsoftonline.com/{tenantId}/v2.0`. State, nonce and S256 PKCE are tied to a signed, HttpOnly, SameSite=Lax cookie that expires in 10 minutes. Production requires HTTPS. Reunite creates its normal opaque PostgreSQL-backed session and discards the Microsoft tokens after verification.

Each Microsoft sign-in requests the account picker with `prompt=select_account`. Users can select a remembered account or enter a different KMUTT email. Microsoft applies the tenant's password and MFA requirements after account selection. Signing out revokes the Reunite session. Microsoft sessions in the same browser remain available in the picker.

## Environment and redirect URIs

| Server variable           | Value                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `MICROSOFT_CLIENT_ID`     | Application (client) ID from the KMUTT app registration.                                        |
| `MICROSOFT_CLIENT_SECRET` | Active client secret **value** from the registration. Store it in the server's secret settings. |
| `MICROSOFT_TENANT_ID`     | KMUTT Directory (tenant) ID from the registration.                                              |

Leave the Microsoft variables blank to run without Microsoft sign-in. If sign-in is configured, `bun run env:check` requires a valid client ID, client secret, and tenant ID. Set them in the ignored local environment file used by the web server or in the deployment settings. Use server-only names.

Register these redirect URIs under the **Web** platform. Reunite builds the URI from the configured `APP_BASE_URL` and a fixed callback path.

| Environment             | Redirect URI                                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local with default port | `http://localhost:3000/api/v1/auth/microsoft/callback`                                                                                                                                                   |
| Production              | Your production `APP_BASE_URL` with `/api/v1/auth/microsoft/callback` appended, for example `https://example.vercel.app/api/v1/auth/microsoft/callback`. The production hostname is deployment-specific. |

Open the application on the exact configured origin when testing. Use a separate registered HTTPS redirect URI and environment for any Microsoft-enabled preview.

## Entra configuration

1. Confirm that the app registration supports **Accounts in this organizational directory only** in the KMUTT tenant. Add the Web redirect URIs and configure a client secret. The authorization code flow does not need the implicit ID token or access token grants. [Microsoft authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
2. Configure `acct` and `upn` as **ID token** optional claims on the registration that matches `MICROSOFT_CLIENT_ID`. Use the default `upn` settings. If the picker omits either claim, add it to the existing `optionalClaims.idToken` array in the app manifest. Reunite requires `acct=0` and a directory UPN with the exact `kmutt.ac.th` domain. A foreign identity provider in `idp` is also denied. The tenant ID and object ID are the account key. [Configure optional claims](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims) · [Optional claims reference](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference)
3. If KMUTT limits access to a specific population, use **Assignment required?** in the corresponding **Enterprise application** and assign the approved users or groups. Entra enforces that policy before issuing the token. Reunite requires neither a custom app role nor a `roles` claim. Use a KMUTT-managed roster if the policy requires active enrollment. [Application assignment](https://learn.microsoft.com/en-us/entra/identity-platform/howto-restrict-your-app-to-a-set-of-users)
4. In **API permissions → Add a permission → Microsoft Graph → Delegated permissions → OpenId permissions**, configure `openid` and `profile`. Entra lists these OIDC sign-in scopes under Microsoft Graph. Reunite already requests both, and Entra requires `profile` for the stable `oid` claim. The sign-in flow does not call Graph or require `User.Read`, `email`, or `offline_access`. Complete tenant consent if required by KMUTT's policy. [OpenID Connect scopes](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc) · [ID token claims](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference)

Reunite checks tenant, identity, membership, and directory username on every Microsoft sign-in, including for previously linked users. If immediate account access removal is required, revoke the user's existing Reunite sessions through the database operator process. Manage separately provisioned Reunite passwords under the existing account policy.

When sign-in returns to `/login?microsoft=denied`, check the server's `microsoft_access_denied` event with `LOG_LEVEL=info`. For `invalid_claims`, the log lists the missing or malformed claim names. An `acct` or `upn` entry points to the ID token configuration. `invalid_kmutt_upn` means the directory username does not meet Reunite's domain rule. The log contains no token or claim values.

## Profile completion

A first-time Microsoft user starts at `/complete-profile`. They must provide their student ID, faculty, and major, plus the department when KMUTT lists one for the program. Completion unlocks the dashboard and protected APIs using the existing session.

To populate account names from Entra, add `given_name` and `family_name` as optional **ID token** claims. Reunite capitalizes the submitted names and allows users to supply or edit them in the regular profile editor. [Microsoft optional claims](https://learn.microsoft.com/entra/identity-platform/optional-claims)

Existing Microsoft-linked users who already completed setup skip it. Incomplete Microsoft-linked users are directed to setup from protected pages, and protected APIs return `403 PROFILE_COMPLETION_REQUIRED`. The signed-in user can complete the form or log out. An incomplete session is also denied access to the catalog APIs, which still serve anonymous requests. Migration `0013` records confirmation using a dedicated timestamp and preserves completion for accounts that met the previous setup rules.

## Existing accounts

A first Microsoft sign-in creates an account only if the Entra identity is eligible and its normalized UPN is available in `users.email`. A matching email produces a conflict and leaves the existing account untouched. Microsoft-only users can edit their student details, phone, and avatar while their sign-in email and Entra-provided names stay disabled. Previously linked users retain their existing profile and password method, if present.

To link a conflicted legacy account, an authorized operator must verify control of the existing Reunite account and independently confirm the same user's approved identity in the KMUTT tenant directory. Record the verified Reunite user ID and the Entra Directory (tenant) ID and directory **user** Object ID. Email equality and values supplied by the requester are insufficient. With those verified parameters, the operator can use the following parameterized statement on the existing user record.

```sql
UPDATE users
SET microsoft_tenant_id = $2::uuid, microsoft_object_id = $3::uuid
WHERE user_id = $1 AND microsoft_tenant_id IS NULL AND microsoft_object_id IS NULL
RETURNING user_id;
```

Confirm exactly one returned row before committing. A uniqueness error or zero returned rows needs operator review. The next Microsoft sign-in must still pass the Entra authorization checks.

## Local verification and deployment

1. Apply `bun run db:migrate` to the local database. Set the Microsoft variables and `APP_BASE_URL=http://localhost:3000`, run `bun run env:check`, and start `bun run dev`.
2. While signed out, visit `/profile` or another protected page and choose **Sign in with KMUTT account**. Verify that a new eligible KMUTT member reaches `/complete-profile`, that protected APIs return 403 until completion, and that submitting valid profile data opens the dashboard. Verify that logout returns the protected API to HTTP 401. Keep the Microsoft session active in the browser and repeat sign-in. Check that the account picker opens with a single remembered account, that it offers a different account, and that an eligible sign-in restores the original protected destination.
3. Test cancellation, a guest, an external tenant account and a personal Microsoft account. If assignment is required by the tenant, also test an unassigned account. Try a KMUTT UPN that conflicts with a locally provisioned password account. Verify that the conflict requires verified linking and that the password API still works for existing accounts.
4. Run `bun run lint`, `bun run typecheck`, and `bun run test` against the [isolated integration test database](DEVELOPMENT.md). Automated tests simulate Entra responses, so they can run without tenant credentials.
5. Before enabling Microsoft sign-in in production, use the migration connection to apply migrations through `0013`, reapply [runtime grants](../infra/supabase/runtime-grants.sql), set the required server variables, and register the final HTTPS redirect URI. Configure any hosting, proxy or tracing logs to omit callback query strings. When rotating the client secret, in-flight sign-ins will need to restart.
