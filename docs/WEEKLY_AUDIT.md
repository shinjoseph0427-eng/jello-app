# WEEKLY audit

Read-only audit performed 2026-11-01. The source at `C:\Users\jiseo\Documents\weekly-app` was not modified and already contained unrelated working-tree changes.

- Stack: Expo 57.0.31, React Native 0.86.3, React 19.2.3, Expo Router 57, TypeScript 6 strict.
- Useful patterns: semantic dark tokens, system typography, native tabs, guarded native UI fallbacks, Supabase session refresh, durable notification outbox, RLS tests, account deletion and report/block flows.
- Risks: WEEKLY is a large production product with product-specific schema and native modules. Copying it wholesale would couple Jello to credentials, identifiers, and unrelated social features.
- Decision: reuse engineering patterns and spacing/type hierarchy; rebuild Jello routes, branding, database, and camera flow independently.
