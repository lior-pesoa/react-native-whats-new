import { createRef } from 'react';
import { act, render } from '@testing-library/react-native';
import type { WhatsNewEvent } from '../types';
import { WhatsNew, type WhatsNewHandle, type WhatsNewProps } from '../WhatsNew';
import type { WhatsNewSheetProps } from '../WhatsNewSheet';
import { memoryStorage, notes } from './helpers';

// The sheet is driven through its props: what matters here is the review
// timing around onClose → onHidden, not the Modal's animation.
let sheet: WhatsNewSheetProps | undefined;
jest.mock('../WhatsNewSheet', () => ({
  WhatsNewSheet: (props: WhatsNewSheetProps) => {
    sheet = props;
    return null;
  },
}));

const current = (): WhatsNewSheetProps => {
  if (!sheet) throw new Error('sheet not rendered');
  return sheet;
};

const tick = (ms = 0) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

async function mount(props: Partial<WhatsNewProps> = {}, seen = '1.1.0') {
  const events: WhatsNewEvent[] = [];
  const requestReview = jest.fn();
  const ref = createRef<WhatsNewHandle>();
  const { storage } = memoryStorage(seen);
  const view = await render(
    <WhatsNew
      ref={ref}
      notes={notes}
      currentVersion="1.2.0"
      storage={storage}
      onEvent={(e) => events.push(e)}
      requestReview={requestReview}
      {...props}
    />
  );
  await tick();
  return { view, events, requestReview, ref };
}

async function closeAndHide(via: 'done' | 'dismissed', pageIndex = 2) {
  await act(async () => current().onClose(via, pageIndex));
  expect(current().visible).toBe(false);
  await act(async () => current().onHidden?.());
}

beforeEach(() => {
  sheet = undefined;
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('WhatsNew', () => {
  it('asks for a review after done, once the sheet is hidden', async () => {
    const { events, requestReview } = await mount();
    expect(current().visible).toBe(true);
    expect(current().release?.version).toBe('1.2.0');

    await closeAndHide('done');
    await tick(399);
    expect(requestReview).not.toHaveBeenCalled();
    await tick(1);
    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual({
      type: 'review_requested',
      version: '1.2.0',
    });
  });

  it('does not ask after a dismiss by default', async () => {
    const { requestReview, events } = await mount();
    await closeAndHide('dismissed');
    await tick(1000);
    expect(requestReview).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'review_requested')).toBe(false);
  });

  it('asks after a dismiss with reviewOn done-or-dismiss', async () => {
    const { requestReview } = await mount({ reviewOn: 'done-or-dismiss' });
    await closeAndHide('dismissed', 0);
    await tick(400);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('never asks with reviewOn never', async () => {
    const { requestReview, events } = await mount({ reviewOn: 'never' });
    await closeAndHide('done');
    await tick(1000);
    expect(requestReview).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'review_requested')).toBe(false);
  });

  it('dismiss() from the ref closes the sheet as dismissed, without a review', async () => {
    const { requestReview, events, ref } = await mount({
      reviewOn: 'done-or-dismiss',
    });
    expect(current().visible).toBe(true);
    await act(async () => {
      ref.current?.dismiss();
    });
    expect(current().visible).toBe(false);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'dismissed', pageIndex: 0 })
    );
    await act(async () => {
      current().onHidden?.();
    });
    await tick(1000);
    expect(requestReview).not.toHaveBeenCalled();
    // A second call with nothing showing is a no-op.
    await act(async () => {
      ref.current?.dismiss();
    });
    expect(events.filter((e) => e.type === 'dismissed')).toHaveLength(1);
  });

  it('never asks after a manual show', async () => {
    const { requestReview, ref } = await mount({}, '1.2.0');
    expect(current().visible).toBe(false);
    let opened: boolean | undefined;
    await act(async () => {
      opened = ref.current?.show('1.2.0');
    });
    expect(opened).toBe(true);
    expect(current().visible).toBe(true);
    await closeAndHide('done');
    await tick(1000);
    expect(requestReview).not.toHaveBeenCalled();
  });

  it('swallows a requestReview that throws or rejects', async () => {
    const throwing = jest.fn(() => {
      throw new Error('no store');
    });
    const first = await mount({ requestReview: throwing });
    await closeAndHide('done');
    await tick(400);
    expect(throwing).toHaveBeenCalledTimes(1);
    await first.view.unmount();

    const rejecting = jest.fn(() => Promise.reject(new Error('no store')));
    await mount({ requestReview: rejecting });
    await closeAndHide('done');
    await tick(400);
    expect(rejecting).toHaveBeenCalledTimes(1);
    await tick();
  });

  it('clears a pending review on unmount', async () => {
    const { view, requestReview } = await mount();
    await closeAndHide('done');
    await view.unmount();
    await tick(1000);
    expect(requestReview).not.toHaveBeenCalled();
  });
});
