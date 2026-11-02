# Jello configuration audit

Audited on 2026-11-02. Secret values are intentionally redacted.

## Identity map

| Surface | Name / identifier | Status |
| --- | --- | --- |
| Local folder | `C:\Users\jiseo\Documents\Jello - two sides` | Active workspace |
| npm package | `jello-two-sides` | Private package |
| GitHub | `shinjoseph0427-eng/jello-app` | `origin`, branch `master` |
| Expo account | `shinjoseph0427` | Authenticated |
| Expo project | `@shinjoseph0427/jello-two-sides` | Linked |
| EAS project ID | `307a90b0-4ac0-4b74-9434-9eb4fba5a459` | Matches `app.json` |
| iOS bundle ID | `app.jello.twosides` | Matches App ID and profile |
| Apple team | `Jiseong Shin`, `V3GLK46D7Z` | Individual team |
| Registered iPhone | `00008120-001179901A12601E` | Included in current Ad Hoc profile |
| Supabase | `Jello-app`, ref `ksaqpwjvocgyiycdofym` | Linked and healthy |

The display names do not need to be identical. Signing depends on the EAS project ID, Apple team, bundle ID, certificate, profile, and device UDID; those identifiers match.

## Secrets and public configuration

| Item | Location | Classification | Status |
| --- | --- | --- | --- |
| Supabase URL | local `.env`; EAS development/preview/production | Public client configuration | Set |
| Supabase publishable key | local `.env`; EAS development/preview/production | Public client key | Set |
| Supabase secret/service-role key | Mobile repository/EAS client environments | Server secret | Not present, as required |
| Apple Distribution private key/certificate | EAS managed credentials | Signing secret | Set and KMS-managed by Expo |
| Ad Hoc provisioning profile | EAS managed credentials | Signing configuration, not a secret | Set and active |
| APNs push key | EAS managed credentials | Secret | Set |
| Apple ID password and 2FA | Local Apple session only | Account secret | Not stored by EAS or GitHub |
| App Store Connect API key | EAS project | CI/submission secret | Not configured; not required for the current interactive build |
| GitHub Actions secrets/variables | GitHub repository | CI secrets | None configured |
| GitHub workflow | `.github/workflows` | CI configuration | Not present |

`.env` is ignored by Git. `.env.example` contains placeholders only. A working-tree and Git-history pattern scan found no service-role key, private key, Expo token, GitHub token, or Apple password committed to the repository.

## Current signing set

- Distribution certificate serial: `0CDAA67A662CE0724E6CE49899621D57`
- Certificate SHA-1: `CA9A5A61F485E046CFCF1BA5B57543EF74FE9EEA`
- Certificate expiration: 2027-11-02
- Provisioning profile: `*[expo] app.jello.twosides AdHoc 1793612539933`
- Profile UUID: `d5e05e63-30bc-42be-bc23-9c273e528aa5`
- Device UDID included: yes
- Bundle application identifier: `V3GLK46D7Z.app.jello.twosides`
- Apple online provisioning verification (`PPQCheck`): enabled
- Latest verified device build: `3d4f1e22-1cbb-477c-8596-84c8e369c07f`, build number 2

## Missing product configuration

- Supabase email authentication is enabled.
- Supabase Apple authentication is disabled. It must be configured before Sign in with Apple can complete, but it does not affect IPA installation or code-signature verification.
- Supabase phone authentication is disabled and is not currently required.
- App Store Connect API credentials and GitHub CI are optional future setup; neither is required for an interactive EAS device build.

## Safe build command

Run `npm run build:ios:device`. It forces EAS to refresh the Ad Hoc provisioning profile so newly registered devices are not omitted from a reused profile.
