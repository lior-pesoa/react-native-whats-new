# Contributing

Thanks for helping. This is a small, pure-JS library: no native code, no
runtime dependencies. Issues and pull requests are welcome.

## Setup

```sh
yarn            # installs the library and the example app (yarn 4 workspaces)
yarn example start   # Expo dev server for the example; open it in Expo Go
```

The example imports `react-native-whats-new` straight from `src/`, so edits
show up on reload. Its "Replay the update to 1.2.0" button walks the whole
automatic flow, including the rating ask.

## Before you open a PR

```sh
yarn typecheck
yarn lint        # yarn lint --fix for formatting
yarn test
yarn prepare     # builds lib/ with react-native-builder-bob
```

CI runs the same four.

## Ground rules

- iOS and Android must behave the same — test both when you touch the sheet.
- No runtime dependencies and no native code; peers are `react` and
  `react-native` only.
- Storage, `onEvent` and `requestReview` failures must never throw into the
  app.
- The show rules live in `src/core.ts` (pure, fully unit-tested) — change
  them there, with a test.
- Any public API change updates **README.md, llms.txt and
  skills/react-native-whats-new/SKILL.md** together.

`AGENTS.md` has the same rules plus the file map, for coding agents.

## Commit messages

Say what changed for the person using the library, in plain words. No
prefix convention required.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Contact:
hello@liorpesoa.com.
