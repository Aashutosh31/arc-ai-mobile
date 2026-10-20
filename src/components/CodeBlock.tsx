import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HorizontalScrollBox } from '@/components/HorizontalScrollBox';
import { highlight, normalizeLang, syntaxPalette, tokenColor } from '@/lib/highlight';
import { useTheme } from '@/store/themeStore';
import { FontSize, Spacing } from '@/theme/layout';

/**
 * A code block styled like the web client's `MarkdownRenderer`: a header strip
 * with the language label and a Copy button, plus syntax-highlighted body.
 */
export function CodeBlock({ code, language }: { code: string; language?: string | null }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const lang = normalizeLang(language);
  const palette = syntaxPalette(theme);
  const lines = highlight(code, lang);

  const onCopy = async () => {
    await Clipboard.setStringAsync(code).catch(() => {});
    Haptics.selectionAsync().catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderRadius: theme.radii.md }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.langRow}>
          <Ionicons name="code-slash-outline" size={12} color={theme.foregroundMuted} />
          <Text style={[styles.lang, { color: theme.foregroundMuted }]}>{lang === 'text' ? 'code' : lang}</Text>
        </View>
        <Pressable onPress={onCopy} hitSlop={8} accessibilityRole="button" accessibilityLabel="Copy code">
          <View style={styles.copyRow}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={13} color={copied ? theme.success : theme.foregroundMuted} />
            <Text style={[styles.copy, { color: copied ? theme.success : theme.foregroundMuted }]}>{copied ? 'Copied' : 'Copy'}</Text>
          </View>
        </Pressable>
      </View>

      <HorizontalScrollBox>
        <View style={styles.body}>
          {lines.map((line, i) => (
            <Text key={i} style={[styles.line, { fontFamily: 'monospace' }]} selectable>
              {line.tokens.length === 0 ? (
                <Text style={{ fontFamily: 'monospace' }}>{' '}</Text>
              ) : (
                line.tokens.map((tok, j) => (
                  <Text key={j} style={[styles.token, { color: tokenColor(tok.type, palette), fontFamily: 'monospace' }]}>
                    {tok.text}
                  </Text>
                ))
              )}
            </Text>
          ))}
        </View>
      </HorizontalScrollBox>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lang: { fontSize: FontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copy: { fontSize: FontSize.xs, fontWeight: '600' },
  body: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  line: { fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.55 },
  token: { fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.55 },
});
