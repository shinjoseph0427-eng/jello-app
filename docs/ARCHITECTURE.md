# Architecture

Jello uses Expo Router screens over a feature-oriented `src` tree. TanStack Query owns remote server state; Zustand is reserved for short-lived capture/upload state. Supabase Auth supplies identity, Postgres/RPC enforces transitions, and private Storage holds image binaries.

The moment state machine is `pending_upload → waiting_for_friend → reply_uploading → completed`, with terminal `expired`, `cancelled`, and `failed` states. State-changing operations will be RPCs using row locks and idempotency keys; the client must never directly assert another user's identity.

Media flow: local capture → resize/metadata stripping → owner-scoped private upload → transactional photo registration → outbox notification → reply → completion → asynchronous composite/widget derivative. WidgetKit reads only a cached derivative from an App Group and deep-links to the moment.
