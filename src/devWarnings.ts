import { useEffect, useRef } from 'react';
import { compareVersions, parseVersion } from './core';
import type { WhatsNewRelease } from './types';

const PREFIX = '[react-native-whats-new]';

/** A setup mistake, or null. Each message names the fix. */
export function storageProblem(storage: unknown): string | null {
  const s = storage as { getItem?: unknown; setItem?: unknown } | null;
  if (
    typeof s === 'object' &&
    s !== null &&
    typeof s.getItem === 'function' &&
    typeof s.setItem === 'function'
  ) {
    return null;
  }
  return (
    `${PREFIX} \`storage\` must have getItem(key) and setItem(key, value) functions, ` +
    'so the sheet can never show with this value. Pass AsyncStorage, or wrap MMKV in an adapter: ' +
    '{ getItem: (k) => mmkv.getString(k) ?? null, setItem: (k, v) => mmkv.set(k, v) }.'
  );
}

export function versionProblem(
  currentVersion: string | null | undefined
): string | null {
  if (!currentVersion) return null;
  const parts = parseVersion(currentVersion);
  if (!parts) {
    return (
      `${PREFIX} \`currentVersion\` "${currentVersion}" can't be compared as a version, ` +
      'so no update is ever detected. Pass the marketing version like "1.2.0" ' +
      '(expo-application nativeApplicationVersion, react-native-device-info getVersion()), ' +
      'not the build number.'
    );
  }
  if (parts.length < 2) {
    return (
      `${PREFIX} \`currentVersion\` "${currentVersion}" looks like a build number. ` +
      'Pass the marketing version like "1.2.0" (expo-application nativeApplicationVersion, ' +
      'react-native-device-info getVersion()), not nativeBuildVersion / getBuildNumber().'
    );
  }
  return null;
}

export function duplicatesProblem(
  notes: readonly WhatsNewRelease[] | null | undefined
): string | null {
  if (!Array.isArray(notes)) return null;
  const dupes: string[] = [];
  notes.forEach((release, i) => {
    const earlier = notes
      .slice(0, i)
      .some((n) => compareVersions(n.version, release.version) === 0);
    if (earlier && !dupes.includes(release.version))
      dupes.push(release.version);
  });
  if (dupes.length === 0) return null;
  return (
    `${PREFIX} \`notes\` has more than one release for ${dupes
      .map((v) => `"${v}"`)
      .join(', ')}. Only the first one is ever shown; ` +
    'merge their pages into a single release.'
  );
}

/**
 * Dev-only setup checks. Each warning fires at most once per mount; in
 * production builds this does nothing.
 */
export function useDevWarnings(options: {
  storage: unknown;
  currentVersion: string | null | undefined;
  notes: readonly WhatsNewRelease[] | null | undefined;
}): void {
  const { storage, currentVersion, notes } = options;
  const warned = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!__DEV__) return;
    const checks: Array<[string, () => string | null]> = [
      ['storage', () => storageProblem(storage)],
      ['version', () => versionProblem(currentVersion)],
      ['duplicates', () => duplicatesProblem(notes)],
    ];
    for (const [kind, check] of checks) {
      if (warned.current.has(kind)) continue;
      const message = check();
      if (message) {
        warned.current.add(kind);
        console.warn(message);
      }
    }
  }, [storage, currentVersion, notes]);
}
