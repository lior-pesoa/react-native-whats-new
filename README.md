# react-native-whats-new

A paged "what's new" bottom sheet for React Native — and, when the user taps
through to the end, a hook to ask for a store rating right then.

Three reasons that pairing works:

- You likely just shipped something someone was waiting for.
- Finishing the sheet is a purely positive moment — no bug, no friction, no ad.
- You already interrupted them for a good reason, so asking again a beat
  later doesn't cost anything extra.

Pure JS, no native code: works in Expo Go, no `pod install`, no config
plugin. Inspired by [Notelet](https://github.com/mykolaharmash/notelet), a
SwiftUI package by Mykola Harmash (MIT) — this is the same idea, in
React Native, wired to a rating prompt.

<!-- demo gif -->

## Install

```sh
npx expo install react-native-whats-new @react-native-async-storage/async-storage
```

or with plain React Native / npm:

```sh
npm install react-native-whats-new @react-native-async-storage/async-storage
```

No native code — nothing to link, nothing to `pod install`, and it runs fine
in Expo Go.

## 60-second quickstart

```tsx
import { useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as StoreReview from 'expo-store-review';
import { WhatsNew, type WhatsNewRelease, type WhatsNewHandle } from 'react-native-whats-new';

const notes: WhatsNewRelease[] = [
  {
    version: '1.2.0',
    pages: [
      {
        type: 'list',
        title: "what's new",
        rows: [
          { icon: '✨', title: 'Faster sync', description: 'Changes now land in under a second.' },
          { icon: '🌙', title: 'Dark mode', description: 'Follows your system setting automatically.' },
        ],
      },
    ],
  },
];

export function App() {
  const whatsNew = useRef<WhatsNewHandle>(null);

  return (
    <WhatsNew
      ref={whatsNew}
      notes={notes}
      currentVersion={Application.nativeApplicationVersion}
      storage={AsyncStorage}
      requestReview={() => StoreReview.requestReview()}
      onEvent={(e) => console.log('[whats-new]', e)}
    />
  );
}
```

That's the whole integration: mount it once near the root of your app.
On the first launch after an update where `notes` has an entry for the new
version, it shows the sheet; on "Got it" it calls `requestReview`. A fresh
install sees nothing — the current version is remembered silently so day one
users never get a changelog for a version they just installed.

## Writing notes

A release is a version plus a list of pages. Three page types:

```tsx
const notes: WhatsNewRelease[] = [
  {
    version: '2.0.0',
    pages: [
      {
        type: 'list',
        title: "what's new in 2.0",
        rows: [
          { icon: '🚀', title: 'Rebuilt search', description: 'Results now update as you type.' },
          { icon: '🔔', title: 'Smarter notifications', description: 'Grouped by conversation.' },
        ],
      },
      {
        type: 'media',
        kind: 'image',
        source: { uri: 'https://example.com/2.0-hero.png' },
        title: 'A fresh look',
        description: 'Redesigned from the ground up.',
      },
      {
        type: 'media',
        kind: 'video',
        source: require('./assets/2.0-demo.mp4'),
        poster: require('./assets/2.0-demo-poster.png'),
        title: 'See it in action',
      },
      {
        type: 'custom',
        render: () => <MyOwnPageContent />,
      },
    ],
  },
];
```

- `list` — a titled list of rows, each with an optional icon (an emoji /
  element, or an `ImageSourcePropType`), a title and a description.
- `media` — a full-bleed image or video with an optional caption. Videos
  need `renderVideo` (below) to actually play; without it they show
  `poster`.
- `custom` — anything you want, as a render function. Custom pages are code,
  so they can't come from remote JSON — see [`validateNotes`](#helpers) for
  the JSON case.

## When does it show?

`currentVersion` vs. the versions in `notes`, checked once per mount against
what's stored:

| Situation | Result |
| --- | --- |
| Fresh install, no prior seen version | Nothing shown; current version stored silently (unless `showOnFirstInstall`) |
| Current version unchanged since last seen | Nothing shown |
| Current version is *older* than last seen (downgrade) | Nothing shown; stored version updated to the older one |
| Update, and `notes` has an entry for the new version | Sheet shown for that release |
| Update, and `notes` has no entry for the new version | Nothing shown; version stored so it's never revisited |
| Several versions skipped, only some have notes | Shows notes for the newest version that has an exact/matching entry not newer than the app |
| `matchMode="minor"`, app is on a patch release | Reuses the newest `notes` entry from the same `major.minor` (`1.2.3` reuses `1.2.0`) |
| `when` returns `false` | Sheet skipped for this launch only; nothing is marked seen, so it's re-checked next launch |
| `enabled={false}` | Component is a no-op — no checks, no storage reads/writes |

## Asking for a rating

```tsx
<WhatsNew
  // ...
  requestReview={() => StoreReview.requestReview()}
  reviewOn="done"           // default — swiping the sheet away never prompts
  reviewDelayMs={400}       // default — waits for the close animation to finish
/>
```

- `reviewOn="done"` (default) only calls `requestReview` when the user taps
  the final "Got it". `"done-or-dismiss"` also calls it if they swipe/close
  the sheet on any page — use this if you consider *seeing* the notes enough
  of a positive moment.
- `reviewDelayMs` gives the sheet's close animation time to finish before the
  system prompt appears on top of it.
- Manual shows (`ref.current.show(version)`) never mark a version as seen and
  never trigger a review — they're for a settings-screen "what's new" row,
  not the automatic flow.

Store realities worth knowing, because neither platform tells you what
actually happened:

- **iOS**: the system prompt shows at most **3 times per 365 days** per app,
  and Apple decides when. In a development build it always appears (but
  can't submit); in **TestFlight it never appears**. Only App Store installs
  see the real thing.
- **Android**: the Play In-App Review API has an **undisclosed quota** and
  only surfaces the real dialog from a **Play-installed** build (including
  internal testing tracks) — not from `expo start`, not from a sideloaded
  APK.
- Neither `requestReview()` call resolves with whether the prompt actually
  showed. Treat every call as "asked", not "shown".
- **Policy**: don't gate the request behind "are you enjoying the app?" or
  any in-app satisfaction question first — [Google Play's in-app review
  guidelines](https://developer.android.com/guide/playcore/in-app-review)
  forbid asking any question before the prompt, including "do you like the
  app?". Call `requestReview` directly.

## Recipes

**Bare React Native** (no Expo):

```tsx
import { getVersion } from 'react-native-device-info';
import InAppReview from 'react-native-in-app-review';

<WhatsNew
  notes={notes}
  currentVersion={getVersion()}
  storage={AsyncStorage}
  requestReview={() => InAppReview.RequestInAppReview()}
/>;
```

**MMKV instead of AsyncStorage:**

```tsx
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const mmkvAdapter = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
};

<WhatsNew notes={notes} currentVersion={version} storage={mmkvAdapter} />;
```

**Notes from remote JSON:**

```tsx
import { validateNotes } from 'react-native-whats-new';

const res = await fetch('https://example.com/whats-new.json');
const result = validateNotes(await res.json());

if (result.ok) {
  setNotes(result.notes);
} else {
  console.warn('Invalid what\'s-new JSON:', result.errors);
}
```

`custom` pages are functions, so they can never come from JSON — remote
notes are limited to `list` and `media` pages.

**Manual "What's new" row in Settings:**

```tsx
<Pressable onPress={() => whatsNew.current?.show('1.2.0')}>
  <Text>What's new</Text>
</Pressable>
```

`ref.current.show(version)` returns `true` if that version has notes and the
sheet opened, `false` otherwise. It doesn't touch storage or trigger a review.

**Video via `expo-video`:**

```tsx
import { useVideoPlayer, VideoView } from 'expo-video';

function InlineVideo({ source }: { source: { uri: string } | number }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={{ flex: 1 }} contentFit="cover" />;
}

<WhatsNew notes={notes} /* ... */ renderVideo={(source) => <InlineVideo source={source} />} />;
```

**Custom UI with the headless hook:**

```tsx
import { useWhatsNew, WhatsNewSheet } from 'react-native-whats-new';

function App() {
  const wn = useWhatsNew({ notes, currentVersion, storage: AsyncStorage });
  return (
    <>
      {/* your app */}
      <WhatsNewSheet
        release={wn.release}
        visible={wn.visible}
        onClose={(via, pageIndex) => wn.close(via, pageIndex)}
        onPageChange={wn.reportPage}
      />
    </>
  );
}
```

Use `useWhatsNew` alone (no `WhatsNewSheet`) to drive entirely custom UI —
`visible`, `release` and `manual` tell you what to render; call `reportPage`
as the user pages through and `close(via, pageIndex)` when they're done.

**Theming and labels:**

```tsx
<WhatsNew
  // ...
  theme={{ accent: '#FF5A5F', radius: 20 }}
  labels={{ next: 'Weiter', done: 'Los geht\'s', close: 'Schließen', page: (i, n) => `Seite ${i} von ${n}` }}
/>
```

`theme` merges over `defaultTheme` (light) / `darkTheme` (dark) — omit it and
the sheet follows the system appearance. `labels` merges over
`defaultLabels` for localization.

**Analytics via `onEvent`:**

```tsx
<WhatsNew
  // ...
  onEvent={(e) => {
    // e.type: 'shown' | 'page_viewed' | 'done' | 'dismissed' | 'review_requested'
    analytics.track(`whats_new_${e.type}`, e);
  }}
/>
```

Events carry shapes only — version strings, indices, counts, booleans. No
copy from your notes is ever included.

## API reference

### `<WhatsNew />` props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `notes` | `WhatsNewRelease[]` | — | Required |
| `currentVersion` | `string \| null \| undefined` | — | `null`/`undefined` = wait, don't check yet |
| `storage` | `WhatsNewStorage` | — | Required; `AsyncStorage` fits directly |
| `matchMode` | `'exact' \| 'minor'` | `'exact'` | |
| `showOnFirstInstall` | `boolean` | `false` | |
| `when` | `() => boolean \| Promise<boolean>` | — | `false` skips this launch without marking seen |
| `enabled` | `boolean` | `true` | `false` = full no-op |
| `onEvent` | `(e: WhatsNewEvent) => void` | — | |
| `requestReview` | `() => unknown` | — | e.g. `StoreReview.requestReview` |
| `reviewOn` | `'done' \| 'done-or-dismiss'` | `'done'` | |
| `reviewDelayMs` | `number` | `400` | After the sheet finishes closing |
| `theme` | `Partial<WhatsNewTheme>` | — | Merged over the system light/dark base |
| `labels` | `Partial<WhatsNewLabels>` | — | |
| `sheetHeight` | `'standard' \| 'full'` | `'standard'` | |
| `renderVideo` | `(source, page) => ReactNode` | — | Without it, video pages show `poster` |
| `insets` | `{ top: number; bottom: number }` | — | Pass `useSafeAreaInsets()` |
| `ref` | `Ref<WhatsNewHandle>` | — | `ref.current.show(version) → boolean` |

### `useWhatsNew(options)`

Same options as `<WhatsNew />` minus the rendering-only ones (`theme`,
`labels`, `sheetHeight`, `renderVideo`, `insets`). Returns:

| Field | Type | Notes |
| --- | --- | --- |
| `visible` | `boolean` | |
| `release` | `WhatsNewRelease \| undefined` | |
| `manual` | `boolean` | `true` when opened via `show()` |
| `show(version)` | `(version: string) => boolean` | |
| `close(via, pageIndex)` | `(via: 'done' \| 'dismissed', pageIndex: number) => void` | |
| `reportPage(index)` | `(index: number) => void` | |

### Helpers

| Export | Signature | Notes |
| --- | --- | --- |
| `markWhatsNewSeen` | `(storage, version) => Promise<void>` | Call at the end of onboarding so the just-installed version is never shown as "new" |
| `resetWhatsNew` | `(storage) => Promise<void>` | Dev/debug only |
| `validateNotes` | `(json: unknown) => { ok: true; notes } \| { ok: false; errors: string[] }` | For notes fetched as JSON; `custom` pages can't validate from JSON |
| `compareVersions` | `(a: string, b: string) => number` | Semver-ish comparison used internally |
| `defaultTheme`, `darkTheme` | `WhatsNewTheme` | |
| `defaultLabels` | `WhatsNewLabels` | |

## Platform notes

- **Android**: the hardware/gesture back button dismisses the sheet like a
  swipe-down (fires `onClose('dismissed', pageIndex)`), it doesn't close your
  app.
- **RTL**: paging and the dot indicator follow `I18nManager.isRTL`.
- **Reduce motion**: sheet and page transitions respect the OS-level
  reduce-motion setting on both platforms.
- **Safe areas**: the sheet doesn't read safe-area insets itself — pass
  `insets={useSafeAreaInsets()}` (from `react-native-safe-area-context`) so
  content clears the notch/home indicator/gesture bar.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## Credits

Inspired by [Notelet](https://github.com/mykolaharmash/notelet) by
[Mykola Harmash](https://github.com/mykolaharmash), MIT licensed.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
