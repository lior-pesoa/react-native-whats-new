---
name: react-native-whats-new
description: Use when adding a what's-new / release notes / changelog / "new in this version" sheet or modal, an update announcement shown after an app update, or asking for an App Store / Play Store rating (in-app review) after an update, in a React Native or Expo app. Installs and wires react-native-whats-new at the app root with the right storage, version source and review library.
---

# Add react-native-whats-new to an app

`react-native-whats-new` (npm: `@liorpesoa/react-native-whats-new`) shows a paged bottom sheet with release notes on the
first launch after an update, then optionally the native store-rating prompt.
Pure JS, iOS + Android, works in Expo Go.

The full API is in `llms.txt` (in this repo, in
`node_modules/@liorpesoa/react-native-whats-new/llms.txt` once installed, or at
https://raw.githubusercontent.com/lior-pesoa/react-native-whats-new/main/llms.txt).
Read it before writing code. Use only props listed there.

Follow these steps in the user's app, in order.

## 1. Detect the project

Read `package.json` and the lockfiles, then note:

- **Expo or bare**: `expo` in dependencies = Expo.
- **Package manager**: `yarn.lock` = yarn, `pnpm-lock.yaml` = pnpm,
  `bun.lock` / `bun.lockb` = bun, `package-lock.json` = npm. In a monorepo,
  check the app's folder and the repo root.
- **Entry / root component**: `expo-router` in dependencies = the root is
  `app/_layout.tsx` (or `src/app/_layout.tsx`). Otherwise `App.tsx`
  (or whatever `index.js` / `main` registers).
- **Storage already in use**: `@react-native-async-storage/async-storage` =
  reuse it. `react-native-mmkv` = reuse it through an adapter (never pass the
  MMKV instance directly). Other stores (expo-secure-store, etc.) = write a
  `{ getItem, setItem }` adapter.
- **Version source already in use**: `expo-application`
  (`nativeApplicationVersion`) or `react-native-device-info` (`getVersion()`).
  Never a build number.
- **Review library already in use**: `expo-store-review` or
  `react-native-in-app-review`.
- **Safe areas**: `react-native-safe-area-context` present = pass
  `insets={useSafeAreaInsets()}`.
- **Onboarding / auth / paywall gate**: look for a flag like
  `hasOnboarded`, `isSignedIn`, an auth context, or a redirect in the root
  layout. The sheet must not cover those screens.
- **Analytics**: PostHog, Segment, Amplitude, Firebase Analytics, Mixpanel,
  or an in-house `track()` helper.
- **Constants folder**: `constants/`, `src/constants/` or similar.

## 2. Decide on the rating prompt

- Include `requestReview` if the user asked for ratings / reviews, or the
  app already has a review library.
- Otherwise ship notes-only (no `requestReview`) and tell the user one line:
  the rating ask can be turned on with `requestReview`.
- Never add a "Do you like the app?" pre-question. Google Play policy forbids
  any question before the review prompt.

## 3. Install

Only add what is missing.

- Expo: `npx expo install @liorpesoa/react-native-whats-new` plus any of
  `@react-native-async-storage/async-storage`, `expo-application`,
  `expo-store-review` the app lacks. Always `npx expo install` (it picks
  SDK-compatible versions); use `bunx expo install` in bun projects.
- Bare: `<pm> add @liorpesoa/react-native-whats-new` (`npm install` for npm) plus any of
  `@react-native-async-storage/async-storage`, `react-native-device-info`,
  `react-native-in-app-review` the app lacks, then `cd ios && pod install`
  if a native package was added. The library itself needs no pod install.

Do not add reanimated, gesture-handler or safe-area-context for this library.

## 4. Write the notes file

Create `constants/whatsNew.ts` if the project has a constants folder
(match its location, e.g. `src/constants/`), otherwise `whatsNew.ts` next to
the root component.

Read the CURRENT marketing version from `app.json` (`expo.version`),
`app.config.js/ts` (`version`), or for bare apps `android/app/build.gradle`
(`versionName`) / the iOS target's `MARKETING_VERSION`
(`CFBundleShortVersionString`); fall back to `package.json` `version`.

```ts
import type { WhatsNewRelease } from '@liorpesoa/react-native-whats-new';

export const whatsNewNotes: WhatsNewRelease[] = [
  {
    version: '1.4.0', // the current marketing version
    pages: [
      {
        type: 'list',
        title: "What's new",
        rows: [
          { icon: '⚡️', title: 'Faster sync', description: 'Changes land in under a second.' },
        ],
      },
    ],
  },
];
```

- Write the rows from what the user told you, or from the changelog /
  recent commits. If there is nothing to go on, leave clearly marked
  placeholder rows and say so.
- Follow the app's copy conventions (casing, voice, localization helpers).
- One release per version. `custom` pages only in code, never in remote JSON.

## 5. Mount it once at the root

In `app/_layout.tsx` (Expo Router) or the root component, inside the existing
providers, as a sibling of the navigator. Keep everything that is already
there.

```tsx
<WhatsNew
  notes={whatsNewNotes}
  currentVersion={Application.nativeApplicationVersion} // or getVersion()
  storage={AsyncStorage} // or the adapter
  insets={insets} // useSafeAreaInsets(), if safe-area-context exists
  enabled={hasFinishedOnboarding} // only if the app has such a gate
  requestReview={() => StoreReview.requestReview()} // only per step 2
/>
```

- Bare review call: `() => InAppReview.RequestInAppReview()`.
- MMKV adapter:
  `{ getItem: (k: string) => mmkv.getString(k) ?? null, setItem: (k: string, v: string) => mmkv.set(k, v) }`.
- Never mount it inside a tab, screen or modal route that unmounts.
- If the root layout returns early (splash, redirect), make sure
  `<WhatsNew />` is still mounted once the real app renders, or gate it with
  `enabled` instead of conditional rendering.
- If onboarding can finish on the same launch, optionally call
  `markWhatsNewSeen(storage, version)` when it completes (required if you set
  `showOnFirstInstall`).
- Notes fetched remotely: validate with `validateNotes` and pass
  `notes={null}` until they have loaded (never `[]` — an empty array means
  "no notes" and stores the version as seen).

## 6. Analytics

If the app has an analytics library, forward events through `onEvent`:

```tsx
onEvent={(e) => analytics.track(`whats_new_${e.type}`, e)}
```

Events already carry shapes only (version, pageIndex, pageCount, manual).
Do not add note text, titles or user data. Follow the app's own event naming
and registration conventions (typed event maps, dashboards) if it has them.

## 7. Optional: a "What's new" settings row

If the app has a settings screen, offer (or add, if asked) a row that calls
`ref.current?.show(currentVersion)` through a shared `createRef<WhatsNewHandle>()`
passed as `ref` to the root `<WhatsNew />`. Manual shows never mark a
version seen and never ask for a review. Show the row only when `show`
would succeed (the version has notes), or accept that it returns `false`.

## 8. Verify and explain

1. Run the project's typecheck (`npx tsc --noEmit` or its script) and lint.
2. Tell the user how to see it, because a fresh install is silent by design:
   - run once with an older literal `currentVersion` (e.g. `'1.3.0'`), then
     switch back to the real one; or
   - call `markWhatsNewSeen(AsyncStorage, '0.0.0')` once, then reload; or
   - `resetWhatsNew(storage)` plus a temporary `showOnFirstInstall`.
3. If a rating prompt was added, say where it will and won't appear: iOS dev
   builds and App Store installs (never TestFlight, max 3 per year); Android
   only in Play-installed builds including internal testing (not
   `expo start`, not a sideloaded APK).
4. Say what the user must do on each release: add a `notes` entry whose
   `version` equals the new marketing version.

In `__DEV__` the library logs `[react-native-whats-new]` warnings for a bad
`storage`, a build-number `currentVersion`, and duplicate note versions. If
you see one, apply the fix it names.
