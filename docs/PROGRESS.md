# Progress

Baseline: 2026-11-02 · `master` · started from `b6f9b15`

## Remotely verified

- Supabase project `ksaqpwjvocgyiycdofym` has migrations `20261101000100` through `20261102000500`.
- Apple and Google providers are enabled; provider secrets are not stored in the mobile repository.
- Private photo storage, participant RLS, friend/moment RPCs, exact-username search, and the 20-friend limit are deployed.
- Profile onboarding now has explicit `username_completed` state and atomic `set_profile_identity`. Existing generated usernames remain incomplete until chosen by the owner.

## Locally verified

- Auth code paths compile.
- Native tabs, camera, recipient selection, uploads, replies, Moments, close-friends, and profile onboarding compile into an iOS bundle.
- `npm run validate`, remote DB lint, and iOS export pass. See `docs/TEST_RESULTS.md`.
- Photos are resized/compressed natively after capture, preparation overlaps the create RPC, upload/attach are retryable and idempotent, and Moments signs all visible paths in one request.

## Device verified

- Physical iOS development build 4 installs and launches.
- Sign in with Apple succeeded.

## Implemented but not device verified

- Google sign-in completion, two-account core loop, username onboarding/edit.

## Not implemented

- Durable cross-restart upload recovery, background transfer, push, Realtime, reactions, composite export, account deletion, moderation, WidgetKit, analytics, automated tests, CI, and TestFlight release.

Do not describe the app as TestFlight-ready or production-ready.
