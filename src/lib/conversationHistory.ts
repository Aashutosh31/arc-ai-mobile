// Canonical client history helpers — cursor pagination.
// Ported from the web client (client/src/lib/conversationHistory.js).
//
// Pure module: no React, no JSX. Server history is authoritative persisted
// history; message identity is the database _id.

export const CURSOR_PAGE_SIZE = 40;

export interface UiHistoryMessage {
  id: string | null;
  sender: 'user' | 'ai';
  text: string;
  isStreaming: boolean;
  interrupted: boolean;
  attachments?: unknown[];
  image?: string;
  documentName?: string;
}

interface RawMessage {
  _id?: string;
  id?: string;
  content?: string;
  text?: string;
  role?: string;
  sender?: string;
  interrupted?: boolean;
  attachments?: unknown[];
  image?: string;
  documentName?: string;
  metadata?: { interrupted?: boolean };
}

export const sanitizeHistoryText = (text: unknown): unknown => {
  if (!text || typeof text !== 'string') return text;
  let t = String(text);
  t = t.replace(/\r\n|\r/g, '\n');
  t = t.replace(/[ \t]+$/gm, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
};

/**
 * Bug B-06 (mirrors the web client): the server persists documents as
 * `{ type: 'document', name }` and images as `{ type: 'image', url }` (a
 * data URL), so durable records can redraw their attachments after reload
 * or on another device. Returns the renderer fields image/documentName.
 */
export function deriveAttachmentFields(
  attachments: unknown,
): { image?: string; documentName?: string } {
  if (!Array.isArray(attachments)) return {};
  const image = attachments.find(
    (a): a is { url?: string; base64?: string } =>
      Boolean(a) && typeof a === 'object' && (a as any).type === 'image' &&
      ((a as any).url || (a as any).base64),
  );
  const document = attachments.find(
    (a): a is { name?: string } =>
      Boolean(a) && typeof a === 'object' && (a as any).type === 'document' &&
      Boolean((a as any).name),
  );
  const imageUri = image?.url || image?.base64;
  return {
    ...(imageUri ? { image: String(imageUri) } : {}),
    ...(document?.name ? { documentName: String(document.name) } : {}),
  };
}

export function normalizeHistoryMessage(raw: unknown): UiHistoryMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as RawMessage;
  const content = r.content ?? r.text ?? '';
  const id = r._id ?? r.id ?? null;
  const attachments = Array.isArray(r.attachments) ? r.attachments : [];
  const hasText = content !== null && content !== undefined && String(content) !== '';
  if (id === null && !hasText && attachments.length === 0 && !r.image && !r.documentName) {
    return null;
  }
  const role = r.role ?? r.sender ?? 'ai';
  return {
    id: id === null || id === undefined ? null : String(id),
    sender: role === 'user' ? 'user' : 'ai',
    text: sanitizeHistoryText(String(content ?? '')) as string,
    isStreaming: false,
    interrupted: Boolean(r.interrupted ?? r.metadata?.interrupted ?? false),
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(r.image ? { image: r.image } : {}),
    ...(r.documentName ? { documentName: r.documentName } : {}),
  };
}

export function normalizeHistoryPage(rawMessages: unknown): UiHistoryMessage[] {
  if (!Array.isArray(rawMessages)) return [];
  const out: UiHistoryMessage[] = [];
  for (const raw of rawMessages) {
    const msg = normalizeHistoryMessage(raw);
    if (msg) out.push(msg);
  }
  return out;
}

export function prependMessages(
  current: UiHistoryMessage[],
  fresh: UiHistoryMessage[],
): UiHistoryMessage[] {
  const list = Array.isArray(current) ? current : [];
  const incoming = Array.isArray(fresh) ? fresh : [];
  if (incoming.length === 0) return list;
  const known = new Set<string>();
  for (const m of list) {
    if (m && m.id !== null && m.id !== undefined) known.add(String(m.id));
  }
  const novel = incoming.filter((m) => {
    if (!m || typeof m !== 'object') return false;
    if (m.id === null || m.id === undefined) return true;
    return !known.has(String(m.id));
  });
  if (novel.length === 0) return list;
  return [...novel, ...list];
}

export interface HistoryPage {
  messages: unknown[];
  total?: number;
  hasMore?: boolean;
}

export type FetchPage = (
  conversationId: string,
  opts: { limit: number; skip?: number; before?: string; signal?: AbortSignal },
) => Promise<HistoryPage>;

