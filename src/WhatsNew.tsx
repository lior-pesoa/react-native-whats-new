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
    /** Default 'done': only a user who read to the end is asked. */
    reviewOn?: 'done' | 'done-or-dismiss';
    /** Default 400, counted from the end of the sheet's out-animation. */
    reviewDelayMs?: number;
  };

export type WhatsNewHandle = {
  /** Opens a version's notes on demand (a "what's new" row in settings). */
  show(version: string): boolean;
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
    const { show, close, reportPage, manual, release } = whatsNew;

    useImperativeHandle(ref, () => ({ show }), [show]);

    const latest = useRef({ requestReview, onEvent });
    useEffect(() => {
      latest.current = { requestReview, onEvent };
    });

    // Version to ask a review for once the sheet is fully gone — the store
    // prompt must not fight the sheet's out-animation.
    const pendingReview = useRef<string | null>(null);
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
        onPageChange={reportPage}
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
