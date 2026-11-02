# Test results

Date: 2026-11-02 · Windows · Supabase production project

| Scope | Command | Result | Level |
|---|---|---|---|
| TypeScript + ESLint | `npm run validate` | PASS | local |
| Migration | `supabase db push --remote --yes` | PASS; `20261102000400` applied | remote |
| DB lint | `supabase db lint --remote --level warning` | PASS; no schema errors | remote |
| iOS bundle | `npx expo export --platform ios --output-dir .expo-export-check --clear` | PASS | local |
| Username onboarding | device flow | SKIPPED; build predates change | device |
| Two-account core loop | device flow | SKIPPED; second session required | device |
| Google sign-in | device flow | SKIPPED; not yet recorded | device |

No automated RPC/RLS regression suite exists yet.
