import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ThemedText } from '@/components/ui';
import { isValidYouTubeId } from '@/lib/media';
import { useChatStore } from '@/store/chatStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

/**
 * Plays media requested by the `playMedia` tool. YouTube ids embed inline
 * (mirroring the web client's MediaPlayer); anything else falls back to a
 * link-out card.
 */
export function MediaCard() {
  const theme = useTheme();
  const media = useChatStore((s) => s.media);
  const setMedia = useChatStore((s) => s.setMedia);
  const { width } = useWindowDimensions();
  const [playing, setPlaying] = useState(false);

  if (!media) return null;

  const isYouTube = isValidYouTubeId(media.videoId);
  const open = () => {
    void Linking.openURL(
      isYouTube ? `https://www.youtube.com/watch?v=${media.videoId}` : media.videoId,
    );
  };

  if (!isYouTube) {
    return (
      <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <Ionicons name="play-circle" size={28} color={theme.primary} />
        <View style={{ flex: 1 }}>
          <ThemedText variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
            {media.title}
          </ThemedText>
          <ThemedText variant="caption">Media requested by ARC-AI</ThemedText>
        </View>
        <Pressable onPress={open} style={[styles.btn, { borderColor: theme.primary }]}>
          <ThemedText variant="caption" color={theme.primary}>
            Open
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => setMedia(null)} hitSlop={8}>
          <Ionicons name="close" size={18} color={theme.foregroundMuted} />
        </Pressable>
      </View>
    );
  }

  const playerWidth = Math.min(width - Spacing.lg * 2, 480);

  return (
    <View
      style={[
        styles.player,
        { borderColor: theme.border, backgroundColor: theme.surface, width: playerWidth },
      ]}>
      <View style={styles.header}>
        <Ionicons name="musical-notes" size={16} color={theme.primary} />
        <ThemedText variant="caption" numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>
          {media.title}
        </ThemedText>
        <Pressable onPress={open} hitSlop={8}>
          <Ionicons name="open-outline" size={16} color={theme.foregroundMuted} />
        </Pressable>
        <Pressable onPress={() => setMedia(null)} hitSlop={8}>
          <Ionicons name="close" size={18} color={theme.foregroundMuted} />
        </Pressable>
      </View>

      <View style={[styles.videoBox, { backgroundColor: '#000' }]}>
        <WebView
          style={styles.webview}
          originWhitelist={['*']}
          source={{
            uri: `https://www.youtube.com/embed/${media.videoId}?autoplay=${playing ? 1 : 0}&playsinline=1&rel=0`,
          }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          onShouldStartLoadWithRequest={(req) =>
            req.url.startsWith('https://www.youtube.com/embed/') ||
            req.url.startsWith('about:')
          }
        />
        {!playing ? (
          <Pressable style={styles.overlay} onPress={() => setPlaying(true)}>
            <Ionicons name="play" size={30} color="#fff" />
            <ThemedText variant="caption" style={{ color: '#fff' }}>
              Tap to play
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.md,
  },
  player: {
    alignSelf: 'center',
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  videoBox: { width: '100%', aspectRatio: 16 / 9 },
  webview: { flex: 1, backgroundColor: '#000' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  btn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
});
