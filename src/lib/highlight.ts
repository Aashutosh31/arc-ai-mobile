/**
 * Lightweight, dependency-free syntax highlighter for React Native.
 *
 * Why not a library: the well-known RN highlighters either pull stale
 * `highlight.js` builds or depend on `react-native-markdown-display` internals.
 * This tokenizer covers the languages ARC-AI actually emits and renders
 * deterministic color tokens, so code blocks read like the web client.
 */

export type TokenType =
  | 'plain'
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'function'
  | 'operator'
  | 'punctuation'
  | 'boolean'
  | 'type'
  | 'tag'
  | 'attr';

export interface Token {
  text: string;
  type: TokenType;
}

export interface TokenLine {
  tokens: Token[];
}

const KEYWORDS: Record<string, string[]> = {
  js: [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'do', 'switch', 'case', 'default', 'break', 'continue', 'new', 'class',
    'extends', 'super', 'this', 'import', 'from', 'export', 'as', 'async',
    'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in',
    'of', 'delete', 'void', 'yield', 'static', 'get', 'set',
  ],
  py: [
    'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue',
    'import', 'from', 'as', 'class', 'try', 'except', 'finally', 'raise',
    'with', 'lambda', 'yield', 'pass', 'global', 'nonlocal', 'assert', 'del',
    'in', 'is', 'not', 'and', 'or', 'None', 'True', 'False', 'self',
  ],
  java: [
    'public', 'private', 'protected', 'class', 'interface', 'extends',
    'implements', 'static', 'final', 'void', 'int', 'long', 'double', 'float',
    'boolean', 'char', 'new', 'return', 'if', 'else', 'for', 'while', 'try',
    'catch', 'finally', 'throw', 'throws', 'import', 'package', 'this', 'super',
    'null', 'true', 'false',
  ],
  go: [
    'func', 'return', 'if', 'else', 'for', 'range', 'package', 'import',
    'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go',
    'defer', 'select', 'switch', 'case', 'default', 'break', 'continue',
    'nil', 'true', 'false',
  ],
  rust: [
    'fn', 'let', 'mut', 'return', 'if', 'else', 'for', 'while', 'loop',
    'match', 'struct', 'enum', 'impl', 'trait', 'use', 'pub', 'mod', 'crate',
    'self', 'super', 'const', 'static', 'where', 'async', 'await', 'move',
    'true', 'false', 'Some', 'None', 'Ok', 'Err',
  ],
  sql: [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
    'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'JOIN', 'LEFT', 'RIGHT',
    'INNER', 'OUTER', 'ON', 'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT',
    'AS', 'AND', 'OR', 'NOT', 'NULL', 'DISTINCT', 'COUNT', 'SUM', 'AVG',
  ],
  shell: [
    'if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'while',
    'case', 'esac', 'function', 'export', 'local', 'return', 'echo', 'cd',
    'sudo', 'npm', 'node', 'git', 'python', 'pip', 'mkdir', 'rm', 'cp', 'mv',
  ],
  css: [],
  json: ['true', 'false', 'null'],
  yaml: ['true', 'false', 'null', 'yes', 'no'],
};

const BOOLEAN_LITERALS = new Set(['true', 'false', 'null', 'undefined', 'None', 'nil']);

const ALIASES: Record<string, string> = {
  javascript: 'js',
  jsx: 'js',
  typescript: 'js',
  tsx: 'js',
  ts: 'js',
  node: 'js',
  mjs: 'js',
  cjs: 'js',
  python: 'py',
  python3: 'py',
  py3: 'py',
  shell: 'shell',
  bash: 'shell',
  sh: 'shell',
  zsh: 'shell',
  console: 'shell',
  golang: 'go',
  gopher: 'go',
  rs: 'rust',
  postgres: 'sql',
  psql: 'sql',
  mysql: 'sql',
  graphql: 'sql',
  scss: 'css',
  less: 'css',
  yml: 'yaml',
  dockerfile: 'shell',
  docker: 'shell',
  makefile: 'shell',
};

export function normalizeLang(raw?: string | null): string {
  const lang = (raw || '').toLowerCase().trim();
  if (!lang) return 'text';
  return ALIASES[lang] || lang;
}

const isCodeLang = (lang: string) => Boolean(KEYWORDS[lang]);

