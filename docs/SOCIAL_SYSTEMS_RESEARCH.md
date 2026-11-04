# Jello social systems engineering notes

Updated: 2026-11-03

## Sources studied

- Meta, [Scaling Instagram Explore recommendations](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/): candidate retrieval, lightweight ranking, heavier ranking, final reranking, caching and precomputation.
- Meta, [Facebook News Feed ranking](https://engineering.fb.com/2021/01/26/ml-applications/news-feed-ranking/): inventory, multiple value signals, integrity filtering, unread/action bumping, and real-time aggregation.
- Meta, [Client-side ranking for unreliable networks](https://engineering.fb.com/2016/10/20/networking-traffic/client-side-ranking-to-more-efficiently-show-people-stories-in-feed/): keep a persistent local pool and merge new server items instead of blocking the UI on every fetch.
- Discord, [Inbox FAQ](https://support.discord.com/hc/en-us/articles/360045027712-Inbox-FAQ): durable unread inbox, read/unread actions, removal, and notification controls.

Revenue is not used as an engineering proxy: private company monthly revenue claims are generally unverifiable. The implementation uses public technical evidence from products operating at much larger scale than Jello.

## Patterns applied now

1. Push delivery and in-app history are separate systems. `notification_outbox` owns delivery retries; `notification_inbox` owns durable user-visible state.
2. Notifications are idempotent, paginated, markable as read, dismissible, and deep-linked. Device badges derive from unread inbox state.
3. Public sharing is explicit two-party consent. The database, not the client, decides when a moment becomes public. Either participant can revoke immediately.
4. Discover uses a staged server query: eligibility and safety filtering, heuristic scoring, then diversity penalties. Signals include friendship, likes, freshness, prior impressions, and repeated-pair suppression.
5. Feed interactions are optimistic in the client and reconciled with the server on failure. Existing content remains interactive during refresh and upload.
6. Impression storage is bounded and batchable. It creates the data contract needed for future ranking experiments without claiming an ML system before sufficient data exists.

## Deliberately deferred

- Learned ranking models, embeddings, and hourly retraining: inappropriate before Jello has enough consented interaction data and an offline evaluation set.
- Advertising or engagement-at-all-costs objectives: Jello should optimize completed two-person moments, meaningful replies, retention, safety, and user-reported quality.
- Anonymous public access: Discover currently requires authentication so blocks, reports, deletion, and consent remain enforceable.
