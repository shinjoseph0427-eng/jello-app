# Handoff

1. Purpose/state: harden first-pair activation. Branch `master`; username checkpoint follows `b6f9b15`.
2. Changes: migration `20261102000400`, profile-aware AuthProvider, onboarding route, tab gate, profile edit, API contract, progress docs.
3. Verified: typecheck/lint, remote migration, remote DB lint, iOS JS export. Not verified: device onboarding, Google device auth, two-account loop.
4. Remote migrations: `20261101000100`–`20261102000500` on `ksaqpwjvocgyiycdofym`.
5. Native rebuild: not required by this change; required for a standalone artifact containing current JS.
6. Next code: persistent offline upload queue around `src/features/jello/api.ts`, or run device latency/E2E measurement first.
7. Known risk: retries are in-memory; process termination loses the task. Scheduled orphan auditing is not implemented.
8. Next commands: `npm run validate`; `supabase migration list --remote`; start Metro; run two-account smoke test; update `docs/TEST_RESULTS.md`.
9. External action: use two authorized test accounts; do not automatically send invites or push.
10. Read first: PROGRESS, NEXT_TASKS, TEST_RESULTS, latest migration, and `src/features/jello/api.ts`.
11. Missing: SMTP, monitoring/analytics, privacy/support URLs, push backend, App Group.
12. Do not claim complete: Google device auth, core device E2E, reliable uploads, push/realtime, deletion/moderation, WidgetKit, TestFlight.
