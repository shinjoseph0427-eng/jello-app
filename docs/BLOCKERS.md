# Blockers

- Apple Developer authentication for `jiseongsin68@gmail.com` requires the account password and potentially 2FA. The saved local Apple session is expired, so physical-device signing credentials could not be generated unattended.
- Supabase email authentication is enabled, but the Apple provider is currently disabled. Enabling it requires the Apple provider credentials created through the Apple Developer account.
- Windows cannot run the iOS artifact locally or verify WidgetKit, Sign in with Apple, APNs, or TestFlight on-device behavior.
- GitHub push has not been performed.
- WEEKLY contains unrelated uncommitted changes and must remain read-only.
