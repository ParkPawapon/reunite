# System conventions

TypeScript is strict for production and tests, with unchecked indexed access, explicit overrides and unused declarations checked. ESLint enforces Next/TypeScript rules, no explicit `any`, no unproven non-null assertions, unused variables, safe console use and dependency restrictions. Do not suppress checks to accept failures.

Use PascalCase types/classes, camelCase functions/DTO fields, uppercase documented status values, snake_case SQL names and kebab-case routes/files. Boundary Zod schemas reject unknown input fields. Domain models, PostgreSQL rows and response DTOs have distinct shapes; report output intentionally omits its owner's user ID. API dates are ISO 8601 UTC; eventual displays should use Asia/Bangkok explicitly.

SQL values always use `$1` placeholders, including scripts. SQL identifiers are static application-owned constants. The tests' randomly generated schema name is validated by construction. No ORM, query DSL, `SELECT *` repository mapping or generic CRUD framework is used. Keep migrations immutable after application; add a new numbered migration for changes.

Use a task branch such as `FE001/web-application-shell` or `BE001/server-api`. The task prefix identifies the workstream and the number identifies the task. Write typed Conventional Commit subjects such as `feat(api): add report ownership checks`. The repository policy checks task branch names, commit subjects, ownership and tracked file boundaries. It accepts Dependabot's generated branch names and subjects for dependency updates.

Open a pull request to main and keep it current with the base branch. GitHub requires one approving review from the code owner, approval after the latest reviewable push, resolved conversations and passing checks. A new reviewable push dismisses stale approvals. ParkPawapon is the repository-wide code owner and the sole review bypass actor. The bypass applies through a pull request. Signature, force push, deletion and CI rules are enforced separately. Merge commits preserve the signed task history.

Generated output, local environment files and reference documents stay local. LF line endings keep migration checksums consistent on Windows and Linux.

## Typography

CSS properties in `apps/web/src/theme/tokens.css` are the source of truth. MUI variants and Tailwind `text-*` utilities reference the same properties. Root language is Thai; English branding has `lang="en"`. Outfit supplies Latin glyphs, Noto Sans Thai supplies Thai, followed by Arial/sans-serif. Both use `next/font/google`, swap display and weights 400/500/600/700; font files are fetched at build and served locally to browsers.

| Token / MUI mapping               | Size (rem) | Line height | Weight |
| --------------------------------- | ---------- | ----------- | ------ |
| display / Tailwind `text-display` | 3          | 1.2         | 600    |
| h1                                | 2.25       | 1.25        | 600    |
| h2                                | 1.875      | 1.3         | 600    |
| h3                                | 1.5        | 1.35        | 600    |
| h4                                | 1.25       | 1.4         | 600    |
| h5, h6                            | 1.125      | 1.45        | 600    |
| body-lg / subtitle1               | 1.125      | 1.65        | 400    |
| body / body1                      | 1          | 1.65        | 400    |
| body-sm / body2, subtitle2        | 0.875      | 1.6         | 400    |
| caption, overline                 | 0.75       | 1.5         | 400    |
| button                            | 0.875      | 1.4         | 600    |

Letter spacing stays normal for Thai; button text is not uppercased. The CSS layer order is `theme, base, mui, components, utilities` with `AppRouterCacheProvider`'s `enableCssLayer: true`. ThemeProvider stays at a client boundary. The later user-supplied palette is centralized in `colors.json` and used by generated CSS, MUI and semantic Tailwind aliases. The user subsequently requested the Agent Honk loading illustration and login layout; see `docs/design/`. Local Superdesign working context stays ignored by Git and Docker.
