# Decisions

- Keep Jello independent from WEEKLY at Git, EAS, Supabase, bundle identifier, and schema levels.
- Use the split seam as the single memorable visual motif; avoid Locket's yellow/black brand treatment.
- Start with private participant-only access and add discoverability only if the product later requires it.
- Generate migrations locally but do not apply them without verified project access.
- Treat generated usernames as incomplete using explicit `username_completed`; never infer onboarding state from a prefix.
- Search by exact username and enforce uniqueness atomically when saving.
