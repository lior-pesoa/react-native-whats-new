import {
  compareVersions,
  decideWhatsNew,
  findRelease,
  parseVersion,
} from '../core';
import type { WhatsNewRelease } from '../types';

const page = { type: 'list' as const, title: 'New', rows: [{ title: 'a' }] };
const rel = (version: string, pages = [page]): WhatsNewRelease => ({
  version,
  pages,
});

describe('parseVersion', () => {
  it.each([
    ['1.2.3', [1, 2, 3]],
    ['1.2', [1, 2]],
    ['1.2.3-beta.1', [1, 2, 3]],
    ['1.2.3+45', [1, 2, 3]],
    [' 2.0 ', [2, 0]],
    ['', null],
    ['abc', null],
    ['1..2', null],
  ])('%p → %p', (input, expected) => {
    expect(parseVersion(input)).toEqual(expected);
  });
});

describe('compareVersions', () => {
  it('treats missing parts as 0', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });
  it('compares numerically, not lexically', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('2.0.0', '10.0.0')).toBe(-1);
  });
  it('equal unparseable strings are equal, otherwise unknown', () => {
    expect(compareVersions('abc', 'abc')).toBe(0);
    expect(compareVersions('abc', '1.0')).toBeNull();
  });
});

describe('findRelease', () => {
  it('exact matches ignore trailing zeros', () => {
    const notes = [rel('1.2')];
    expect(findRelease(notes, '1.2.0', 'exact')?.version).toBe('1.2');
    expect(findRelease(notes, '1.2.1', 'exact')).toBeUndefined();
  });
  it('minor picks the newest same-minor release not newer than the app', () => {
    const notes = [rel('1.2.0'), rel('1.2.2'), rel('1.2.5'), rel('1.3.0')];
    expect(findRelease(notes, '1.2.3', 'minor')?.version).toBe('1.2.2');
    expect(
      findRelease([rel('1.2.0'), rel('1.2.2')], '1.3.0', 'minor')
    ).toBeUndefined();
  });
});

describe('decideWhatsNew', () => {
  const base = { matchMode: 'exact' as const, showOnFirstInstall: false };

  it('stays quiet on first install and remembers the version', () => {
    expect(
      decideWhatsNew({
        ...base,
        notes: [rel('1.2')],
        currentVersion: '1.2',
        lastSeen: null,
      })
    ).toEqual({ show: false, reason: 'first-install', markSeen: true });
  });

  it('shows on first install when asked to', () => {
    const d = decideWhatsNew({
      ...base,
      showOnFirstInstall: true,
      notes: [rel('1.2')],
      currentVersion: '1.2',
      lastSeen: null,
    });
    expect(d.show).toBe(true);
  });

  it('does nothing when the version was already seen', () => {
    expect(
      decideWhatsNew({
        ...base,
        notes: [rel('1.2')],
        currentVersion: '1.2',
        lastSeen: '1.2',
      })
    ).toEqual({ show: false, reason: 'already-seen', markSeen: false });
  });

  it('treats a downgrade as already seen', () => {
    const d = decideWhatsNew({
      ...base,
      notes: [rel('1.9')],
      currentVersion: '1.9',
      lastSeen: '2.0',
    });
    expect(d).toMatchObject({ show: false, reason: 'already-seen' });
  });

  it('shows the notes on an update', () => {
    const d = decideWhatsNew({
      ...base,
      notes: [rel('1.2')],
      currentVersion: '1.2',
      lastSeen: '1.1',
    });
    expect(d.show).toBe(true);
    expect(d.show && d.release.version).toBe('1.2');
  });

  it('marks seen when an update has no notes', () => {
    expect(
      decideWhatsNew({
        ...base,
        notes: [rel('1.1')],
        currentVersion: '1.2',
        lastSeen: '1.1',
      })
    ).toEqual({ show: false, reason: 'no-notes', markSeen: true });
  });

  it('treats notes without pages as no notes', () => {
    expect(
      decideWhatsNew({
        ...base,
        notes: [rel('1.2', [])],
        currentVersion: '1.2',
        lastSeen: '1.1',
      })
    ).toMatchObject({ show: false, reason: 'no-notes' });
  });

  it('never replays already-seen notes in minor mode', () => {
    expect(
      decideWhatsNew({
        ...base,
        matchMode: 'minor',
        notes: [rel('1.2.0')],
        currentVersion: '1.2.1',
        lastSeen: '1.2.0',
      })
    ).toMatchObject({ show: false, reason: 'no-notes' });
  });

  it('shows only the current notes after skipped versions', () => {
    const d = decideWhatsNew({
      ...base,
      notes: [rel('1.1'), rel('1.2'), rel('1.3')],
      currentVersion: '1.3',
      lastSeen: '1.0',
    });
    expect(d.show && d.release.version).toBe('1.3');
  });

  it('never nags on an unparseable version', () => {
    expect(
      decideWhatsNew({
        ...base,
        notes: [rel('dev')],
        currentVersion: 'dev',
        lastSeen: '1.0',
      })
    ).toMatchObject({ show: false, reason: 'already-seen' });
  });
});
