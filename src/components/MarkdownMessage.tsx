import { StyleSheet } from 'react-native';
import Markdown, { type RenderRules } from 'react-native-markdown-display';

import { CodeBlock } from '@/components/CodeBlock';
import { tableRules } from '@/components/MarkdownTable';
import { useTheme } from '@/store/themeStore';
import { FontSize, Spacing } from '@/theme/layout';

// `sourceInfo` holds the fenced language (markdown-it `token.info`) but is not
// declared on the library's ASTNode type, so read it off a cast.
type FenceNode = { key: string; content?: string; sourceInfo?: string };

/** Custom rules: fenced code → CodeBlock, tables → wide-aware scroll box. */
const rules: RenderRules = {
  fence: (node) => {
    const n = node as unknown as FenceNode;
    return <CodeBlock key={n.key} code={String(n.content ?? '').replace(/\n$/, '')} language={n.sourceInfo} />;
  },
  ...tableRules,
};

export function MarkdownMessage({ content }: { content: string }) {
  const theme = useTheme();

  return (
    <Markdown
      rules={rules}
      style={{
        body: {
          color: theme.foreground,
          fontSize: FontSize.md,
          lineHeight: FontSize.md * 1.65,
        },
        paragraph: { marginTop: 0, marginBottom: Spacing.sm, flexWrap: 'wrap' },
        heading1: {
          color: theme.foreground,
          fontSize: FontSize.xl,
          fontWeight: '700',
          marginTop: Spacing.sm,
          marginBottom: Spacing.xs,
        },
        heading2: {
          color: theme.foreground,
          fontSize: FontSize.lg,
          fontWeight: '700',
          marginTop: Spacing.sm,
          marginBottom: Spacing.xs,
        },
        heading3: {
          color: theme.foreground,
          fontSize: FontSize.md,
          fontWeight: '700',
          marginTop: Spacing.xs,
          marginBottom: Spacing.xs,
        },
        strong: { fontWeight: '700', color: theme.foreground },
        em: { fontStyle: 'italic' },
        link: { color: theme.primary, textDecorationLine: 'underline' },
        blockquote: {
          backgroundColor: theme.surfaceElevated,
          borderLeftColor: theme.accent,
          borderLeftWidth: 3,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
          marginVertical: Spacing.xs,
          borderRadius: theme.radii.sm,
        },
        code_inline: {
          color: theme.accentSoft,
          backgroundColor: theme.surfaceElevated,
          fontFamily: 'monospace',
          fontSize: FontSize.sm,
          paddingHorizontal: 4,
          paddingVertical: 1,
          borderRadius: 4,
        },
        // Indented (non-fenced) code — keep it readable but subdued.
        code_block: {
          color: theme.foreground,
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: theme.radii.md,
          padding: Spacing.md,
          fontFamily: 'monospace',
          fontSize: FontSize.sm,
          marginVertical: Spacing.sm,
        },
        bullet_list: { marginVertical: Spacing.xs },
        ordered_list: { marginVertical: Spacing.xs },
        list_item: { marginVertical: 2 },
        hr: {
          backgroundColor: theme.border,
          height: StyleSheet.hairlineWidth,
          marginVertical: Spacing.md,
        },
        table: {
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: theme.radii.sm,
          marginVertical: Spacing.sm,
        },
        th: {
          backgroundColor: theme.surfaceElevated,
          color: theme.foreground,
          padding: Spacing.sm,
          fontWeight: '700',
        },
        td: { color: theme.foreground, padding: Spacing.sm },
        thead: { backgroundColor: theme.surfaceElevated },
        tr: { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
      }}>
      {content || ''}
    </Markdown>
  );
}
