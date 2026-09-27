import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ListRenderItem,
  type ModalProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Page, titleFont, type RenderVideo } from './components/Page';
import {
  darkTheme,
  defaultTheme,
  mergeLabels,
  mergeTheme,
  type WhatsNewThemeInput,
} from './theme';
import type {
  WhatsNewLabels,
  WhatsNewPage,
  WhatsNewRelease,
  WhatsNewTheme,
} from './types';

export type WhatsNewCloseVia = 'done' | 'dismissed';

export type WhatsNewSheetProps = {
  release: WhatsNewRelease | null;
  visible: boolean;
  onClose: (via: WhatsNewCloseVia, pageIndex: number) => void;
  onPageChange?: (pageIndex: number) => void;
  /** After the out-animation ends (unlike Modal's onDismiss, on both OSes). */
  onHidden?: () => void;
  /** Merged over the light or dark default, whichever the device uses. */
  theme?: WhatsNewThemeInput;
  labels?: Partial<WhatsNewLabels>;
  /** Default 'standard': content-sized, at most 75% of the window. */
  sheetHeight?: 'standard' | 'full';
  /** Render a video page yourself (expo-video, react-native-video). */
  renderVideo?: RenderVideo;
  /** Pass useSafeAreaInsets(). The sheet adds its own 24px on top. */
  insets?: { top: number; bottom: number };
};

const IN_MS = 280;
const OUT_MS = 220;
const DISMISS_DRAG = 80;
const DISMISS_VELOCITY = 1.2;
const NO_INSETS = { top: 0, bottom: 0 };
// Modal defaults to portrait-only on iOS, which would rotate iPads.
const ORIENTATIONS: NonNullable<ModalProps['supportedOrientations']> = [
  'portrait',
  'portrait-upside-down',
  'landscape',
  'landscape-left',
  'landscape-right',
];

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduce(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduce
    );
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

