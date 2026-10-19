/**
 * Exact Socket.IO event names for the ARC-AI realtime protocol.
 * Kept as a typed constant map so both producer and consumer agree on strings.
 */
export const SOCKET_EVENTS = {
  // Chat / stream
  turnSubmit: 'ai:stt:final',
  streamStop: 'ai:stream:stop',
  responseChunk: 'ai:tts:response:chunk',
  agentStatus: 'ai:agent:status',
  providerInfo: 'ai:provider:info',
  creditsUpdate: 'ai:credits:update',
  conversationCreated: 'ai:conversation:created',
  conversationTitle: 'ai:conversation:title',
  messageAppended: 'conversation.message.appended',
  clientAction: 'ai:client:action',
  botError: 'bot_error',

  // TTS mode + streaming PCM
  ttsMode: 'ai:tts:mode',
  ttsLegacyAudio: 'ai:tts:audio',
  ttsLegacyStop: 'ai:tts:audio:stop',
  voiceTtsStart: 'voice:tts:start',
  voiceTtsAudio: 'voice:tts:audio',
  voiceTtsEnd: 'voice:tts:end',
  voiceTtsError: 'voice:tts:error',
  voiceTtsCancel: 'voice:tts:cancel',

  // Streaming STT
  sttStart: 'voice:stt:start',
  sttAudio: 'voice:stt:audio',
  sttCommit: 'voice:stt:commit',
  sttCancel: 'voice:stt:cancel',
  sttClose: 'voice:stt:close',
  sttStarted: 'voice:stt:started',
  sttInterim: 'voice:stt:interim',
  sttFinal: 'voice:stt:final',
  sttEnd: 'voice:stt:end',
  sttError: 'voice:stt:error',
  sttCancelled: 'voice:stt:cancelled',
  sttSpeechStart: 'voice:stt:speech:start',
  sttSpeechEnd: 'voice:stt:speech:end',

  // Workspaces
  workspaceSwitch: 'workspace:switch',
  workspaceSwitched: 'workspace:switched',
  workspaceError: 'workspace:error',

  // Approvals + execution
  approvalRequested: 'agent:approval:requested',
  approvalResolve: 'agent:approval:resolve',
  executionCreated: 'execution.created',
  executionStarted: 'execution.started',
  executionStepStarted: 'execution.step.started',
  executionStepCompleted: 'execution.step.completed',
  executionStepFailed: 'execution.step.failed',
  executionBlocked: 'execution.blocked',
  executionCompleted: 'execution.completed',
  executionFailed: 'execution.failed',
  executionReplan: 'execution.replan.suggested',

  // WhatsApp
  whatsappConnect: 'whatsapp:connect',
  whatsappPair: 'whatsapp:pair_with_phone',
  whatsappCancelPairing: 'whatsapp:cancel_pairing',
  whatsappSyncContacts: 'whatsapp:sync_contacts',
  whatsappSend: 'whatsapp:send',
  whatsappState: 'whatsapp:state',
  whatsappReady: 'whatsapp:ready',
  whatsappConnectAck: 'whatsapp:connect_ack',
  whatsappQr: 'whatsapp:qr',
  whatsappAuthenticated: 'whatsapp:authenticated',
  whatsappDisconnected: 'whatsapp:disconnected',
  whatsappAuthFailure: 'whatsapp:auth_failure',
  whatsappPairingCode: 'whatsapp:pairing_code',
  whatsappPairingCancelled: 'whatsapp:pairing_cancelled',
  whatsappPairingFailed: 'whatsapp:pairing_failed',
  whatsappContactsSynced: 'whatsapp:contacts_synced',
  whatsappContactsSyncFailed: 'whatsapp:contacts_sync_failed',
  whatsappMessageSent: 'whatsapp:message_sent',
  whatsappMessageFailed: 'whatsapp:message_failed',
  whatsappRecipientAmbiguous: 'whatsapp:recipient_ambiguous',
  whatsappRecipientNotFound: 'whatsapp:recipient_not_found',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
