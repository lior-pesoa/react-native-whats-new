import { act, renderHook, waitFor } from '@testing-library/react-native';
import { SEEN_KEY } from '../core';
import { markWhatsNewSeen, readSeen, resetWhatsNew } from '../storage';
import type { WhatsNewEvent } from '../types';
import { useWhatsNew, type UseWhatsNewOptions } from '../useWhatsNew';
import { flush, memoryStorage, notes } from './helpers';

async function setup(
  props: Partial<UseWhatsNewOptions> & Pick<UseWhatsNewOptions, 'storage'>
) {
  const events: WhatsNewEvent[] = [];
  const initialProps: UseWhatsNewOptions = {
    notes,
    currentVersion: '1.2.0',
    onEvent: (e) => events.push(e),
    ...props,
  };
  const hook = await renderHook((p: UseWhatsNewOptions) => useWhatsNew(p), {
    initialProps,
  });
  return { ...hook, events, initialProps };
}

describe('useWhatsNew', () => {
  it('stays hidden on first install and remembers the version', async () => {
    const { storage, seen } = memoryStorage();
    const { result, events } = await setup({ storage });
    await waitFor(() => expect(seen()).toBe('1.2.0'));
    expect(result.current.visible).toBe(false);
    expect(events.filter((e) => e.type === 'shown')).toHaveLength(0);
  });

  it('shows once on update and marks seen on close', async () => {
    const { storage, seen } = memoryStorage('1.1.0');
    const { result, events, rerender, initialProps } = await setup({
      storage,
    });
    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(result.current.release?.version).toBe('1.2.0');
    expect(result.current.manual).toBe(false);
    await rerender({ ...initialProps });
    await act(flush);
    expect(events).toEqual([
      { type: 'shown', version: '1.2.0', pageCount: 3, manual: false },
    ]);
    expect(seen()).toBe('1.1.0');

    await act(async () => result.current.close('done', 2));
    await act(flush);
    expect(result.current.visible).toBe(false);
    expect(result.current.release?.version).toBe('1.2.0');
    expect(seen()).toBe('1.2.0');
    expect(events[1]).toEqual({
      type: 'done',
      version: '1.2.0',
      pageIndex: 2,
      pageCount: 3,
    });

    await rerender({ ...initialProps });
    await act(flush);
    expect(result.current.visible).toBe(false);
  });

  it('respects when(): false leaves storage alone, a throw counts as false', async () => {
    const a = memoryStorage('1.1.0');
    const when = jest.fn(() => Promise.resolve(false));
    const first = await setup({ storage: a.storage, when });
    await act(flush);
    await waitFor(() => expect(when).toHaveBeenCalled());
    expect(first.result.current.visible).toBe(false);
    expect(a.storage.setItem).not.toHaveBeenCalled();
    expect(a.seen()).toBe('1.1.0');

    const b = memoryStorage('1.1.0');
    const second = await setup({
      storage: b.storage,
      when: () => {
        throw new Error('nope');
      },
    });
    await act(flush);
    expect(second.result.current.visible).toBe(false);
    expect(b.seen()).toBe('1.1.0');
  });

  it('waits while disabled and evaluates when enabled', async () => {
    const { storage } = memoryStorage('1.1.0');
    const { result, rerender, initialProps } = await setup({
      storage,
      enabled: false,
    });
    await act(flush);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(result.current.visible).toBe(false);

    await rerender({ ...initialProps, enabled: true });
    await waitFor(() => expect(result.current.visible).toBe(true));
  });

  it('waits for a known version', async () => {
    const { storage } = memoryStorage('1.1.0');
    const { result, rerender, initialProps } = await setup({
      storage,
      currentVersion: undefined,
    });
    await act(flush);
    expect(storage.getItem).not.toHaveBeenCalled();

    await rerender({ ...initialProps, currentVersion: '1.2.0' });
    await waitFor(() => expect(result.current.visible).toBe(true));
  });

  it('waits while notes are loading (null) and stores nothing', async () => {
    const { storage, seen } = memoryStorage('1.1.0');
    const { result, rerender, initialProps } = await setup({
      storage,
      notes: null,
    });
    await act(flush);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(seen()).toBe('1.1.0');

    await rerender({ ...initialProps, notes });
    await waitFor(() => expect(result.current.visible).toBe(true));
  });

  it('treats an empty notes array as an answer: stores the version', async () => {
    const { storage, seen } = memoryStorage('1.1.0');
    const { result } = await setup({ storage, notes: [] });
    await waitFor(() => expect(seen()).toBe('1.2.0'));
    expect(result.current.visible).toBe(false);
  });

  it('does nothing when storage cannot be read', async () => {
    const storage = {
      getItem: jest.fn(() => Promise.reject(new Error('disk'))),
      setItem: jest.fn(async () => {}),
    };
    const { result } = await setup({ storage });
    await act(flush);
    await waitFor(() => expect(storage.getItem).toHaveBeenCalled());
    expect(result.current.visible).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('opens notes on demand without touching storage', async () => {
    const { storage, seen } = memoryStorage('1.2.0');
    const { result, events } = await setup({ storage });
    await act(flush);
    expect(result.current.visible).toBe(false);

    let opened = false;
    await act(async () => {
      opened = result.current.show('1.2.0');
    });
    expect(opened).toBe(true);
    expect(result.current.visible).toBe(true);
    expect(result.current.manual).toBe(true);
    expect(events).toContainEqual({
      type: 'shown',
      version: '1.2.0',
      pageCount: 3,
      manual: true,
    });

    await act(async () => result.current.close('dismissed', 0));
    await act(flush);
    expect(result.current.visible).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(seen()).toBe('1.2.0');

    await act(async () => {
      opened = result.current.show('9.9.9');
    });
    expect(opened).toBe(false);
    expect(result.current.visible).toBe(false);
  });

  it('survives an onEvent that throws', async () => {
    const { storage } = memoryStorage('1.1.0');
    const { result } = await setup({
      storage,
      onEvent: () => {
        throw new Error('analytics down');
      },
    });
    await waitFor(() => expect(result.current.visible).toBe(true));
    await act(async () => result.current.close('done', 0));
    expect(result.current.visible).toBe(false);
  });

  it('reset brings back the first-install path; mark writes the version', async () => {
    const { storage, seen } = memoryStorage('1.1.0');
    await resetWhatsNew(storage);
    expect(storage.setItem).toHaveBeenCalledWith(SEEN_KEY, '');
    expect(await readSeen(storage)).toBeNull();

    const { result } = await setup({ storage });
    await waitFor(() => expect(seen()).toBe('1.2.0'));
    expect(result.current.visible).toBe(false);

    await markWhatsNewSeen(storage, '2.0.0');
    expect(seen()).toBe('2.0.0');
    expect(await readSeen(storage)).toBe('2.0.0');
  });
});
