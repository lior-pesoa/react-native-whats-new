import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WhatsNew,
  resetWhatsNew,
  type WhatsNewEvent,
  type WhatsNewHandle,
  type WhatsNewRelease,
  type WhatsNewSource,
} from 'react-native-whats-new';

const SIMULATED_VERSIONS = ['1.0.0', '1.1.0', '1.2.0'] as const;
type SimulatedVersion = (typeof SIMULATED_VERSIONS)[number];

const notes: WhatsNewRelease[] = [
  {
    version: '1.1.0',
    pages: [
      {
        type: 'list',
        title: "what's new",
        rows: [
          {
            icon: '🔍',
            title: 'Faster search',
            description: 'Results now update as you type.',
          },
          {
            icon: '🔔',
            title: 'Smarter notifications',
            description: 'Grouped by conversation, not by minute.',
          },
        ],
      },
    ],
  },
  {
    version: '1.2.0',
    pages: [
      {
        type: 'list',
        title: "what's new in 1.2",
        rows: [
          {
            icon: '🌙',
            title: 'Dark mode',
            description: 'Follows your system setting automatically.',
          },
          {
            icon: '📌',
            title: 'Pinned conversations',
            description: 'Keep the important ones at the top.',
          },
        ],
      },
      {
        type: 'media',
        kind: 'image',
        source: { uri: 'https://picsum.photos/seed/whats-new-1/900/1400' },
        title: 'A fresh look',
        description: 'Redesigned from the ground up for this release.',
      },
      {
        type: 'media',
        kind: 'video',
        source: {
          uri: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        },
        poster: { uri: 'https://picsum.photos/seed/whats-new-2/900/1400' },
        title: 'See it in action',
        description: 'A quick look at what changed.',
      },
    ],
  },
];

function ExampleVideoPage({ source }: { source: WhatsNewSource }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text
              style={[
                styles.segmentLabel,
                selected && styles.segmentLabelSelected,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

function ExampleApp() {
  const insets = useSafeAreaInsets();
  const whatsNew = useRef<WhatsNewHandle>(null);

  const [simulatedVersion, setSimulatedVersion] =
    useState<SimulatedVersion>('1.0.0');
  const [sheetHeight, setSheetHeight] = useState<'standard' | 'full'>(
    'standard'
  );
  const [customTheme, setCustomTheme] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [events, setEvents] = useState<WhatsNewEvent[]>([]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(
      () => setToast((current) => (current === message ? null : current)),
      2500
    );
  };

  const handleEvent = (event: WhatsNewEvent) => {
    setEvents((current) => [event, ...current].slice(0, 8));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={styles.heading}>react-native-whats-new</Text>
        <Text style={styles.subheading}>
          Simulated app version — switching this stands in for shipping an
          update.
        </Text>

        <Segmented
          options={SIMULATED_VERSIONS}
          value={simulatedVersion}
          onChange={setSimulatedVersion}
        />

        <View style={styles.row}>
          <Button
            label="Reset seen version"
            onPress={async () => {
              await resetWhatsNew(AsyncStorage);
              showToast('Seen version reset — switch versions to see it again');
            }}
          />
          <Button
            label="Show 1.2.0 again"
            onPress={() => {
              const opened = whatsNew.current?.show('1.2.0');
              if (!opened) {
                showToast('No notes for 1.2.0');
              }
            }}
          />
        </View>

        <View style={styles.row}>
          <Button
            label={`Sheet height: ${sheetHeight}`}
            onPress={() =>
              setSheetHeight((current) =>
                current === 'standard' ? 'full' : 'standard'
              )
            }
          />
          <Button
            label={`Theme: ${customTheme ? 'custom' : 'system'}`}
            onPress={() => setCustomTheme((current) => !current)}
          />
        </View>

        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Event log</Text>
        <View style={styles.log}>
          {events.length === 0 ? (
            <Text style={styles.logEmpty}>
              No events yet — switch to a version with notes.
            </Text>
          ) : (
            events.map((event, index) => (
              <Text key={index} style={styles.logLine}>
                {JSON.stringify(event)}
              </Text>
            ))
          )}
        </View>
      </ScrollView>

      <WhatsNew
        ref={whatsNew}
        notes={notes}
        currentVersion={simulatedVersion}
        storage={AsyncStorage}
        sheetHeight={sheetHeight}
        theme={
          customTheme ? { accent: '#FF5A5F', onAccent: '#FFFFFF' } : undefined
        }
        insets={{ top: insets.top, bottom: insets.bottom }}
        renderVideo={(source) => <ExampleVideoPage source={source} />}
        onEvent={handleEvent}
        requestReview={() =>
          showToast(
            'requestReview() called — the OS would show its rating prompt here'
          )
        }
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ExampleApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: '#FFFFFF',
  },
  segmentLabel: {
    fontSize: 14,
    color: '#666',
  },
  segmentLabelSelected: {
    color: '#111',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  toast: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 12,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  log: {
    gap: 6,
  },
  logEmpty: {
    fontSize: 13,
    color: '#888',
  },
  logLine: {
    fontSize: 11,
    color: '#333',
    fontFamily: 'Courier',
  },
});
