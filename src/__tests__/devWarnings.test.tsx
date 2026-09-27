import { act, renderHook } from '@testing-library/react-native';
import type { WhatsNewStorage } from '../types';
import { useWhatsNew, type UseWhatsNewOptions } from '../useWhatsNew';
import { flush, memoryStorage, notes } from './helpers';

let warn: jest.SpyInstance;

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

async function mount(props: Partial<UseWhatsNewOptions>) {
  const initialProps: UseWhatsNewOptions = {
    notes,
    currentVersion: '1.2.0',
    storage: memoryStorage('1.1.0').storage,
    ...props,
  };
  const hook = await renderHook((p: UseWhatsNewOptions) => useWhatsNew(p), {
    initialProps,
  });
  await act(flush);
  return { ...hook, initialProps };
}

const messages = () => warn.mock.calls.map((call) => String(call[0]));

describe('dev warnings', () => {
  it('stays quiet for a correct setup, even without notes for this version', async () => {
    await mount({});
    await mount({ currentVersion: '3.0.0' });
    await mount({ currentVersion: '1.2.0-beta+7' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when storage is not getItem/setItem shaped, with the MMKV adapter hint', async () => {
    const mmkvLike = {
      getString: () => undefined,
      set: () => {},
    } as unknown as WhatsNewStorage;
    await mount({ storage: mmkvLike });
    expect(messages()).toHaveLength(1);
    expect(messages()[0]).toMatch(/^\[react-native-whats-new\] `storage`/);
    expect(messages()[0]).toContain('mmkv.getString(k) ?? null');
  });

  it('warns when currentVersion is not a version', async () => {
    await mount({ currentVersion: 'build 42' });
    expect(messages()).toHaveLength(1);
    expect(messages()[0]).toMatch(
      /^\[react-native-whats-new\] `currentVersion`/
    );
    expect(messages()[0]).toContain('"1.2.0"');
  });

  it('warns when currentVersion looks like a build number', async () => {
    await mount({ currentVersion: '42' });
    expect(messages()).toHaveLength(1);
    expect(messages()[0]).toContain('looks like a build number');
  });

  it('does not warn while currentVersion is still unknown', async () => {
    await mount({ currentVersion: null });
    await mount({ currentVersion: undefined });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns about duplicate versions in notes, treating 1.2 and 1.2.0 as one', async () => {
    const page = { type: 'list' as const, title: 'x', rows: [] };
    await mount({
      notes: [
        { version: '1.2', pages: [page] },
        { version: '1.2.0', pages: [page] },
        { version: '1.3.0', pages: [page] },
      ],
    });
    expect(messages()).toHaveLength(1);
    expect(messages()[0]).toMatch(/^\[react-native-whats-new\] `notes`/);
    expect(messages()[0]).toContain('"1.2.0"');
  });

  it('fires each warning once per mount', async () => {
    const { rerender, initialProps } = await mount({ currentVersion: '42' });
    await rerender({ ...initialProps, currentVersion: '43' });
    await act(flush);
    await rerender({ ...initialProps, currentVersion: 'nope' });
    await act(flush);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
