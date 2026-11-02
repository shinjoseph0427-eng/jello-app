# Research

Verified: 2026-11-02

## Mobile photo transfer decisions

- Expo ImageManipulator schedules native resize work and renders asynchronously. Jello resizes the longest edge to 1536 px and encodes JPEG at 0.72 before transfer. Source: https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/
- Supabase recommends ArrayBuffer rather than Blob/File/FormData in React Native. Jello uploads binary directly to private Storage; the photo does not proxy through an application server. Source: https://supabase.com/docs/reference/javascript/storage-from-upload
- Supabase recommends resumable/TUS primarily above 6 MB or for unstable large transfers. Jello's compressed still photos should stay well below that boundary, so standard single-request upload avoids TUS setup/chunk overhead. Source: https://supabase.com/features/resumable-uploads
- Meta describes serving images at the dimensions actually needed by the device to reduce transferred bytes and client scaling work. Jello applies the same general byte-minimization principle before upload; this is not a claim that Jello uses Meta's private architecture. Source: https://engineering.fb.com/2012/01/19/core-infra/under-the-hood-mobile-timeline/
- Supabase Storage supplies CDN delivery and image transformation capabilities. Jello currently uses signed private URLs and explicit client-sized uploads; paid Smart CDN behavior has not been verified for this project. Source: https://supabase.com/features/file-storage

## Applied

- Native pre-resize/compression starts immediately after capture.
- Image preparation and moment creation overlap.
- Auth user lookup uses the persisted session instead of a network `getUser` round trip.
- Storage upload and DB attach retry with exponential delays.
- Object upload uses idempotent upsert; attach RPC returns success for the same already-attached side.
- Failed final attach attempts delete the user's object.
- Moment signed URLs are requested in one batch instead of once per card.
- Development telemetry records only side, byte count, and elapsed milliseconds; no IDs, paths, URLs, or photos.

## Limits

- Retry is in-memory. Force-quitting or losing power still loses the task.
- No background transfer, durable queue, network awareness, or progress callback exists yet.
- Device measurements are required before changing the 1536/0.72 quality point.
