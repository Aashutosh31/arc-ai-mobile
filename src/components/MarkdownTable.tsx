import { createContext, useContext, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RenderRules } from 'react-native-markdown-display';

import { HorizontalScrollBox } from '@/components/HorizontalScrollBox';

/**
 * Minimal shape of the markdown AST nodes we traverse. The library's `ASTNode`
 * is not exported, so we read the fields we need off a cast.
 */
type Node = {
  type: string;
  content?: string;
  children?: Node[];
  index?: number;
  key?: string;
};

/** Concatenated plain text of a node, used to estimate column widths. */
function nodeText(node: Node | undefined): string {
  if (!node) return '';
  if (node.content) return node.content;
  return (node.children ?? []).map(nodeText).join('');
}

/** All `tr` rows of a table, each a list of `th`/`td` cells. Stops at rows. */
function tableRows(node: Node): Node[][] {
  const rows: Node[][] = [];
  const visit = (n: Node) => {
    if (n.type === 'tr') {
      rows.push((n.children ?? []).filter((c) => c.type === 'th' || c.type === 'td'));
      return;
    }
    (n.children ?? []).forEach(visit);
  };
  (node.children ?? []).forEach(visit);
  return rows;
}

const CHAR_WIDTH = 7.4;
const CELL_PADDING = 20;
const MIN_COL = 84;
const MAX_COL = 320;

/**
 * Per-column widths: sized from the widest cell, then stretched to fill the
 * viewport when the whole table is narrower than the bubble. If the total is
 * wider than the viewport the table overflows and the scroll box shows arrows.
 */
function columnWidths(node: Node, viewport: number): number[] {
  const rows = tableRows(node);
  const count = Math.max(1, ...rows.map((r) => r.length));
  const base = Array.from({ length: count }, (_, i) => {
    const longest = Math.max(1, ...rows.map((r) => nodeText(r[i]).length));
    return Math.min(Math.max(longest * CHAR_WIDTH + CELL_PADDING, MIN_COL), MAX_COL);
  });

  const total = base.reduce((sum, w) => sum + w, 0);
  if (viewport > 0 && total < viewport) {
    const extra = (viewport - total) / count;
    return base.map((w) => w + extra);
  }
  return base;
}

const ColumnWidthsContext = createContext<number[] | null>(null);

function TableCell({
  index,
  style,
  children,
}: {
  index: number;
  style: unknown;
  children?: React.ReactNode;
}) {
  const widths = useContext(ColumnWidthsContext);
  const flattened = StyleSheet.flatten(style as object) as Record<string, unknown>;
  const { flex, ...rest } = flattened;
  const width = widths?.[index];

  return (
    <View style={[rest, width != null ? { width, flexGrow: 0, flexShrink: 0 } : null]}>
      {children}
    </View>
  );
}

function TableBlock({
  node,
  style,
  children,
}: {
  node: Node;
  style: unknown;
  children?: React.ReactNode;
}) {
  const [viewport, setViewport] = useState(0);
  const widths = useMemo(() => columnWidths(node, viewport), [node, viewport]);
  const flattened = StyleSheet.flatten(style as object);

  return (
    <HorizontalScrollBox onViewportWidth={setViewport}>
      <View style={flattened}>
        <ColumnWidthsContext.Provider value={widths}>{children}</ColumnWidthsContext.Provider>
      </View>
    </HorizontalScrollBox>
  );
}

type Styles = Record<string, unknown>;

/** Custom table rules: wrap the grid in a horizontal scroller with sized cells. */
export const tableRules: RenderRules = {
  table: (node, children, _parent, styles) => (
    <TableBlock key={node.key} node={node as unknown as Node} style={(styles as Styles)._VIEW_SAFE_table}>
      {children}
    </TableBlock>
  ),
  th: (node, children, _parent, styles) => (
    <TableCell
      key={node.key}
      index={(node as unknown as Node).index ?? 0}
      style={(styles as Styles)._VIEW_SAFE_th}>
      {children}
    </TableCell>
  ),
  td: (node, children, _parent, styles) => (
    <TableCell
      key={node.key}
      index={(node as unknown as Node).index ?? 0}
      style={(styles as Styles)._VIEW_SAFE_td}>
      {children}
    </TableCell>
  ),
};
