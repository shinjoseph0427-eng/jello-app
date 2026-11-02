# Jello product and engineering roadmap

Updated: 2026-11-02

## Product rule

The default unit is one photo, one friend, one independent Two Sides moment.

- The initiator chooses exactly one friend and takes side one.
- The responder supplies side two.
- A moment is complete only after both participants contribute.
- A future “send to more friends” action may reuse the local photo, but it must create a separate moment, upload record, notification, reply, and privacy boundary for every friend.
- Do not create one moment with many recipients. That weakens reciprocity, complicates blocking/deletion, and turns a private two-person product into a broadcast product.

This model creates the strongest invitation loop: invite one person, they accept, they must reply to reveal the completed card, and either participant can start the next moment.

## P0 — TestFlight safety and trust

### Blocking

Blocking must be a single server transaction:

1. Insert `(blocker_id, blocked_id)`.
2. Remove the friendship.
3. Cancel pending friend requests in both directions.
4. Reject future discovery, invites, moments, reactions, and notifications between the pair.
5. Hide shared moments from both feeds immediately. Preserve only the minimum internal record required for abuse review.
6. Remove queued push notifications between the pair.

Required UI:

- Block from a friend’s action sheet and from a moment menu.
- A Profile → Privacy and safety → Blocked people list.
- Unblock does not restore the friendship. A new explicit request is required.

### Reporting

Before any public feed, add reporting anyway because photos are user-generated content.

- Reasons: nudity, harassment, violence, impersonation, spam, other.
- Store the reporter, reported user, moment, reason, timestamps, and an immutable moderation reference.
- Blocking is offered immediately after a report.
- Publish a support contact and response policy.

### Account deletion

Profile → Delete account must be available inside the app.

1. Explain what is deleted.
2. Require a deliberate confirmation and recent authentication.
3. Delete Storage objects, photos, moments, reactions, friendships, requests, blocks, device tokens, invites, and the Auth user.
4. Sign out locally and clear caches/outbox.
5. Never make email support the only deletion path.

Apple requires in-app account deletion and removal of associated user-generated content.

### Privacy

- Contacts remain on-device and are used only for local search/invitation.
- Photos stay in a private Storage bucket and are served with short-lived signed URLs.
- Logs never contain access tokens, invite tokens, contact data, or signed photo URLs.
- Add Privacy Policy, Terms, Community Guidelines, retention periods, and a support email before App Review.
- Request permissions contextually and keep username/link invitation available when Contacts access is declined.

## P0 — Invitation and one-tap acceptance

Use a Universal Link, not a username embedded in an SMS.

Example: `https://jello.app/i/<opaque-token>`

### Invite creation

- Generate at least 128 bits of cryptographically random entropy.
- Store only a hash of the token.
- Record sender, expiry, accepted user, accepted time, and revoked time.
- Default expiry: 7 days. Default use: one successful acceptance.
- The sender can revoke an unused link.

### Link opening

1. Universal Link opens Jello if installed, otherwise an install/landing page.
2. Preserve the token through Apple/Google sign-in and onboarding.
3. Show only the inviter’s display name/avatar and an `Accept friend` button.
4. Do not expose the recipient’s contacts or require phone-number login.

### Acceptance transaction

The server locks the invite and verifies:

- token exists, is unused, unexpired, and not revoked;
- accepter is authenticated and is not the sender;
- neither user has blocked the other;
- they are not already friends;
- both users remain below the friend limit.

On success, create the friendship directly and consume the invite. No second reciprocal request is necessary because clicking `Accept friend` is explicit consent. The transaction is idempotent so repeated taps return the same successful friendship.

After acceptance, send the inviter a push and open the Camera with the new friend preselected.

## P0 — Push notifications

### Client

- Ask after the user has a reason to care, not on first launch.
- Register the Expo push token with user ID, device ID, platform, app version, locale, and last-seen time.
- Refresh tokens on sign-in and remove them on sign-out/account deletion.
- Handle notification taps with typed deep links.

### Events

- Friend request or invite accepted → Friends or Camera.
- First side received → the exact reply screen.
- Moment completed → the exact moment.
- Reaction received → the exact moment.

### Server

- Database transaction writes a notification-outbox row; it never calls the push service inline.
- An Edge Function claims, batches, sends, retries, and records Expo receipts.
- Use an idempotency key per event/user/device.
- Remove tokens reported as unregistered.
- Respect notification preferences, quiet hours, blocks, and account deletion.

## P1 — Home Screen widget

- Add a WidgetKit extension and App Group shared by the app and widget.
- The app downloads and writes a resized, encrypted-at-rest/cached completed image into the shared container.
- Store only the latest selected completed Moment and minimal metadata.
- Call WidgetKit timeline reload after a completed Moment is synchronized.
- Widget tap deep-links to that Moment.
- Provide empty, signed-out, expired, blocked, and privacy-redacted states.
- Never place Supabase service credentials or long-lived signed URLs in the widget.

## P1 — Reliability and operations

- Delivery state: queued, creating, uploading, attached, delivered, failed-retryable, failed-final.
- Keep the current non-blocking local outbox and add durable photo-file staging.
- Add Sentry without photo URLs or personal data.
- Add push-delivery, upload-latency, completion-rate, invitation-acceptance, block, and report metrics.
- Test offline launch, killed app, expired session, duplicate tap, block during upload, deletion during upload, and expired invite.

## P2 — Public Moments and recommendations

Do not change private moments into public rows. Add a separate publication layer:

- `moments.visibility` remains private by default.
- A `publications` record is created only with explicit participant consent.
- Store moderation status, audience, caption, topics, and publication/deletion timestamps separately.
- Either participant can withdraw consent, immediately removing the publication.
- Public media uses a separate delivery policy and moderation pipeline.

Recommendation should start simple:

1. Eligible, reviewed public publications only.
2. Exclude blocked/reported users and already-seen content.
3. Candidate sources: friend graph, mutual friends, recency, language/region, and opted-in topics.
4. Ranking signals: meaningful completion, saves/shares, hides/reports, freshness, and creator diversity.
5. Strong negative weight for hides/reports; cap repeated creators.
6. No contact-book data in ranking.
7. Add explanations such as “Because two friends you follow interacted,” plus hide/not-interested controls.

Do not build machine-learning ranking until there is enough moderated interaction data. Begin with deterministic scoring and measure retention, safety, and diversity.

## Delivery order

1. Block/unblock, report, account deletion, privacy/legal pages.
2. Invite token, Universal Link, auth-resume, one-tap acceptance.
3. Push token registration, notification outbox, Edge Function, deep-link routing.
4. WidgetKit extension and App Group cache.
5. Reliability testing, observability, TestFlight review checklist.
6. Reusable-photo fan-out as independent 1:1 moments.
7. Public publication and moderation system.
8. Deterministic recommendations, then experiments, then ML only when justified.

## Release gates

- No TestFlight external release without working block, report, deletion, Privacy Policy, Terms, and support contact.
- No public feed without moderation operations and participant consent withdrawal.
- No recommendation experiments without safety exclusions and user controls.
- “500K ready” is not a claim until database, Storage, notification, moderation, and feed load tests pass.
