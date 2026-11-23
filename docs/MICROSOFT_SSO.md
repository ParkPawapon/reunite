# KMUTT Microsoft sign-in

Reunite uses Microsoft Entra OpenID Connect authorization code flow through `openid-client`. It verifies the ID token signature and standard claims against the single-tenant authority at `https://login.microsoftonline.com/{tenantId}/v2.0`. State, nonce and S256 PKCE are tied to a signed, HttpOnly, SameSite=Lax cookie that expires in 10 minutes. Production requires HTTPS. Reunite creates its normal opaque PostgreSQL-backed session and uses the existing session expiry and logout. Microsoft tokens are discarded after verification.

## Environment and redirect URIs

| Server variable | Value |
| --- | --- |
| `MICROSOFT_CLIENT_ID` | Application (client) ID from the KMUTT app registration. |
| `MICROSOFT_CLIENT_SECRET` | Active client secret **value** from the registration. Store it in the server's secret settings. |
| `MICROSOFT_TENANT_ID` | KMUTT Directory (tenant) ID from the registration. |

Leave all three blank to run without Microsoft sign-in. If any are set, `bun run env:check` requires all three to be valid. Set them in the ignored local environment file used by the web server or in the deployment settings. Use server-only names.

Register these redirect URIs under the **Web** platform. Reunite builds the URI from the configured `APP_BASE_URL` and a fixed callback path.

| Environment | Redirect URI |
| --- | --- |
| Local with default port | `http://localhost:3000/api/v1/auth/microsoft/callback` |
| Production | Your production `APP_BASE_URL` with `/api/v1/auth/microsoft/callback` appended, for example `https://example.vercel.app/api/v1/auth/microsoft/callback`. The production hostname is deployment-specific. |

Open the application on the exact configured origin when testing. Use a separate registered HTTPS redirect URI and environment for any Microsoft-enabled preview.

## Entra configuration

1. Confirm that the app registration supports **Accounts in this organizational directory only** in the KMUTT tenant. Add the Web redirect URIs and configure a client secret. The authorization code flow does not need the implicit ID token or access token grants. [Microsoft authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
2. Configure `acct` and `upn` as **ID token** optional claims. Use the default `upn` settings. Reunite requires `acct=0` and a directory UPN with the exact `kmutt.ac.th` domain. A foreign identity provider in `idp` is also denied. The tenant ID and object ID are the account key. [Optional claims](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference) · [ID token claims](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference)
3. Create an enabled app role with **Allowed member types** set to **Users/Groups** and **Value** set to `Reunite.SignIn`. In the corresponding **Enterprise application**, set **Assignment required?** to **Yes** and assign the named role to users or groups approved by KMUTT. Use direct group membership if assigning a group. If eligibility is restricted to active students, have KMUTT manage assignments from its approved student roster. Tenant membership alone does not establish enrollment. The role grants sign-in only. [App role configuration](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps) · [Application assignment](https://learn.microsoft.com/en-us/entra/identity-platform/howto-restrict-your-app-to-a-set-of-users)
4. Complete tenant consent for the app if required by the tenant's consent policy. Reunite requests only `openid profile` and requires no Microsoft Graph API permissions, group claims or refresh tokens. [OpenID Connect scopes](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc)

Both the member claim and assigned app role are enforced on every Microsoft sign-in, including for previously linked users. Removing an assignment prevents the next Microsoft sign-in. If immediate account access removal is required, revoke the user's existing Reunite sessions through the database operator process. Any separately provisioned password access must be managed under the existing account policy.

## Existing accounts

A first Microsoft sign-in creates an account only if the Entra identity is eligible and its normalized UPN is available in `users.email`. A matching email produces a conflict and leaves the existing account untouched. Microsoft-only users can edit profile details while their sign-in email is read-only. Previously linked users retain their existing profile and password method, if present.

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
2. While signed out, visit `/profile` or another protected page and choose **Continue with Microsoft**. Verify that an assigned KMUTT member returns to the original page. Repeat to confirm the same profile is used. Verify that logout returns the protected API to HTTP 401.
3. Test cancellation, an unassigned member, a guest, an external tenant account and a personal Microsoft account. Try a KMUTT UPN that conflicts with a locally provisioned password account. Verify that the conflict requires verified linking and that password login still works.
4. Run `bun run lint`, `bun run typecheck`, and `bun run test` against the [isolated integration test database](DEVELOPMENT.md). Automated tests simulate Entra responses, so they can run without tenant credentials.
5. Before enabling Microsoft sign-in in production, apply `0011` through the migration connection, reapply [runtime grants](../infra/supabase/runtime-grants.sql), set the three server variables, and register the final HTTPS redirect URI. Configure any hosting, proxy or tracing logs to omit callback query strings. When rotating the client secret, in-flight sign-ins will need to restart.
