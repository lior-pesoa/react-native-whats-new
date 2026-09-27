# Changelog

## 0.1.0 — 2026-09-27

First release.

- `<WhatsNew>`: a paged bottom sheet of release notes, shown once on the
  first launch after an app update, then (optionally) the native store
  rating prompt after "Got it". Fresh installs stay silent.
- Page types: `list`, `media` (image or video, square or any
  `aspectRatio`) and `custom`.
- `useWhatsNew` for your own UI, `WhatsNewSheet` for manual shows,
  `validateNotes` for remote JSON, `markWhatsNewSeen` / `resetWhatsNew`.
- Options: `matchMode`, `showOnFirstInstall`, `when`, `enabled`,
  `notes={null}` while remote notes load, `reviewOn` (`done`,
  `done-or-dismiss`, `never`), `reviewDelayMs`, `theme`, `labels`,
  `sheetHeight`, `renderVideo`, `insets`, `onEvent`.
- Pure JS: works in Expo Go, iOS and Android, RTL, reduce motion, screen
  readers, Android back.
- Agent-ready: `llms.txt` ships in the package, plus an installable skill
  (`npx skills add lior-pesoa/react-native-whats-new`).
