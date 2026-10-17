/** Shared API types mirroring the ARC-AI server contract. */

export type ActorType = 'user' | 'guest';

export interface AuthIdentity {
  _id: string;
  username: string;
  email: string | null;
  authType: ActorType;
  authProvider: string;
  googleLinked: boolean;
  creditsRemaining: number;
  token?: string;
}

export interface UserPreferences {
  voice?: string;
  accentColor?: string;
  memoryLearningEnabled?: boolean;
}

export interface Conversation {
  _id: string;
  userId: string;
  workspaceId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: { content: string; role: string; timestamp: string };
  pinned: boolean;
  messageCount: number;
}

export interface ToolCall {
  toolName: string;
  input?: unknown;
  output?: unknown;
  status: 'pending' | 'success' | 'failed';
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  workspaceId?: string | null;
  role: 'user' | 'ai';
  content: string;
  attachments?: unknown[];
  toolCalls?: ToolCall[];
  provider?: string;
  model?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MessagesPage {
  messages: ChatMessage[];
  total: number;
  hasMore: boolean;
  page?: { nextBefore: string | null; hasMore: boolean };
}

export interface Workspace {
  _id: string;
  name: string;
  description: string;
  visibility?: string;
  activeProject?: unknown;
  vectorNamespace?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemoryFact {
  _id: string;
  type: 'userFact';
  fact: string;
  category?: string;
  pinned: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SemanticMemory {
  _id: string;
  type: 'semanticMemory';
  query: string;
  response: string;
  tags: string[];
  pinned: boolean;
  source?: string;
  timestamp: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MemoryDashboard {
  preferences: UserPreferences;
  facts: MemoryFact[];
  memories: SemanticMemory[];
}

export interface SearchItem {
  type: string;
  source?: string;
  id: string;
  conversationId?: string;
  messageId?: string;
  memoryId?: string;
  title?: string;
  snippet?: string;
  timestamp?: string;
  score?: number;
  text?: string;
  response?: string;
  tags?: string[];
  category?: string;
  pinned?: boolean;
}

export interface SearchResponse {
  query: string;
  items: SearchItem[];
  grouped: {
    conversations: SearchItem[];
    messages: SearchItem[];
    memories: SearchItem[];
  };
  stats: { total: number; conversations: number; messages: number; memories: number };
}

export interface TtsConfig {
  streamingAvailable: boolean;
  provider: 'server' | 'browser-fallback';
  format: {
    encoding: string;
    codec: string;
    sampleRate: number;
    channels: number;
    bitDepth: number;
    endianness: string;
  };
  events: string[];
  fallback: string;
  stt: {
    available: boolean;
    provider: string | null;
    format: Record<string, unknown>;
    limits: { maxBytes: number; maxMs: number };
    events: string[];
    usesBrowserSpeechRecognition: boolean;
    normalization: boolean;
    safety: { destructiveCommandsRequireConfirmation: boolean };
  };
}

/** Payload for the main AI turn event (`ai:stt:final`). */
export interface TurnPayload {
  command: string;
  image: string | null;
  document: { name: string; type: string; base64: string } | null;
  conversationId: string | null;
  workspaceId: string | null;
  language: string | null;
}
