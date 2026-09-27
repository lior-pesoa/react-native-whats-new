import type { WhatsNewMatchMode, WhatsNewRelease } from './types';

export const SEEN_KEY = 'react-native-whats-new:last-seen-version';

/** "1.2.3-beta+7" → [1, 2, 3]. Anything unparseable → null. */
export function parseVersion(version: string): number[] | null {
  const core = version.trim().split(/[-+]/)[0] ?? '';
  if (!core) return null;
  const parts = core.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  return parts.some(Number.isNaN) ? null : parts;
}

/**
 * Numeric compare, missing parts count as 0 ("1.2" == "1.2.0").
 * Unparseable versions compare as equal only when the strings are equal,
 * otherwise `null` — the caller decides what "unknown order" means.
 */
export function compareVersions(a: string, b: string): number | null {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return a.trim() === b.trim() ? 0 : null;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * The release to show for `current`. `minor` picks the newest release in
 * the same major.minor that isn't newer than the app itself.
 */
export function findRelease(
  notes: readonly WhatsNewRelease[],
  current: string,
  matchMode: WhatsNewMatchMode
): WhatsNewRelease | undefined {
  const exact = notes.find((n) => compareVersions(n.version, current) === 0);
  if (exact || matchMode === 'exact') return exact;

  const cur = parseVersion(current);
  if (!cur) return undefined;
  let best: WhatsNewRelease | undefined;
  for (const n of notes) {
    const v = parseVersion(n.version);
    if (!v || (v[0] ?? 0) !== (cur[0] ?? 0) || (v[1] ?? 0) !== (cur[1] ?? 0)) {
      continue;
    }
    if ((compareVersions(n.version, current) ?? 1) > 0) continue;
    if (!best || (compareVersions(n.version, best.version) ?? 0) > 0) best = n;
  }
  return best;
}

export type WhatsNewDecision =
  | { show: true; release: WhatsNewRelease }
  | {
      show: false;
      reason: 'first-install' | 'already-seen' | 'no-notes';
      /** Write `currentVersion` as seen now, so a later update compares against it. */
      markSeen: boolean;
    };

/**
 * Whether the automatic sheet shows on this launch. Pure — storage and
 * the app's own `when` gate live in the hook.
 *
 * - No seen version = a fresh install: new users didn't "update", so stay
 *   quiet and remember this version (unless `showOnFirstInstall`).
 * - Seen ≥ current (same version, or a downgrade) → nothing.
 * - Otherwise show the matching release, but only if it's newer than what
 *   was seen — in `minor` mode 1.2.0 seen → 1.2.1 must not replay 1.2.0.
 * - Unknown order (unparseable versions) counts as "not newer": never nag.
 */
export function decideWhatsNew(input: {
  notes: readonly WhatsNewRelease[];
  currentVersion: string;
  lastSeen: string | null;
  matchMode: WhatsNewMatchMode;
  showOnFirstInstall: boolean;
}): WhatsNewDecision {
  const { notes, currentVersion, lastSeen, matchMode, showOnFirstInstall } =
    input;

  if (lastSeen === null && !showOnFirstInstall) {
    return { show: false, reason: 'first-install', markSeen: true };
  }
  if (
    lastSeen !== null &&
    (compareVersions(currentVersion, lastSeen) ?? 0) <= 0
  ) {
    return { show: false, reason: 'already-seen', markSeen: false };
  }

  const release = findRelease(notes, currentVersion, matchMode);
  const fresh =
    release !== undefined &&
    release.pages.length > 0 &&
    (lastSeen === null ||
      (compareVersions(release.version, lastSeen) ?? 0) > 0);
  if (!fresh) return { show: false, reason: 'no-notes', markSeen: true };

  return { show: true, release };
}
