# Jello release readiness

Updated: 2026-11-02

## Completed in repository and production services

- Expo WidgetKit target configured as `app.jello.twosides.widgets` with App Group `group.app.jello.twosides`.
- Small and medium widgets render the latest completed Two Sides moment from local App Group image copies.
- Associated Domains entitlement configured for `applinks:jello-two-sides.expo.app`.
- AASA deployed and verified with HTTP 200 and `application/json`.
- Invite fallback deployed at `https://jello-two-sides.expo.app/invite?token=...` and verified with HTTP 200.
- Privacy policy and terms deployed in English at `/privacy` and `/terms`.
- Push tickets and Expo delivery receipts are stored and checked; `DeviceNotRegistered` tokens are disabled.
- Push tokens refresh without prompting whenever a signed-in user has already granted notification permission.
- Public Moments require consent from both participants. Either participant can revoke consent.
- Discover ranking uses direct friendship, like count, and recency; blocks are excluded and public moments can be reported.
- App Store metadata is prepared in `store.config.json` for English and Korean.
- Supabase production migrations and Edge Function are deployed; database lint reports zero errors.
- TypeScript, Expo lint, Expo Doctor, iOS bundle export, and web export pass.

## Apple account actions still required

These cannot be completed without the account holder entering Apple credentials or providing an App Store Connect API key.

1. Run `npx eas-cli@latest build --platform ios --profile production`.
2. Sign in as `jiseongsin68@gmail.com` and complete 2FA.
3. Allow EAS to create the Widget extension identifier and provisioning profile.
4. Run `npx eas-cli@latest submit --platform ios --profile production --latest`.
5. If asked, create or select the App Store Connect record for bundle ID `app.jello.twosides`.
6. Save the resulting numeric App Store Connect app ID as `ascAppId` in `eas.json`.
7. Create or attach an App Store Connect API key in EAS Credentials. Then run `npx eas-cli@latest metadata:push --profile production`.

## App Store Connect information requiring owner input

- App review contact phone number and email.
- A permanent reviewer test account with sample friends and moments.
- Final support email inbox. The current policy uses `support@jello.app`; confirm that this mailbox exists before review.
- App privacy questionnaire confirmation. Expected disclosures:
  - Contact info: email address, linked to identity, app functionality.
  - User content: photos and other user content, linked to identity, app functionality and safety.
  - Identifiers: user ID and device push token, linked to identity, app functionality.
  - Usage/diagnostics: only if production analytics or Sentry is added later; neither should be declared until actually enabled.
  - Contacts: not collected by Jello servers under the current implementation.
  - Tracking: no.
- Screenshots for 6.9-inch and 6.5-inch iPhone displays.
- Beta review notes and a working reviewer account if external TestFlight testing is enabled.
- Legal review of the privacy policy and terms before public App Store release.

## Post-TestFlight verification

1. Install from TestFlight, not an ad hoc URL.
2. Verify Apple and Google authentication.
3. Verify a Universal Link from Messages opens the invite directly.
4. Verify the same link in Safari reaches the web fallback when Jello is removed.
5. Add small and medium Jello widgets; complete a moment and confirm both refresh.
6. Test push receive, reply, receipt processing, token rotation, and notification deep links.
7. Test two-person public consent, revocation, blocking, reporting, and Discover exclusion.
8. Test account deletion on a disposable account.
