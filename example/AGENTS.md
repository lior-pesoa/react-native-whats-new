# Example app

This is the example app for the `react-native-whats-new` library, not a
standalone product. It is a single screen (`src/App.tsx`, registered from
`index.js`) that simulates app versions, resets the seen version, toggles
sheet height / theme / the rating ask, and logs `onEvent` output.

`react-native-whats-new` resolves to the library source in `../src`: Metro
uses the `react-native-whats-new-source` export condition
(`metro.config.js`) and Babel is configured by
`react-native-builder-bob/babel-config` (`babel.config.js`). Library edits
show up on reload; no build step. Library code and its docs live in the repo
root (see `../AGENTS.md`).

## Run it

From the repo root:

```sh
yarn               # installs both workspaces
yarn example start # then press i or a
yarn example ios
yarn example android
```

Check changes on both iOS and Android.

## Expo has changed: do not trust your training data

Expo ships breaking changes every SDK release. Before touching an Expo API,
read the `expo` major version in `package.json` and check the matching
versioned docs at `https://docs.expo.dev/versions/v<major>.0.0/` (index with
corrections to common LLM mistakes: https://docs.expo.dev/llms.txt).

Add packages with `npx expo install <package>` (not `yarn add`), so versions
match the SDK.
