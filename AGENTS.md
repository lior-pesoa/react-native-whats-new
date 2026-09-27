# Agent guide: react-native-whats-new

A pure-JS React Native library: a paged "what's new" bottom sheet shown on
the first launch after an app update, optionally followed by the native
store-rating prompt. iOS and Android, no native code.

If you are integrating the library into an app (not contributing to it),
read `llms.txt` and `skills/react-native-whats-new/SKILL.md` instead.

## Layout

- `src/index.tsx`: the public exports. Anything not exported here is private.
- `src/types.ts`: public types (`WhatsNewRelease`, `WhatsNewPage`,
  `WhatsNewStorage`, `WhatsNewEvent`, `WhatsNewTheme`, `WhatsNewLabels`).
- `src/core.ts`: pure show rules. `parseVersion`, `compareVersions`,
  `findRelease`, `decideWhatsNew`, `SEEN_KEY`. No React, no storage, no I/O.
- `src/storage.ts`: reading/writing the seen version; `markWhatsNewSeen`,
  `resetWhatsNew`.
- `src/useWhatsNew.ts`: the headless hook. Runs `decideWhatsNew` against
  storage, the `when` gate and `enabled`; owns manual `show`, `close`,
  `reportPage` and event emission.
- `src/devWarnings.ts`: `__DEV__`-only setup warnings used by the hook.
- `src/WhatsNew.tsx`: the component. Hook + sheet + the review ask
  (`requestReview`, `reviewOn`, `reviewDelayMs`) and the imperative
  `WhatsNewHandle`.
- `src/WhatsNewSheet.tsx`: the presentational sheet (Modal, Animated,
  PanResponder, FlatList paging, Android back, RTL, reduce motion).
- `src/components/Page.tsx`: page renderers (list, media, custom).
- `src/theme.ts`: `defaultTheme`, `darkTheme`, `defaultLabels`, merge
  helpers.
- `src/validate.ts`: `validateNotes` for notes loaded from JSON.
- `src/__tests__/`: Jest tests, one file per module (`core.test.ts`,
  `useWhatsNew.test.tsx`, `WhatsNew.test.tsx`, `WhatsNewSheet.test.tsx`,
  `validate.test.ts`, `devWarnings.test.tsx`), shared fixtures in
  `helpers.ts`.
- `example/`: an Expo app that imports the library from `../src`.
- `llms.txt`: integration guide for agents, shipped in the npm package.
- `skills/react-native-whats-new/SKILL.md`: agent skill for integrating the
  library into an app, shipped in the npm package.
- `lib/`: build output from `yarn prepare`. Never edit.

## Commands

```sh
yarn               # install (Yarn 4 workspaces; never npm install here)
yarn typecheck     # tsc
yarn lint          # eslint + prettier (yarn lint --fix to format)
yarn test          # jest
yarn prepare       # bob build into lib/
yarn example start # run the example app (then i / a), or yarn example ios|android
```

Run `yarn typecheck && yarn lint && yarn test && yarn prepare` before
calling a change done. After touching `package.json` `files`, check
`npm pack --dry-run`.

## Invariants

- **No runtime dependencies.** Only `react` and `react-native` as peers.
  No reanimated, gesture-handler or safe-area-context; the app passes
  `insets` in.
- **No native code.** It must keep working in Expo Go without a config
  plugin or `pod install`.
- **iOS and Android parity.** Every behaviour works on both (Android back
  dismisses like a swipe; Modal quirks differ per OS). Verify both.
- **Events carry shapes only**: versions, indices, counts, booleans. Never
  note text, titles or URLs.
- **Never throw into the app.** Failures in `storage`, `onEvent`, `when`
  and `requestReview` are caught; a failed storage read means "don't show".
- **Fresh installs are silent** unless `showOnFirstInstall`.
- **Manual shows** (`show(version)`) never mark a version seen and never
  ask for a review.
- **Unknown version order never nags**: unparseable versions count as
  "not newer".
- Show-rule changes go in `src/core.ts` first, with tests in
  `core.test.ts`; the hook only wires them to storage and state.
- Dev warnings stay in `src/devWarnings.ts`, guarded by `__DEV__`, prefixed
  `[react-native-whats-new]`, once per mount, and each says the fix.

## Tests

- Pure rules: `src/__tests__/core.test.ts`.
- Hook behaviour (storage, `when`, `enabled`, manual shows, events):
  `src/__tests__/useWhatsNew.test.tsx`, using `memoryStorage()` and `flush`
  from `helpers.ts`.
- Review timing and the ref: `src/__tests__/WhatsNew.test.tsx`.
- Rendering, paging, dismissal, accessibility: `src/__tests__/WhatsNewSheet.test.tsx`.
- Every bug fix gets a test that fails without it.

## Keep the docs in sync

`README.md`, `llms.txt` and `skills/react-native-whats-new/SKILL.md` all
describe the public API. Any change to a prop, type, default, export or show
rule updates all three in the same change. Code snippets in them must
typecheck against `src/`.
