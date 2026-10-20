import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { useTheme } from '@/store/themeStore';

const EPSILON = 1;

/**
 * A horizontal scroller with page arrows, used for wide content (code blocks and
 * tables) inside chat bubbles. Swipe-to-scroll works as usual; when the content
 * is wider than the viewport, chevron buttons appear on the edges so the user
 * can page through it without a precise drag.
 */
export function HorizontalScrollBox({
  children,
  style,
  contentContainerStyle,
  onViewportWidth,
}: {
  children: React.ReactNode;
  style?: object;
  contentContainerStyle?: object;
  onViewportWidth?: (width: number) => void;
}) {
  const theme = useTheme();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);

  const overflow = content > viewport + EPSILON;
  const maxOffset = Math.max(0, content - viewport);
  const canLeft = overflow && offset > EPSILON;
  const canRight = overflow && offset < maxOffset - EPSILON;

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setViewport(width);
    onViewportWidth?.(width);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setOffset(e.nativeEvent.contentOffset.x);
  };

  const scrollBy = (direction: -1 | 1) => {
    const page = Math.max(viewport * 0.8, 120);
    const next = Math.min(Math.max(offset + direction * page, 0), maxOffset);
    scrollRef.current?.scrollTo({ x: next, animated: true });
  };

  return (
    <View style={[styles.wrap, style]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={onLayout}
        onContentSizeChange={(w) => setContent(w)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={contentContainerStyle}>
        {children}
      </ScrollView>

      {overflow ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <ArrowSlot side="left" visible={canLeft} theme={theme} onPress={() => scrollBy(-1)} />
          <ArrowSlot side="right" visible={canRight} theme={theme} onPress={() => scrollBy(1)} />
        </View>
      ) : null}
    </View>
  );
}

function ArrowSlot({
  side,
  visible,
  theme,
  onPress,
}: {
  side: 'left' | 'right';
  visible: boolean;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={[styles.arrowSlot, side === 'left' ? { left: 4 } : { right: 4 }]}>
      <Pressable
        onPress={onPress}
        disabled={!visible}
        pointerEvents={visible ? 'auto' : 'none'}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={side === 'left' ? 'Scroll left' : 'Scroll right'}
        style={({ pressed }) => [
          styles.arrowBtn,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            opacity: visible ? (pressed ? 0.7 : 1) : 0,
          },
        ]}>
        <Ionicons
          name={side === 'left' ? 'chevron-back' : 'chevron-forward'}
          size={16}
          color={theme.foregroundMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  arrowSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  arrowBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
