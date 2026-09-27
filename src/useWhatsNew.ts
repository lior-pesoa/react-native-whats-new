import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { compareVersions, decideWhatsNew } from './core';
import { useDevWarnings } from './devWarnings';
import { readSeen, writeSeen } from './storage';
import type {
  WhatsNewEvent,
  WhatsNewMatchMode,
  WhatsNewRelease,
  WhatsNewStorage,
} from './types';
import type { WhatsNewCloseVia } from './WhatsNewSheet';

export type UseWhatsNewOptions = {
  /** null/undefined → still loading (remote notes): wait, store nothing. */
  notes: readonly WhatsNewRelease[] | null | undefined;
  /** null/undefined → wait until the app knows its version. */
  currentVersion: string | null | undefined;
  /** AsyncStorage, or an adapter over MMKV / SecureStore. */
  storage: WhatsNewStorage;
  /** Default 'exact'. */
  matchMode?: WhatsNewMatchMode;
  /** Default false: a fresh install stays quiet and just remembers the version. */
  showOnFirstInstall?: boolean;
  /** The app's own gate. false (or a throw) → don't show now, and don't mark seen. */
  when?: () => boolean | Promise<boolean>;
  /** Default true. false → no automatic evaluation (e.g. during onboarding). */
  enabled?: boolean;
  onEvent?: (event: WhatsNewEvent) => void;
};

export type UseWhatsNewResult = {
  visible: boolean;
  /** Stays set after close so the sheet can animate out. */
  release: WhatsNewRelease | null;
  /** True when opened through show(). */
  manual: boolean;
  /** Opens a specific version's notes. false when there are none. */
  show(version: string): boolean;
  close(via: WhatsNewCloseVia, pageIndex: number): void;
  /** Reports a page the user reached (emits page_viewed). */
  reportPage(pageIndex: number): void;
};

type State = {
  visible: boolean;
  release: WhatsNewRelease | null;
  manual: boolean;
  /** The app version an automatic show was for — written as seen on close. */
  forVersion: string | null;
};

const HIDDEN: State = {
  visible: false,
  release: null,
  manual: false,
  forVersion: null,
};

export function useWhatsNew(options: UseWhatsNewOptions): UseWhatsNewResult {
  const {
    notes,
    currentVersion,
    matchMode = 'exact',
    showOnFirstInstall = false,
    enabled = true,
  } = options;

  useDevWarnings(options);

  const [state, setState] = useState<State>(HIDDEN);
  // Mirrors `state` synchronously so a double close can't write or emit twice.
  const stateRef = useRef<State>(HIDDEN);
  const apply = useCallback((next: State) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Callbacks and storage are read at call time, so inline lambdas don't
  // restart the evaluation on every render.
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  const emit = useCallback((event: WhatsNewEvent) => {
    try {
      latest.current.onEvent?.(event);
    } catch {
      // an analytics hook must never break the sheet
    }
  }, []);

  const seq = useRef(0);
  const evaluatedKey = useRef<string | null>(null);
  const shownFor = useRef<string | null>(null);

  // Content, not identity: `notes` is often an inline array literal.
  const notesKey = notes
    ? notes.map((n) => `${n.version}:${n.pages.length}`).join('|')
    : null;

  useEffect(() => {
    if (!enabled) {
      evaluatedKey.current = null;
      return undefined;
    }
    if (!currentVersion || notesKey === null) return undefined;
    const key = `${currentVersion}|${matchMode}|${showOnFirstInstall}|${notesKey}`;
    if (evaluatedKey.current === key) return undefined;

    const mine = ++seq.current;
    let cancelled = false;
    // Stale once a newer evaluation, a manual show or unmount came along.
    const stale = () => cancelled || seq.current !== mine;

    const run = async () => {
      const { storage, when } = latest.current;
      let lastSeen: string | null;
      try {
        lastSeen = await readSeen(storage);
      } catch {
        // Unknown state: never show, try again next launch.
        if (!stale()) evaluatedKey.current = key;
        return;
      }
      if (stale()) return;

      const decision = decideWhatsNew({
        notes: latest.current.notes ?? [],
        currentVersion,
        lastSeen,
        matchMode,
        showOnFirstInstall,
      });
      if (!decision.show) {
        evaluatedKey.current = key;
        if (decision.markSeen) await writeSeen(storage, currentVersion);
        return;
      }
      if (shownFor.current === currentVersion) {
        evaluatedKey.current = key;
        return;
      }

      let allowed = true;
      if (when) {
        try {
          allowed = Boolean(await when());
        } catch {
          allowed = false;
        }
      }
      if (stale()) return;
      evaluatedKey.current = key;
      if (!allowed) return;

      shownFor.current = currentVersion;
      apply({
        visible: true,
        release: decision.release,
        manual: false,
        forVersion: currentVersion,
      });
      emit({
        type: 'shown',
        version: decision.release.version,
        pageCount: decision.release.pages.length,
        manual: false,
      });
    };
    run().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    currentVersion,
    matchMode,
    showOnFirstInstall,
    notesKey,
    apply,
    emit,
  ]);

  const show = useCallback(
    (version: string) => {
      const release = latest.current.notes?.find(
        (n) => compareVersions(n.version, version) === 0
      );
      if (!release || release.pages.length === 0) return false;
      // A pending automatic evaluation must not overwrite the manual sheet.
      seq.current++;
      apply({ visible: true, release, manual: true, forVersion: null });
      emit({
        type: 'shown',
        version: release.version,
        pageCount: release.pages.length,
        manual: true,
      });
      return true;
    },
    [apply, emit]
  );

  const close = useCallback(
    (via: WhatsNewCloseVia, pageIndex: number) => {
      const current = stateRef.current;
      if (!current.visible || !current.release) return;
      apply({ ...current, visible: false });
      if (!current.manual && current.forVersion) {
        writeSeen(latest.current.storage, current.forVersion).catch(() => {});
      }
      emit({
        type: via,
        version: current.release.version,
        pageIndex,
        pageCount: current.release.pages.length,
      });
    },
    [apply, emit]
  );

  const reportPage = useCallback(
    (pageIndex: number) => {
      const { release } = stateRef.current;
      if (!release) return;
      emit({
        type: 'page_viewed',
        version: release.version,
        pageIndex,
        pageCount: release.pages.length,
      });
    },
    [emit]
  );

  return {
    visible: state.visible,
    release: state.release,
    manual: state.manual,
    show,
    close,
    reportPage,
  };
}
