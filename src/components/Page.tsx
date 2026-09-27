import { isValidElement, type ReactNode } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type TextStyle,
} from 'react-native';
import type {
  WhatsNewListRow,
  WhatsNewPage,
  WhatsNewSource,
  WhatsNewTheme,
} from '../types';

export type RenderVideo = (
  source: WhatsNewSource,
  page: Extract<WhatsNewPage, { type: 'media' }>
) => ReactNode;

/** Titles get a bold default only when the app didn't pick a title font. */
export function titleFont(theme: WhatsNewTheme): TextStyle {
  return theme.fonts.title
    ? { fontFamily: theme.fonts.title }
    : { fontWeight: '700' };
}

export function bodyFont(theme: WhatsNewTheme): TextStyle {
  return theme.fonts.body ? { fontFamily: theme.fonts.body } : {};
}

function RowIcon({ icon }: { icon: WhatsNewListRow['icon'] }) {
  if (icon === undefined || icon === null) return null;
  if (isValidElement(icon)) return <View style={styles.icon}>{icon}</View>;
  if (typeof icon === 'number' || typeof icon === 'object') {
    return (
      <Image
        source={icon as ImageSourcePropType}
        style={styles.icon}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return null;
}

function ListPage({
  page,
  theme,
}: {
  page: Extract<WhatsNewPage, { type: 'list' }>;
  theme: WhatsNewTheme;
}) {
  return (
    <>
      <Text
        accessibilityRole="header"
        style={[styles.pageTitle, titleFont(theme), { color: theme.text }]}
      >
        {page.title}
      </Text>
      {page.rows.map((row, i) => (
        <View key={i} style={styles.row}>
          <RowIcon icon={row.icon} />
          <View style={styles.rowText}>
            <Text
              style={[styles.rowTitle, titleFont(theme), { color: theme.text }]}
            >
              {row.title}
            </Text>
            {row.description ? (
              <Text
                style={[
                  styles.body,
                  bodyFont(theme),
                  { color: theme.secondaryText },
                ]}
              >
                {row.description}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </>
  );
}

function MediaPage({
  page,
  theme,
  renderVideo,
}: {
  page: Extract<WhatsNewPage, { type: 'media' }>;
  theme: WhatsNewTheme;
  renderVideo?: RenderVideo;
}) {
  let media: ReactNode = null;
  if (page.kind === 'image') {
    media = (
      <Image
        source={page.source}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  } else if (renderVideo) {
    media = renderVideo(page.source, page);
  } else if (page.poster !== undefined) {
    media = (
      <Image
        source={page.poster}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <>
      <View
        style={[
          styles.media,
          {
            borderRadius: Math.round(theme.radius * 0.6),
            backgroundColor: theme.dot,
          },
        ]}
      >
        {media}
      </View>
      {page.title ? (
        <Text
          accessibilityRole="header"
          style={[styles.mediaTitle, titleFont(theme), { color: theme.text }]}
        >
          {page.title}
        </Text>
      ) : null}
      {page.description ? (
        <Text
          style={[
            styles.body,
            styles.centered,
            bodyFont(theme),
            { color: theme.secondaryText },
          ]}
        >
          {page.description}
        </Text>
      ) : null}
    </>
  );
}

export function Page({
  page,
  width,
  theme,
  renderVideo,
}: {
  page: WhatsNewPage;
  width: number;
  theme: WhatsNewTheme;
  renderVideo?: RenderVideo;
}) {
  let content: ReactNode;
  switch (page.type) {
    case 'list':
      content = <ListPage page={page} theme={theme} />;
      break;
    case 'media':
      content = (
        <MediaPage page={page} theme={theme} renderVideo={renderVideo} />
      );
      break;
    case 'custom':
      content = page.render();
      break;
  }
  // Each page scrolls on its own, so long notes never push the button away.
  return (
    <View style={{ width }}>
      <ScrollView
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {content}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  icon: {
    width: 28,
    height: 28,
    marginEnd: 16,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 2,
  },
  centered: {
    textAlign: 'center',
  },
  media: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
  },
  mediaTitle: {
    fontSize: 24,
    lineHeight: 30,
    marginTop: 20,
    textAlign: 'center',
  },
});
