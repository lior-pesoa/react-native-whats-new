import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { useWhatsNew, type UseWhatsNewOptions } from './useWhatsNew';
import {
  WhatsNewSheet,
  type WhatsNewCloseVia,
  type WhatsNewSheetProps,
} from './WhatsNewSheet';

export type WhatsNewProps = UseWhatsNewOptions &
  Omit<
    WhatsNewSheetProps,
    'release' | 'visible' | 'onClose' | 'onPageChange' | 'onHidden'
  > & {
    /** Your store-rating call, e.g. StoreReview.requestReview. */
    requestReview?: () => Promise<unknown> | unknown;
    /**
     * Default 'done': only a user who read to the end is asked.
     * 'never' keeps the sheet notes-only (same as leaving out requestReview).
     */
    reviewOn?: 'done' | 'done-or-dismiss' | 'never';
    /** Default 400, counted from the end of the sheet's out-animation. */
    reviewDelayMs?: number;
  };

export type WhatsNewHandle = {
  /** Opens a version's notes on demand (a "what's new" row in settings). */
  show(version: string): boolean;
  /**
   * Closes the sheet from code (counts as `dismissed`, never asks for a
   * review) — e.g. before navigating away from a notification tap. No-op
   * when nothing is showing.
   */
  dismiss(): void;
};

export const WhatsNew = forwardRef<WhatsNewHandle, WhatsNewProps>(
  function WhatsNewInner(props, ref) {
    const {
      notes,
      currentVersion,
      storage,
      matchMode,
      showOnFirstInstall,
      when,
      enabled,
      onEvent,
      requestReview,
      reviewOn = 'done',
      reviewDelayMs = 400,
      ...sheetProps
    } = props;

    const whatsNew = useWhatsNew({
      notes,
      currentVersion,
      storage,
      matchMode,
      showOnFirstInstall,
      when,
      enabled,
      onEvent,
    });
    const { show, close, reportPage, manual, release, visible } = whatsNew;

    // Version to ask a review for once the sheet is fully gone — the store
    // prompt must not fight the sheet's out-animation.
    const pendingReview = useRef<string | null>(null);

    // The page the user is on, for a dismiss that comes from code.
    const pageRef = useRef(0);
    const onPageChange = useCallback(
      (pageIndex: number) => {
        pageRef.current = pageIndex;
        reportPage(pageIndex);
      },
      [reportPage]
    );

    const visibleRef = useRef(visible);
    // Every show starts on the first page.
    if (visible && !visibleRef.current) pageRef.current = 0;
    visibleRef.current = visible;
    const dismiss = useCallback(() => {
      if (!visibleRef.current) return;
      pendingReview.current = null;
      close('dismissed', pageRef.current);
    }, [close]);

    useImperativeHandle(ref, () => ({ show, dismiss }), [show, dismiss]);

    const latest = useRef({ requestReview, onEvent });
    useEffect(() => {
      latest.current = { requestReview, onEvent };
    });

    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
      () => () => {
        if (timer.current) clearTimeout(timer.current);
      },
      []
    );

    const onClose = useCallback(
      (via: WhatsNewCloseVia, pageIndex: number) => {
        const wanted =
          !manual &&
          release !== null &&
          reviewOn !== 'never' &&
          (via === 'done' || reviewOn === 'done-or-dismiss');
        pendingReview.current = wanted && release ? release.version : null;
        close(via, pageIndex);
      },
      [manual, release, reviewOn, close]
    );

    const onHidden = useCallback(() => {
      const version = pendingReview.current;
      pendingReview.current = null;
      if (!version || !latest.current.requestReview) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        const { requestReview: ask, onEvent: report } = latest.current;
        if (!ask) return;
        try {
          report?.({ type: 'review_requested', version });
        } catch {
          // analytics must not block the prompt
        }
        try {
          const result = ask();
          if (isThenable(result)) Promise.resolve(result).catch(() => {});
        } catch {
          // a store that can't rate right now is not the app's crash
        }
      }, reviewDelayMs);
    }, [reviewDelayMs]);

    return (
      <WhatsNewSheet
        {...sheetProps}
        release={release}
        visible={whatsNew.visible}
        onClose={onClose}
        onPageChange={onPageChange}
        onHidden={onHidden}
      />
    );
  }
);

WhatsNew.displayName = 'WhatsNew';

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}
