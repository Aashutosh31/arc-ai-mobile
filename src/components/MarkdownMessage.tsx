import { StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { useTheme } from '@/store/themeStore';
import { FontSize, Spacing } from '@/theme/layout';

export function MarkdownMessage({ content }: { content: string }) {
  const theme = useTheme();

  return (
    <Markdown
      style={{
        body: { color: theme.foreground, fontSize: FontSize.md, lineHeight: FontSize.md * 1.5 },
        paragraph: { marginTop: 0, marginBottom: Spacing.sm, flexWrap: 'wrap' },
        heading1: { color: theme.foreground, fontSize: FontSize.xl, marginBottom: Spacing.sm },
        heading2: { color: theme.foreground, fontSize: FontSize.lg, marginBottom: Spacing.sm },
        heading3: { color: theme.foreground, fontSize: FontSize.md, marginBottom: Spacing.xs },
        strong: { fontWeight: '700', color: theme.foreground },
        em: { fontStyle: 'italic' },
        link: { color: theme.primary },
        blockquote: {
          backgroundColor: theme.surfaceElevated,
          borderLeftColor: theme.accent,
          borderLeftWidth: 3,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
          marginVertical: Spacing.xs,
        },
        code_inline: {
          color: theme.accentSoft,
          backgroundColor: theme.surfaceElevated,
          fontFamily: 'monospace',
          fontSize: FontSize.sm,
          paddingHorizontal: 4,
          borderRadius: 4,
        },
        code_block: {
          color: theme.foreground,
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: theme.radii.md,
          padding: Spacing.md,
          fontFamily: 'monospace',
          fontSize: FontSize.sm,
        },
        fence: {
          color: theme.foreground,
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: theme.radii.md,
          padding: Spacing.md,
          fontFamily: 'monospace',
          fontSize: FontSize.sm,
        },
        bullet_list: { marginVertical: Spacing.xs },
        ordered_list: { marginVertical: Spacing.xs },
        list_item: { marginVertical: 2 },
        hr: { backgroundColor: theme.border, height: StyleSheet.hairlineWidth, marginVertical: Spacing.md },
        table: { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: theme.radii.sm },
        th: { backgroundColor: theme.surfaceElevated, color: theme.foreground, padding: Spacing.sm },
        td: { color: theme.foreground, padding: Spacing.sm },
      }}>
      {content || ''}
    </Markdown>
  );
}