/** Master token patterns. Order matters — first match wins. */
function buildPatterns(lang: string): RegExp {
  const kw = KEYWORDS[lang] || [];
  const kwAlt = kw.length ? kw.join('|') : null;

  const parts: string[] = [
    // Comments
    '(?<comment>\\/\\/[^\\n]*|#[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|<!--[\\s\\S]*?-->)',
    // Strings (incl. template literals and triple-quoted)
    "(?<string>'''[\\s\\S]*?'''|\"\"\"[\\s\\S]*?\"\"\"|`(?:\\\\.|[^`\\\\])*`|'(?:\\\\.|[^'\\\\\\n])*'|\"(?:\\\\.|[^\"\\\\\\n])*\")",
    // Numbers
    '(?<number>\\b0[xXbBoO][0-9a-fA-F_]+\\b|\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)',
  ];

  if (kwAlt) {
    parts.push(`(?<keyword>\\b(?:${kwAlt})\\b)`);
  }

  parts.push(
    // Function calls / definitions
    '(?<fn>\\b[A-Za-z_$][\\w$]*(?=\\s*\\())',
    // Types / class-like capitalized identifiers
    '(?<type>\\b[A-Z][A-Za-z0-9_$]*\\b)',
    // Operators
    '(?<op>[=+\\-*/%<>!&|^~?:]+|\\.{3}|=>)',
    // Punctuation
    '(?<punct>[{}()\\[\\];,.])',
  );

  return new RegExp(parts.join('|'), 'g');
}

/** Classify an identifier that matched `fn`/`type` into keyword/boolean when applicable. */
function refineKeywordGroup(name: string, text: string, kwSet: Set<string>): TokenType | null {
  if (name === 'keyword') return 'keyword';
  if (name === 'boolean') return 'boolean';
  if (BOOLEAN_LITERALS.has(text)) return 'boolean';
  if (name === 'fn' && kwSet.has(text)) return 'keyword';
  if (name === 'type' && BOOLEAN_LITERALS.has(text)) return 'boolean';
  return null;
}

/**
 * Tokenize a full code string into lines of colored tokens. Handles tokens that
 * span multiple lines (block comments / triple-quoted strings) by splitting.
 */
export function highlight(code: string, rawLang?: string | null): TokenLine[] {
  const lang = normalizeLang(rawLang);
  const text = code.replace(/\r\n?/g, '\n');

  if (!text) return [{ tokens: [] }];
  if (!isCodeLang(lang)) {
    // Unknown language — still split into plain lines so whitespace is preserved.
    return text.split('\n').map((line) => ({ tokens: [{ text: line, type: 'plain' as TokenType }] }));
  }

  const kwSet = new Set(KEYWORDS[lang] || []);
  const pattern = buildPatterns(lang);
  const lines: TokenLine[] = [{ tokens: [] }];
  const push = (tok: Token) => {
    if (!tok.text) return;
    const lines_ = tok.text.split('\n');
    for (let i = 0; i < lines_.length; i++) {
      if (i > 0) lines.push({ tokens: [] });
      if (lines_[i].length) {
        lines[lines.length - 1].tokens.push({ text: lines_[i], type: tok.type });
      }
    }
  };

  let last = 0;
  let m: RegExpExecArray | null;
  pattern.lastIndex = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) {
      push({ text: text.slice(last, m.index), type: 'plain' });
    }
    const groups = m.groups || {};
    let type: TokenType = 'plain';
    for (const key of ['comment', 'string', 'number', 'keyword', 'fn', 'type', 'op', 'punct']) {
      if (groups[key] !== undefined) {
        const refined = refineKeywordGroup(key, m[0], kwSet);
        type = refined || (key === 'fn' ? 'function' : key === 'op' ? 'operator' : key === 'punct' ? 'punctuation' : (key as TokenType));
        break;
      }
    }
    push({ text: m[0], type });
    last = m.index + m[0].length;
    if (m[0].length === 0) pattern.lastIndex++; // guard zero-length match
  }

  if (last < text.length) push({ text: text.slice(last), type: 'plain' });
  return lines;
}

/** Map a token type to a palette keyed off the active theme's brand colors. */
export function tokenColor(type: TokenType, palette: Record<string, string>): string {
  switch (type) {
    case 'keyword':
      return palette.keyword;
    case 'string':
      return palette.string;
    case 'comment':
      return palette.comment;
    case 'number':
      return palette.number;
    case 'boolean':
      return palette.boolean;
    case 'function':
      return palette.function;
    case 'type':
      return palette.type;
    case 'operator':
      return palette.operator;
    case 'punctuation':
      return palette.punctuation;
    default:
      return palette.plain;
  }
}

/** Build a syntax palette from a theme, with sensible fallbacks. */
export function syntaxPalette(theme: {
  foreground: string;
  foregroundMuted: string;
  primary: string;
  secondary: string;
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
}): Record<string, string> {
  return {
    plain: theme.foreground,
    keyword: theme.secondary,
    string: theme.success,
    comment: theme.foregroundMuted,
    number: theme.accentSoft,
    boolean: theme.warning,
    function: theme.primary,
    type: theme.accent,
    operator: theme.foregroundMuted,
    punctuation: theme.foregroundMuted,
  };
}
