# Jello — Two Sides

Two people. Two moments. One photo.

An iOS-first private photo app built with Expo 57, React Native 0.86, TypeScript, and Supabase.

## Start

1. Copy `.env.example` to `.env` and add the Supabase publishable key.
2. Run `npm install`.
3. Run `npm start` for Expo or `npm run web` for the web preview.

For a development client:

```sh
npx eas-cli build --platform ios --profile development-simulator
npx eas-cli build --platform ios --profile development
```

The physical-device profile requires Apple Developer authentication and a registered iPhone. The simulator profile does not require signing credentials.

## Checks

```sh
npm run validate
npx expo-doctor
```

The SQL in `supabase/migrations` is intentionally unapplied until authenticated access to the dedicated Jello project is available. See `docs/HANDOFF.md` and `docs/BLOCKERS.md` before continuing.
