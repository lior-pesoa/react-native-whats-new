import type { ReactNode } from 'react';
import type { ImageSourcePropType } from 'react-native';

/** A remote `{ uri }` or a bundled `require('./x.png')`. */
export type WhatsNewSource = { uri: string } | number;

export type WhatsNewListRow = {
  /** Your own icon element, or an image. SF Symbols don't exist on Android. */
  icon?: ReactNode | ImageSourcePropType;
  title: string;
  description?: string;
};

export type WhatsNewPage =
  | { type: 'list'; title: string; rows: WhatsNewListRow[] }
  | {
      type: 'media';
      kind: 'image' | 'video';
      source: WhatsNewSource;
      /** Shown for a video when no `renderVideo` is given, and while it loads. */
      poster?: WhatsNewSource;
      title?: string;
      description?: string;
    }
  | { type: 'custom'; render: () => ReactNode };

export type WhatsNewRelease = {
  /** Semver-ish: "1.2.0", "1.2". Pre-release/build suffixes are ignored. */
  version: string;
  pages: WhatsNewPage[];
};

/**
 * AsyncStorage's shape, so `storage={AsyncStorage}` just works. Sync
 * stores (MMKV) fit too — return values may be plain or promised.
 */
export type WhatsNewStorage = {
  getItem(key: string): Promise<string | null> | string | null | undefined;
  setItem(key: string, value: string): Promise<void> | void;
};

/** `exact`: only notes for this version. `minor`: 1.2.3 reuses 1.2.0's notes. */
export type WhatsNewMatchMode = 'exact' | 'minor';

export type WhatsNewEvent =
  | { type: 'shown'; version: string; pageCount: number; manual: boolean }
  | {
      type: 'page_viewed';
      version: string;
      pageIndex: number;
      pageCount: number;
    }
  | { type: 'done'; version: string; pageIndex: number; pageCount: number }
  | { type: 'dismissed'; version: string; pageIndex: number; pageCount: number }
  | { type: 'review_requested'; version: string };

export type WhatsNewTheme = {
  background: string;
  text: string;
  secondaryText: string;
  accent: string;
  /** Text on the accent-coloured button. */
  onAccent: string;
  dot: string;
  backdrop: string;
  radius: number;
  /** Font families by role — no weights; pass a bold family if you want one. */
  fonts: { title?: string; body?: string; button?: string };
};

export type WhatsNewLabels = {
  next: string;
  done: string;
  /** Accessibility label for the close affordance. */
  close: string;
  /** Accessibility label for the page dots, 1-based. */
  page: (index: number, count: number) => string;
};
