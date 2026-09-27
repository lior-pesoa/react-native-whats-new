import { SEEN_KEY } from '../core';
import type { WhatsNewRelease, WhatsNewStorage } from '../types';

export function memoryStorage(initial?: string | null) {
  const map = new Map<string, string>();
  if (initial != null) map.set(SEEN_KEY, initial);
  const storage: WhatsNewStorage = {
    getItem: jest.fn(async (key: string) => map.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      map.set(key, value);
    }),
  };
  return { storage, seen: () => map.get(SEEN_KEY) };
}

const list = (title: string) => ({
  type: 'list' as const,
  title,
  rows: [{ title: 'Row' }],
});

export const notes: WhatsNewRelease[] = [
  { version: '1.1.0', pages: [list('one')] },
  { version: '1.2.0', pages: [list('a'), list('b'), list('c')] },
];

/** Lets pending promise chains (storage, when) settle. */
export const flush = () => new Promise<void>((r) => setTimeout(r, 0));