export function WhatsNewSheet({
  release,
  visible,
  onClose,
  onPageChange,
  onHidden,
  theme: themeInput,
  labels: labelsInput,
  sheetHeight = 'standard',
  renderVideo,
  insets = NO_INSETS,
}: WhatsNewSheetProps) {
  const scheme = useColorScheme();
  const theme = useMemo(
    () => mergeTheme(scheme === 'dark' ? darkTheme : defaultTheme, themeInput),
    [scheme, themeInput]
  );
  const labels = useMemo(() => mergeLabels(labelsInput), [labelsInput]);
  const window = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const shown = visible && release !== null && release.pages.length > 0;
  // Read by the close path, which may finish after a later render re-opened it.
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const [mounted, setMounted] = useState(shown);
  const mountedRef = useRef(shown);
  // Keeps the last release on screen while the sheet animates out.
  const [held, setHeld] = useState<WhatsNewRelease | null>(
    shown ? release : null
  );
  const [showId, setShowId] = useState(0);
  const [index, setIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);

  const progress = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<WhatsNewPage>>(null);
  const indexRef = useRef(0);
  const closingRef = useRef(false);

  const latest = useRef({ onClose, onPageChange, onHidden });
  useEffect(() => {
    latest.current = { onClose, onPageChange, onHidden };
  });

  useEffect(() => {
    if (shown) {
      closingRef.current = false;
      indexRef.current = 0;
      dragY.setValue(0);
      setHeld(release);
      setIndex(0);
      setShowId((n) => n + 1);
      mountedRef.current = true;
      setMounted(true);
      const anim = Animated.timing(progress, {
        toValue: 1,
        duration: IN_MS,
        useNativeDriver: true,
      });
      anim.start();
      return () => anim.stop();
    }
    // The Modal MUST go away once closed: a transparent Modal left mounted
    // swallows every touch in the app. So unmount when the animation ends
    // for any reason (interrupted included), with a timer as a backstop in
    // case the animation never reports back.
    let hidden = false;
    const hide = () => {
      if (hidden || shownRef.current || !mountedRef.current) return;
      hidden = true;
      mountedRef.current = false;
      setMounted(false);
      latest.current.onHidden?.();
    };
    const anim = Animated.timing(progress, {
      toValue: 0,
      duration: OUT_MS,
      useNativeDriver: true,
    });
    anim.start(hide);
    const backstop = setTimeout(hide, OUT_MS + 300);
    return () => {
      clearTimeout(backstop);
      anim.stop();
      hide();
    };
  }, [shown, release, progress, dragY]);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    latest.current.onClose('dismissed', indexRef.current);
  }, []);

  const setPage = useCallback((next: number) => {
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
    latest.current.onPageChange?.(next);
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > DISMISS_DRAG || g.vy > DISMISS_VELOCITY) {
            dismiss();
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [dragY, dismiss]
  );

  const pages = held?.pages ?? [];
  const count = pages.length;
  const isLast = index >= count - 1;

  const onPrimary = () => {
    if (closingRef.current) return;
    if (!isLast) {
      const next = index + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      // iOS fires no momentum event for programmatic scrolls.
      setPage(next);
      return;
    }
    closingRef.current = true;
    latest.current.onClose('done', indexRef.current);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setPage(Math.max(0, Math.min(count - 1, next)));
  };

  const onSheetLayout = (e: LayoutChangeEvent) => {
    const width = Math.round(e.nativeEvent.layout.width);
    if (width !== pageWidth) setPageWidth(width);
  };

  const renderItem: ListRenderItem<WhatsNewPage> = ({ item }) => (
    <Page
      page={item}
      width={pageWidth}
      theme={theme}
      renderVideo={renderVideo}
    />
  );

  const slide = reduceMotion
    ? 0
    : progress.interpolate({
        inputRange: [0, 1],
        outputRange: [window.height, 0],
      });
  const translateY = Animated.add(slide, dragY);
  // Reduce motion: the sheet fades in place instead of sliding.
  const motion = {
    opacity: reduceMotion ? progress : 1,
    transform: [{ translateY }],
  };
  const sheetSize =
    sheetHeight === 'full'
      ? { height: window.height - insets.top - 12 }
      : { maxHeight: window.height * 0.75 };

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={ORIENTATIONS}
      onRequestClose={dismiss}
    >
      <View style={styles.root}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.backdrop, opacity: progress },
          ]}
        >
          <Pressable
            testID="whats-new-backdrop"
            style={StyleSheet.absoluteFill}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel={labels.close}
          />
        </Animated.View>

        <Animated.View
          testID="whats-new-sheet"
          accessibilityViewIsModal
          onAccessibilityEscape={dismiss}
          onLayout={onSheetLayout}
          style={[
            styles.sheet,
            sheetSize,
            {
              backgroundColor: theme.background,
              borderTopLeftRadius: theme.radius,
              borderTopRightRadius: theme.radius,
              paddingBottom: insets.bottom + 24,
            },
            motion,
          ]}
        >
          <View
            {...pan.panHandlers}
            style={styles.handleArea}
            accessible
            accessibilityRole="button"
            accessibilityLabel={labels.close}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={dismiss}
          >
            <View style={[styles.handle, { backgroundColor: theme.dot }]} />
          </View>

          {pageWidth > 0 && held ? (
            <FlatList
              key={showId}
              ref={listRef}
              style={sheetHeight === 'full' ? styles.fill : styles.shrink}
              data={pages}
              renderItem={renderItem}
              keyExtractor={(_, i) => String(i)}
              horizontal
              pagingEnabled
              bounces={false}
              showsHorizontalScrollIndicator={false}
              initialNumToRender={count}
              windowSize={count * 2 + 1}
              getItemLayout={(_, i) => ({
                length: pageWidth,
                offset: pageWidth * i,
                index: i,
              })}
              onMomentumScrollEnd={onMomentumScrollEnd}
            />
          ) : null}

          <View style={styles.footer}>
            {count > 1 ? (
              <View
                style={styles.dots}
                accessible
                accessibilityLabel={labels.page(index + 1, count)}
              >
                {pages.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: i === index ? theme.accent : theme.dot,
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}
            <Pressable
              onPress={onPrimary}
              accessibilityRole="button"
              accessibilityLabel={isLast ? labels.done : labels.next}
              android_ripple={{ color: 'rgba(255, 255, 255, 0.2)' }}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: theme.accent,
                  opacity: pressed && Platform.OS === 'ios' ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.buttonText,
                  buttonFont(theme),
                  { color: theme.onAccent },
                ]}
              >
                {isLast ? labels.done : labels.next}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function buttonFont(theme: WhatsNewTheme) {
  return theme.fonts.button
    ? { fontFamily: theme.fonts.button }
    : titleFont(theme);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  handleArea: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  fill: {
    flex: 1,
  },
  shrink: {
    flexGrow: 0,
    flexShrink: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  button: {
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
  },
});
