import { SEEN_KEY } from './core';
import type { WhatsNewStorage } from './types';

/** The last version the user has seen, or null for "never". Throws if the store does. */
export async function readSeen(
  storage: WhatsNewStorage
): Promise<string | null> {
  const value = await storage.getItem(SEEN_KEY);
  // resetWhatsNew writes '' because not every store has removeItem.
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Best effort: a failed write only means the sheet may show again next launch. */
export async function writeSeen(
  storage: WhatsNewStorage,
  version: string
): Promise<void> {
  try {
    await storage.setItem(SEEN_KEY, version);
  } catch {
    // ignored on purpose
  }
}

/**
 * Remember `version` as seen without showing anything — call it when a new
 * user finishes onboarding so the next update compares against it.
 */
export async function markWhatsNewSeen(
  storage: WhatsNewStorage,
  version: string
): Promise<void> {
  await storage.setItem(SEEN_KEY, version);
}

/** Forget the seen version, so the next launch behaves like a fresh install. */
export async function resetWhatsNew(storage: WhatsNewStorage): Promise<void> {
  await storage.setItem(SEEN_KEY, '');
}
