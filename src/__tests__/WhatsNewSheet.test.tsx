import { Animated, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { WhatsNewRelease } from '../types';
import { WhatsNewSheet } from '../WhatsNewSheet';

const release: WhatsNewRelease = {
  version: '1.2.0',
  pages: [
    {
      type: 'list',
      title: 'Fresh in 1.2',
      rows: [
        { title: 'Faster', description: 'Everything opens quicker.' },
        { title: 'Custom icon', icon: <Text>*</Text> },
      ],
    },
    { type: 'custom', render: () => <Text>Custom page</Text> },
  ],
};

async function layout() {
  await act(async () => {
    fireEvent(screen.getByTestId('whats-new-sheet'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 500 } },
    });
  });
}

describe('WhatsNewSheet', () => {
  it('renders pages and walks to done', async () => {
    const onClose = jest.fn();
    const onPageChange = jest.fn();
    await render(
      <WhatsNewSheet
        release={release}
        visible
        onClose={onClose}
        onPageChange={onPageChange}
      />
    );
    await layout();
    expect(screen.getByText('Fresh in 1.2')).toBeTruthy();
    expect(screen.getByText('Everything opens quicker.')).toBeTruthy();
    expect(screen.getByLabelText('Page 1 of 2')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    });
    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(screen.getByLabelText('Page 2 of 2')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    });
    expect(onClose).toHaveBeenCalledWith('done', 1);
  });

  it('dismisses from the backdrop with custom labels, hides dots for one page', async () => {
    const onClose = jest.fn();
    await render(
      <WhatsNewSheet
        release={{ version: '1', pages: [release.pages[0]!] }}
        visible
        onClose={onClose}
        labels={{ done: 'Nice', close: 'Dismiss' }}
        theme={{ accent: '#ff0000', fonts: { title: 'Serif' } }}
      />
    );
    await layout();
    expect(screen.queryByLabelText('Page 1 of 1')).toBeNull();
    expect(screen.getByRole('button', { name: 'Nice' })).toBeTruthy();
    // Hidden from screen readers by accessibilityViewIsModal, still tappable.
    await act(async () => {
      fireEvent.press(
        screen.getByTestId('whats-new-backdrop', {
          includeHiddenElements: true,
        })
      );
    });
    expect(onClose).toHaveBeenCalledWith('dismissed', 0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('unmounts the modal after closing, even if the animation never reports back', async () => {
    jest.useFakeTimers();
    // An out-animation whose callback never fires — the stuck-app case.
    const timing = jest.spyOn(Animated, 'timing').mockImplementation(
      () =>
        ({
          start: () => {},
          stop: () => {},
          reset: () => {},
        }) as unknown as Animated.CompositeAnimation
    );
    try {
      const onHidden = jest.fn();
      const props = { release, onClose: jest.fn(), onHidden };
      const view = await render(<WhatsNewSheet {...props} visible />);
      const sheet = () =>
        screen.queryByTestId('whats-new-sheet', {
          includeHiddenElements: true,
        });
      expect(sheet()).not.toBeNull();

      await view.rerender(<WhatsNewSheet {...props} visible={false} />);
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      // RN's Modal renders nothing once `visible` is false.
      expect(sheet()).toBeNull();
      expect(onHidden).toHaveBeenCalledTimes(1);
    } finally {
      timing.mockRestore();
      jest.useRealTimers();
    }
  });

  it('lets screen readers close through the grab handle', async () => {
    const onClose = jest.fn();
    await render(<WhatsNewSheet release={release} visible onClose={onClose} />);
    const handle = screen.getByRole('button', { name: 'Close' });
    // Called directly: fireEvent treats the idle pan responder as "disabled".
    await act(async () => {
      handle.props.onAccessibilityAction({
        nativeEvent: { actionName: 'activate' },
      });
    });
    expect(onClose).toHaveBeenCalledWith('dismissed', 0);
  });

  it('renders nothing visible without a release', async () => {
    await render(
      <WhatsNewSheet release={null} visible={false} onClose={jest.fn()} />
    );
    expect(screen.queryByText('Got it')).toBeNull();
  });
});