const staleError = () => {
  const err = new Error('stale history request superseded') as Error & { code: string };
  err.code = 'STALE';
  return err;
};

const noMoreError = () => {
  const err = new Error('no older history available') as Error & { code: string };
  err.code = 'NO_MORE';
  return err;
};

function linkSignal(external: AbortSignal | undefined, controller: AbortController) {
  if (!external) return () => {};
  if (external.aborted) {
    controller.abort();
    return () => {};
  }
  const onAbort = () => controller.abort();
  external.addEventListener('abort', onAbort, { once: true });
  return () => external.removeEventListener('abort', onAbort);
}

export class HistoryLoader {
  private fetchPage: FetchPage;
  conversationId: string | null = null;
  oldestId: string | null = null;
  hasMore = false;
  total = 0;
  private seq = 0;
  private controller: AbortController | null = null;

  constructor(fetchPage: FetchPage) {
    if (typeof fetchPage !== 'function')
      throw new Error('HistoryLoader requires a fetchPage function');
    this.fetchPage = fetchPage;
  }

  reset() {
    this.abort();
    this.conversationId = null;
    this.oldestId = null;
    this.hasMore = false;
    this.total = 0;
  }

  abort() {
    if (this.controller) {
      try {
        this.controller.abort();
      } catch {
        // ignore
      }
      this.controller = null;
    }
  }

  private throwIfStale(captured: number) {
    if (captured !== this.seq) throw staleError();
  }

  private beginRequest(externalSignal?: AbortSignal) {
    this.abort();
    const captured = ++this.seq;
    const controller = new AbortController();
    this.controller = controller;
    const unlink = linkSignal(externalSignal, controller);
    return { captured, controller, unlink };
  }

  private endRequest(controller: AbortController, unlink: () => void) {
    try {
      unlink();
    } catch {
      // ignore
    }
    if (this.controller === controller) this.controller = null;
  }

  async loadLatest(
    conversationId: string,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<{
    messages: UiHistoryMessage[];
    oldestId: string | null;
    hasMore: boolean;
    total: number;
  }> {
    const { captured, controller, unlink } = this.beginRequest(signal);
    try {
      this.conversationId = conversationId;
      let first = await this.fetchPage(conversationId, {
        limit: CURSOR_PAGE_SIZE,
        skip: 0,
        signal: controller.signal,
      });
      this.throwIfStale(captured);
      let total = Number(first?.total || 0);
      let messages = normalizeHistoryPage(first?.messages);
      let hasMore = Boolean(first?.hasMore);

      let attempts = 0;
      while (hasMore && attempts < 3) {
        attempts += 1;
        const skip = Math.max(0, total - CURSOR_PAGE_SIZE);
        first = await this.fetchPage(conversationId, {
          limit: CURSOR_PAGE_SIZE,
          skip,
          signal: controller.signal,
        });
        this.throwIfStale(captured);
        total = Number(first?.total ?? total);
        messages = normalizeHistoryPage(first?.messages);
        hasMore = Boolean(first?.hasMore);
      }

      this.oldestId = messages.length > 0 ? messages[0].id : null;
      this.hasMore = total > messages.length || hasMore;
      this.total = total;
      return { messages, oldestId: this.oldestId, hasMore: this.hasMore, total };
    } finally {
      this.endRequest(controller, unlink);
    }
  }

  async loadOlder(
    current: UiHistoryMessage[],
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<{ messages: UiHistoryMessage[]; oldestId: string | null; hasMore: boolean }> {
    if (!this.hasMore || !this.oldestId) throw noMoreError();
    const { captured, controller, unlink } = this.beginRequest(signal);
    try {
      const res = await this.fetchPage(this.conversationId as string, {
        limit: CURSOR_PAGE_SIZE,
        before: this.oldestId,
        signal: controller.signal,
      });
      this.throwIfStale(captured);
      const normalized = normalizeHistoryPage(res?.messages);
      const known = new Set<string>();
      for (const m of Array.isArray(current) ? current : []) {
        if (m && m.id !== null && m.id !== undefined) known.add(String(m.id));
      }
      const fresh = normalized.filter(
        (m) => m.id === null || m.id === undefined || !known.has(String(m.id)),
      );
      this.oldestId = normalized.length > 0 ? normalized[0].id : this.oldestId;
      this.hasMore = Boolean(res?.hasMore);
      if (typeof res?.total === 'number') this.total = res.total;
      return { messages: fresh, oldestId: this.oldestId, hasMore: this.hasMore };
    } finally {
      this.endRequest(controller, unlink);
    }
  }
}
