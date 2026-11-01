# Handoff

- Current phase: Phase 1 complete; Phase 2 foundation in progress.
- Repository: independent local Git repository with `origin` set to the provided empty GitHub repository.
- Implemented: SDK 57 foundation, native tab navigation, camera permission/preview/capture, Moments/Friends/Profile foundation screens, Supabase client guard, initial schema/RLS/storage migration.
- Migrations: `20261101000100_initial_jello_foundation.sql` is generated and **not applied**.
- Credentials: Supabase URL is public configuration; publishable key is still required. No service role key belongs in the app.
- Native verification: iOS build, Apple sign-in, APNs, WidgetKit and TestFlight remain unverified and require macOS plus project credentials.
- Validation: `npm run validate` passed; `npx expo-doctor` passed 21/21; `npx expo export --platform web --output-dir dist-web` passed. No physical iOS test was available.
- Dependency audit: npm reported transitive advisories in the Expo 57 toolchain. Safe overrides used by WEEKLY were added for URL parsing/merge/query/Zod packages; forced major downgrades were deliberately not applied.
- Next action: apply the migration in a safe environment, implement RPC-backed auth/friend/moment flows, then test with two real accounts.
